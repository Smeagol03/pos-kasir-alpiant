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
        .plugin(tauri_plugin_dialog::init())
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
            // User Management
            commands::user_cmd::get_all_users,
            commands::user_cmd::create_user,
            commands::user_cmd::update_user,
            commands::user_cmd::toggle_user_status,
            commands::user_cmd::reset_user_password,
            // Products
            commands::product_cmd::get_products,
            commands::product_cmd::get_product_by_barcode,
            commands::product_cmd::create_product,
            commands::product_cmd::update_product,
            commands::product_cmd::delete_product,
            commands::product_cmd::adjust_stock,
            commands::product_cmd::get_categories,
            commands::product_cmd::create_category,
            commands::product_cmd::save_product_image,
            commands::product_cmd::generate_barcode,
            // Discounts
            commands::discount_cmd::get_discounts,
            commands::discount_cmd::create_discount,
            commands::discount_cmd::update_discount,
            commands::discount_cmd::toggle_discount,
            // Transactions
            commands::transaction_cmd::create_transaction,
            commands::transaction_cmd::void_transaction,
            commands::transaction_cmd::get_transactions,
            commands::transaction_cmd::get_transaction_detail,
            // Reports
            commands::report_cmd::get_daily_report,
            commands::report_cmd::get_financial_summary,
            commands::report_cmd::get_sales_chart,
            commands::report_cmd::get_top_products,
            commands::report_cmd::get_shift_summary,
            // Activity & Stock Logs
            commands::activity_cmd::get_activity_logs,
            commands::activity_cmd::get_stock_history,
            // Settings
            commands::settings_cmd::get_settings,
            commands::settings_cmd::save_settings,
            commands::settings_cmd::save_logo,
            commands::settings_cmd::print_receipt,
            commands::settings_cmd::test_print,
        ])
        .run(tauri::generate_context!())
        .expect("Gagal menjalankan aplikasi");
}
