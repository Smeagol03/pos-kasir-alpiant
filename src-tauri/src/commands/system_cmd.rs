//! System commands for health checks, backups, and maintenance
//! 
//! This module provides system-level operations:
//! - Health check endpoint
//! - Database backup
//! - Database restore
//! - System information

use crate::{AppState, config::get_config};
use crate::{log_error, log_info};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

/// Health check response
#[derive(Debug, Serialize, Deserialize)]
pub struct HealthStatus {
    pub status: String,
    pub version: String,
    pub environment: String,
    pub uptime_secs: u64,
    pub database: DatabaseHealth,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DatabaseHealth {
    pub status: String,
    pub pool_size: u32,
    pub response_time_ms: f64,
}

/// Backup result
#[derive(Debug, Serialize, Deserialize)]
pub struct BackupResult {
    pub success: bool,
    pub backup_path: String,
    pub backup_size_bytes: u64,
    pub timestamp: String,
    pub message: String,
}

/// System information
#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub app_version: String,
    pub database_path: String,
    pub log_dir: String,
    pub config: ConfigInfo,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConfigInfo {
    pub environment: String,
    pub payment_provider: String,
    pub qris_enabled: bool,
    pub logging_level: String,
}

/// Get system health status
#[tauri::command]
pub async fn get_health_status(
    state: tauri::State<'_, AppState>,
    session_token: String,
) -> Result<HealthStatus, String> {
    // Only admin can check health
    crate::auth::guard::validate_admin(&state, &session_token)?;

    let start = std::time::Instant::now();
    
    // Check database connectivity
    let db_status = match sqlx::query("SELECT 1")
        .fetch_one(&state.db)
        .await
    {
        Ok(_) => {
            let response_time = start.elapsed().as_secs_f64() * 1000.0;
            DatabaseHealth {
                status: "healthy".to_string(),
                pool_size: state.db.size(),
                response_time_ms: response_time,
            }
        }
        Err(e) => {
            log_error!("HEALTH_CHECK", "Database health check failed", e.to_string());
            DatabaseHealth {
                status: "unhealthy".to_string(),
                pool_size: 0,
                response_time_ms: 0.0,
            }
        }
    };

    let config = get_config();
    
    let status = if db_status.status == "healthy" {
        "healthy"
    } else {
        "degraded"
    };

    Ok(HealthStatus {
        status: status.to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        environment: config.environment.as_str().to_string(),
        uptime_secs: 0, // TODO: Track app start time
        database: db_status,
        timestamp: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    })
}

/// Create database backup
#[tauri::command]
pub async fn create_backup(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    session_token: String,
) -> Result<BackupResult, String> {
    crate::auth::guard::validate_admin(&state, &session_token)?;

    log_info!("BACKUP", "Starting database backup", serde_json::json!({}));

    let backup_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("backups");

    // Create backup directory
    std::fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("Failed to create backup directory: {}", e))?;

    // Generate backup filename with timestamp
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let config = get_config();
    let db_path = PathBuf::from(&config.database.path);
    let db_filename = db_path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("database.db");
    
    let backup_filename = format!("backup_{}_{}", timestamp, db_filename);
    let backup_path = backup_dir.join(&backup_filename);

    // Get source database path
    let source_path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(&config.database.path);

    // Also backup WAL and SHM files if they exist
    let wal_path = source_path.with_extension(format!("{}.wal", db_filename));
    let shm_path = source_path.with_extension(format!("{}.shm", db_filename));

    // Copy database file
    std::fs::copy(&source_path, &backup_path)
        .map_err(|e| format!("Failed to copy database: {}", e))?;

    // Copy WAL file if exists
    if wal_path.exists() {
        let _ = std::fs::copy(&wal_path, backup_dir.join(format!("{}.wal", backup_filename)));
    }

    // Copy SHM file if exists
    if shm_path.exists() {
        let _ = std::fs::copy(&shm_path, backup_dir.join(format!("{}.shm", backup_filename)));
    }

    // Get backup size
    let backup_size = std::fs::metadata(&backup_path)
        .map(|m| m.len())
        .unwrap_or(0);

