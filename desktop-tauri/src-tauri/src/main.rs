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

const PORT: u16 = 8088;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let resource_dir = app.path().resource_dir()?;
            let server_js = resource_dir.join("resources").join("server").join("server.js");
            let frontend  = resource_dir.join("resources").join("frontend");

            // Lance le backend Node (sidecar) avec l'environnement de l'app.
            let sidecar = app
                .shell()
                .sidecar("node")?
                .args([server_js.to_string_lossy().to_string()])
                .env("PORT", PORT.to_string())
                .env("LOCAL_MODE", "1")
                .env("FRONTEND_DIR", frontend.to_string_lossy().to_string())
                .env("DB_HOST", std::env::var("DB_HOST").unwrap_or_else(|_| "127.0.0.1".into()))
                .env("DB_PORT", std::env::var("DB_PORT").unwrap_or_else(|_| "3306".into()))
                .env("DB_USER", std::env::var("DB_USER").unwrap_or_else(|_| "root".into()))
                .env("DB_PASSWORD", std::env::var("DB_PASSWORD").unwrap_or_default())
                .env("DB_NAME", std::env::var("DB_NAME").unwrap_or_else(|_| "inko".into()));

            let (_rx, child) = sidecar.spawn()?;
            // Garde le process pour le tuer à la fermeture de l'app.
            app.manage(std::sync::Mutex::new(Some(child)));
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
