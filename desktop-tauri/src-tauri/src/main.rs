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

const PORT: u16 = 8088;

fn log(msg: &str) {
    if let Ok(dir) = std::env::var("TEMP") {
        if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(format!("{dir}\\inko-tauri.log")) {
            let _ = writeln!(f, "{msg}");
        }
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
            }
        })
        .run(tauri::generate_context!())
        .expect("erreur au lancement d'Inko");
}
