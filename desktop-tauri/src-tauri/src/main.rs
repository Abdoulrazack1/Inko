// ============================================================
// Inko — application de bureau (Tauri v2 + WebView2)
// ------------------------------------------------------------
// Remplace Electron : ~10× plus léger (WebView2 natif de Windows,
// pas de Chromium embarqué). Le backend Node (Express + extensions)
// est lancé en sidecar ; la fenêtre affiche d'abord un écran de
// démarrage local qui bascule sur l'app dès que /api/health répond.
// ============================================================
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use std::io::Write;
// Audit DESK-03 : cet import était inconditionnel et faisait échouer la
// compilation hors Windows dès la première ligne — le projet ne pouvait même
// pas être *bâti* pour macOS ou Linux. Il n'est utilisé que par
// `creation_flags` (CREATE_NO_WINDOW), qui n'a de sens que sur Windows.
#[cfg(windows)]
use std::os::windows::process::CommandExt;

const PORT: u16 = 8088;

fn log(msg: &str) {
    // Audit DESK-03 : la variable TEMP et le séparateur `\` sont propres à
    // Windows — ailleurs c'est TMPDIR, donc le journal ne s'écrivait nulle part
    // et le diagnostic de démarrage (le seul qu'on ait) disparaissait en
    // silence. `temp_dir()` + `join` valent sur les trois plateformes.
    let path = std::env::temp_dir().join("inko-tauri.log");
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(f, "{msg}");
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let resource_dir = app.path().resource_dir()?;
            // resource_dir() renvoie un chemin « extended-length » (\\?\C:\…) que
            // node ne sait PAS résoudre (EISDIR sur « C: ») → on retire le préfixe.
            let strip = |p: std::path::PathBuf| {
                let s = p.to_string_lossy().to_string();
                s.strip_prefix(r"\\?\").map(|x| x.to_string()).unwrap_or(s)
            };
            let server_js = strip(resource_dir.join("resources").join("server").join("server.js"));
            let frontend  = strip(resource_dir.join("resources").join("frontend"));
            log(&format!("[inko] server.js={}", server_js));

            // Lance le backend Node (sidecar) avec l'environnement de l'app.
            let sidecar = app
                .shell()
                .sidecar("node")
                .map_err(|e| { log(&format!("[inko] sidecar() error: {e}")); e })?
                .args([server_js])
                .env("APP_VERSION", env!("CARGO_PKG_VERSION"))
                .env("PORT", PORT.to_string())
                .env("LOCAL_MODE", "1")
                .env("FRONTEND_DIR", frontend)
                .env("DB_HOST", std::env::var("DB_HOST").unwrap_or_else(|_| "127.0.0.1".into()))
                .env("DB_PORT", std::env::var("DB_PORT").unwrap_or_else(|_| "3306".into()))
                .env("DB_USER", std::env::var("DB_USER").unwrap_or_else(|_| "root".into()))
                .env("DB_PASSWORD", std::env::var("DB_PASSWORD").unwrap_or_default())
                .env("DB_NAME", std::env::var("DB_NAME").unwrap_or_else(|_| "inko".into()));

            match sidecar.spawn() {
                Ok((mut rx, child)) => {
                    log("[inko] sidecar spawned OK");
                    app.manage(std::sync::Mutex::new(Some(child)));
                    // Consomme le flux (sinon le pipe se remplit et bloque node) + journalise.
                    tauri::async_runtime::spawn(async move {
                        while let Some(ev) = rx.recv().await {
                            match ev {
                                CommandEvent::Stdout(b) => log(&format!("[node] {}", String::from_utf8_lossy(&b).trim_end())),
                                CommandEvent::Stderr(b) => log(&format!("[node!] {}", String::from_utf8_lossy(&b).trim_end())),
                                CommandEvent::Error(e)  => log(&format!("[node ERR] {e}")),
                                CommandEvent::Terminated(t) => log(&format!("[node exit] {:?}", t.code)),
                                _ => {}
                            }
                        }
                    });
                }
                Err(e) => log(&format!("[inko] spawn error: {e}")),
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Arrête proprement le backend quand la fenêtre se ferme.
                if let Some(state) = window
                    .app_handle()
                    .try_state::<std::sync::Mutex<Option<tauri_plugin_shell::process::CommandChild>>>()
                {
                    if let Ok(mut guard) = state.lock() {
                        if let Some(child) = guard.take() {
                            let _ = child.kill();
                        }
                    }
                }
                // La MariaDB embarquée survivrait au kill du sidecar (les
                // handlers `exit` de node ne tournent pas sur TerminateProcess).
                // On arrête UNIQUEMENT l'instance lancée depuis nos resources
                // (jamais un MariaDB personnel de l'utilisateur).
                //
                // Audit DESK-04 : le filtrage par CHEMIN est essentiel — sans
                // lui on tuerait le MariaDB personnel de l'utilisateur. Il
                // reste donc, et PowerShell reste l'outil qui sait le faire
                // simplement sur Windows.
                // Ce qui changeait, c'est que le résultat était jeté (`let _ =`)
                // ET que la commande était seulement `spawn()` : un échec ne
                // laissait aucune trace, et la fenêtre pouvait se fermer avant
                // que l'arrêt n'ait eu lieu. Conséquence : base encore en
                // mémoire après fermeture, et port occupé au lancement suivant.
                // On attend désormais la fin de la commande et on signale l'échec.
                //
                // Audit DESK-03 : la MariaDB embarquée n'est fournie que sur
                // Windows (voir prep.js) — ce bloc n'a donc pas d'équivalent
                // ailleurs, où l'app utilise une base externe qu'elle ne doit
                // surtout pas arrêter.
                #[cfg(windows)]
                match std::process::Command::new("powershell")
                    .args([
                        "-NoProfile", "-NonInteractive", "-Command",
                        "Get-Process mariadbd -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*\\Inko\\resources\\mariadb\\*' } | Stop-Process -Force",
                    ])
                    .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
                    .output()
                {
                    Ok(out) if !out.status.success() => eprintln!(
                        "[inko] arrêt de la MariaDB embarquée en échec : {}",
                        String::from_utf8_lossy(&out.stderr).trim()
                    ),
                    Err(e) => eprintln!(
                        "[inko] impossible de lancer l'arrêt de la MariaDB embarquée ({e}). \
                         Si le prochain démarrage signale un port occupé, termine « mariadbd » \
                         depuis le gestionnaire des tâches."
                    ),
                    _ => {}
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("erreur au lancement d'Inko");
}
