use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::str::FromStr;

use super::migrations::run_migrations;

/// Inisialisasi database SQLite.
/// File database disimpan di direktori yang diberikan (biasanya AppData).
pub async fn init_db(
    app_data_dir: &std::path::Path,
) -> Result<SqlitePool, Box<dyn std::error::Error>> {
    // Pastikan direktori AppData ada
    std::fs::create_dir_all(app_data_dir)?;

    let db_path = app_data_dir.join("kasirpro.db");
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

    let options = SqliteConnectOptions::from_str(&db_url)?
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .foreign_keys(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;

    // Jalankan migrasi (CREATE TABLE IF NOT EXISTS + seed)
    run_migrations(&pool).await?;

    Ok(pool)
}
