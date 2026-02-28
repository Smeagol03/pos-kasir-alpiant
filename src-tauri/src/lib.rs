pub mod auth;
pub mod commands;
pub mod database;
pub mod errors;
pub mod models;
pub mod encryption;
pub mod audit;
pub mod rate_limiter;
pub mod logger;
pub mod config;
pub mod validation;

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

                // Initialize configuration
                config::init_config();

                // Initialize encryption key
                if let Err(e) = encryption::init_encryption_key(&app_data_dir) {
                    eprintln!("⚠️  Warning: Failed to initialize encryption key: {}", e);
                }

                // Initialize logger
                if let Err(e) = logger::init_global_logger(&app_data_dir) {
                    eprintln!("⚠️  Warning: Failed to initialize logger: {}", e);
                }

                // Log application startup
                log_info!("APP", "Application starting", serde_json::json!({
                    "version": env!("CARGO_PKG_VERSION"),
                    "environment": config::get_config().environment.as_str(),
                    "app_data_dir": app_data_dir.to_string_lossy()
                }));

                // Inisialisasi database
                let pool = database::connection::init_db(&app_data_dir)
                    .await
                    .expect("Gagal inisialisasi database");

                // Log database initialization
                log_info!("DATABASE", "Database connection pool initialized", serde_json::json!({
                    "pool_size": pool.size()
                }));

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
            commands::product_cmd::permanent_delete_product,
            commands::product_cmd::get_product_image,
            commands::product_cmd::adjust_stock,
            commands::product_cmd::get_categories,
            commands::product_cmd::create_category,
            commands::product_cmd::save_product_image,
            commands::product_cmd::generate_barcode,
            commands::product_cmd::get_low_stock_products,
            commands::product_cmd::bulk_import_products,
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
            commands::report_cmd::get_profit_report,
            // Activity & Stock Logs
            commands::activity_cmd::get_activity_logs,
            commands::activity_cmd::get_stock_history,
            // Settings
            commands::settings_cmd::get_settings,
            commands::settings_cmd::save_settings,
            commands::settings_cmd::save_logo,
            commands::settings_cmd::list_serial_ports,
            commands::settings_cmd::print_receipt,
            commands::settings_cmd::test_print,
            commands::settings_cmd::print_barcode_labels,
            commands::settings_cmd::print_receipt_windows,
            commands::settings_cmd::export_receipt_pdf,
            // Payment QRIS
            commands::payment_cmd::generate_qris_payment,
            commands::payment_cmd::check_qris_status,
            commands::payment_cmd::cancel_qris_payment,
            commands::payment_cmd::save_payment_config,
            commands::payment_cmd::get_payment_config,
            commands::payment_cmd::test_payment_connection,
            // System
            commands::system_cmd::get_health_status,
            commands::system_cmd::create_backup,
            commands::system_cmd::list_backups,
            commands::system_cmd::cleanup_backups,
            commands::system_cmd::get_system_info,
        ])
        .run(tauri::generate_context!())
        .expect("Gagal menjalankan aplikasi");
}
