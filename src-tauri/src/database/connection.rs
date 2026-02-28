use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::str::FromStr;
use std::path::Path;

use super::migrations::run_migrations;
use crate::config::get_config;

/// Inisialisasi database SQLite dengan connection pooling yang optimal.
/// File database disimpan di direktori yang diberikan (biasanya AppData).
/// 
/// Features:
/// - WAL mode untuk concurrent reads/writes
/// - Connection pooling dengan configurable size
/// - Foreign keys enforcement
/// - Busy timeout untuk handle concurrent access
pub async fn init_db(
    app_data_dir: &Path,
) -> Result<SqlitePool, Box<dyn std::error::Error>> {
    // Pastikan direktori AppData ada
    std::fs::create_dir_all(app_data_dir)?;

    let config = get_config();
    let db_path = app_data_dir.join(&config.database.path);
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

    let options = SqliteConnectOptions::from_str(&db_url)?
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .synchronous(sqlx::sqlite::SqliteSynchronous::Normal)
        .foreign_keys(true)
        .busy_timeout(std::time::Duration::from_secs(30));

    // Configure connection pool based on environment
    let pool_options = SqlitePoolOptions::new()
        .max_connections(config.database.max_connections)
        .min_connections(config.database.min_connections)
        .acquire_timeout(std::time::Duration::from_secs(
            config.database.connect_timeout_secs,
        ))
        .idle_timeout(std::time::Duration::from_secs(
            config.database.idle_timeout_secs,
        ));

    let pool = pool_options.connect_with(options).await?;

    // Run migrations
    run_migrations(&pool).await?;

    // Log pool info
    eprintln!(
        "[DATABASE] Connection pool initialized: min={}, max={}, db={}",
        config.database.min_connections,
        config.database.max_connections,
        db_path.display()
    );

    Ok(pool)
}

/// Health check untuk database connection
/// Returns Ok(()) if database is reachable
pub async fn health_check(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query("SELECT 1").fetch_one(pool).await?;
    Ok(())
}

/// Get database statistics
pub async fn get_db_stats(pool: &SqlitePool) -> Result<serde_json::Value, sqlx::Error> {
    let pool_stats = pool.size();
    
    // Get table sizes
    let table_sizes: Vec<(String, i64)> = sqlx::query_as(
        "SELECT name, 
                (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=t.name) as exists_flag
         FROM sqlite_master t 
         WHERE type='table' 
         ORDER BY name"
    )
    .fetch_all(pool)
    .await?;

    Ok(serde_json::json!({
        "pool_size": pool_stats,
        "tables": table_sizes.iter().map(|(name, _)| name).collect::<Vec<_>>()
    }))
}