    log_info!("BACKUP", "Database backup completed", serde_json::json!({
        "backup_path": backup_path.to_string_lossy(),
        "backup_size_bytes": backup_size
    }));

    Ok(BackupResult {
        success: true,
        backup_path: backup_path.to_string_lossy().to_string(),
        backup_size_bytes: backup_size,
        timestamp: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        message: "Backup berhasil dibuat".to_string(),
    })
}

/// List available backups
#[tauri::command]
pub async fn list_backups(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    session_token: String,
) -> Result<Vec<BackupInfo>, String> {
    crate::auth::guard::validate_admin(&state, &session_token)?;

    let backup_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("backups");

    if !backup_dir.exists() {
        return Ok(vec![]);
    }

    let mut backups = Vec::new();

    for entry in std::fs::read_dir(&backup_dir)
        .map_err(|e| format!("Failed to read backup directory: {}", e))?
    {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("db") {
            if let Some(filename) = path.file_name().and_then(|s| s.to_str()) {
                if filename.starts_with("backup_") {
                    if let Ok(metadata) = std::fs::metadata(&path) {
                        backups.push(BackupInfo {
                            filename: filename.to_string(),
                            path: path.to_string_lossy().to_string(),
                            size_bytes: metadata.len(),
                            created_at: metadata
                                .created()
                                .ok()
                                .map(|t| chrono::DateTime::<chrono::Local>::from(t).format("%Y-%m-%d %H:%M:%S").to_string())
                                .unwrap_or_default(),
                        });
                    }
                }
            }
        }
    }

    // Sort by creation time (newest first)
    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(backups)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BackupInfo {
    pub filename: String,
    pub path: String,
    pub size_bytes: u64,
    pub created_at: String,
}

/// Delete old backups (keep only last N backups)
#[tauri::command]
pub async fn cleanup_backups(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    session_token: String,
    keep_count: u32,
) -> Result<CleanupResult, String> {
    crate::auth::guard::validate_admin(&state, &session_token)?;

    let backups = list_backups(app_handle.clone(), state.clone(), session_token).await?;
    
    if backups.len() <= keep_count as usize {
        return Ok(CleanupResult {
            deleted_count: 0,
            freed_bytes: 0,
            message: "Tidak ada backup yang perlu dihapus".to_string(),
        });
    }

    let mut deleted_count = 0;
    let mut freed_bytes = 0;

    // Delete oldest backups (keep only last keep_count)
    for backup in backups.iter().skip(keep_count as usize) {
        if let Ok(metadata) = std::fs::metadata(&backup.path) {
            freed_bytes += metadata.len();
        }

        if std::fs::remove_file(&backup.path).is_ok() {
            deleted_count += 1;

            // Also remove associated WAL and SHM files
            let _ = std::fs::remove_file(format!("{}.wal", backup.path));
            let _ = std::fs::remove_file(format!("{}.shm", backup.path));
        }
    }

    log_info!("BACKUP_CLEANUP", "Old backups cleaned up", serde_json::json!({
        "deleted_count": deleted_count,
        "freed_bytes": freed_bytes
    }));

    Ok(CleanupResult {
        deleted_count,
        freed_bytes,
        message: format!("{} backup lama dihapus", deleted_count),
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CleanupResult {
    pub deleted_count: u32,
    pub freed_bytes: u64,
    pub message: String,
}

/// Get system information
#[tauri::command]
pub async fn get_system_info(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    session_token: String,
) -> Result<SystemInfo, String> {
    crate::auth::guard::validate_session(&state, &session_token)?;

    let config = get_config();
    
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let db_path = app_data_dir.join(&config.database.path);
    let log_dir = app_data_dir.join("logs");

    Ok(SystemInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        database_path: db_path.to_string_lossy().to_string(),
        log_dir: log_dir.to_string_lossy().to_string(),
        config: ConfigInfo {
            environment: config.environment.as_str().to_string(),
            payment_provider: config.payment.provider.clone(),
            qris_enabled: config.payment.qris_enabled,
            logging_level: config.logging.level.clone(),
        },
    })
}
