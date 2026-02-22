pub mod auth;
pub mod commands;
pub mod database;
pub mod errors;
pub mod models;

use auth::session::SessionStore;
use std::sync::Mutex;
use tauri::Manager;

/// State global aplikasi — di-manage oleh Tauri.
pub struct AppState {
    pub db: sqlx::SqlitePool,
    pub sessions: Mutex<SessionStore>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                // Dapatkan path AppData
                let app_data_dir = app_handle
                    .path()
                    .app_data_dir()
                    .expect("Gagal mendapatkan path AppData");

                // Inisialisasi database
                let pool = database::connection::init_db(&app_data_dir)
                    .await
                    .expect("Gagal inisialisasi database");

                // Simpan state
                app_handle.manage(AppState {
                    db: pool,
                    sessions: Mutex::new(SessionStore::new()),
                });
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth
            commands::auth_cmd::check_first_run,
            commands::auth_cmd::create_admin,
            commands::auth_cmd::login,
            commands::auth_cmd::logout,
            commands::auth_cmd::check_session,
        ])
        .run(tauri::generate_context!())
        .expect("Gagal menjalankan aplikasi");
}
