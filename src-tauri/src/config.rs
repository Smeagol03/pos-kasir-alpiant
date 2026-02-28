//! Environment-based configuration module
//! 
//! This module provides configuration management for different environments:
//! - Development: Verbose logging, sandbox payment gateway, relaxed security
//! - Production: Minimal logging, production payment gateway, strict security
//! 
//! Configuration can be set via:
//! 1. Environment variables (highest priority)
//! 2. .env file
//! 3. Default values (lowest priority)

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use std::{env, fs};

/// Application environment mode
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Environment {
    Development,
    Production,
}

impl Environment {
    pub fn as_str(&self) -> &'static str {
        match self {
            Environment::Development => "development",
            Environment::Production => "production",
        }
    }

    /// Get environment from APP_ENV variable or default to Development
    pub fn from_env() -> Self {
        match env::var("APP_ENV").unwrap_or_else(|_| "development".to_string()).as_str() {
            "production" => Environment::Production,
            "development" | _ => Environment::Development,
        }
    }

    /// Check if running in production
    pub fn is_production(&self) -> bool {
        *self == Environment::Production
    }

    /// Check if running in development
    pub fn is_development(&self) -> bool {
        *self == Environment::Development
    }
}

/// Application configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// Environment mode
    pub environment: Environment,
    
    /// Application name
    pub app_name: String,
    
    /// Application version
    pub version: String,
    
    /// Database configuration
    pub database: DatabaseConfig,
    
    /// Payment gateway configuration
    pub payment: PaymentConfig,
    
    /// Security configuration
    pub security: SecurityConfig,
    
    /// Logging configuration
    pub logging: LoggingConfig,
    
    /// Printer configuration
    pub printer: PrinterConfig,
}

/// Database configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    /// SQLite database path (relative to app data dir)
    pub path: String,
    
    /// Maximum number of connections
    pub max_connections: u32,
    
    /// Minimum number of connections
    pub min_connections: u32,
    
    /// Connection timeout in seconds
    pub connect_timeout_secs: u64,
    
    /// Idle timeout in seconds
    pub idle_timeout_secs: u64,
}

/// Payment gateway configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentConfig {
    /// Payment provider (midtrans, xendit, etc.)
    pub provider: String,
    
    /// Midtrans server key (can be overridden by env)
    pub midtrans_server_key: Option<String>,
    
    /// Midtrans base URL (sandbox or production)
    pub midtrans_base_url: String,
    
    /// QRIS enabled
    pub qris_enabled: bool,
    
    /// Payment timeout in seconds
    pub payment_timeout_secs: u64,
}

/// Security configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    /// Encryption key (should be set via env in production)
    pub encryption_key: Option<String>,
    
    /// Session timeout in minutes
    pub session_timeout_mins: u64,
    
    /// Maximum login attempts before lockout
    pub max_login_attempts: u32,
    
    /// Lockout duration in minutes
    pub lockout_duration_mins: u64,
    
    /// Require password change on first login
    pub require_password_change: bool,
    
    /// Minimum password length
    pub min_password_length: usize,
    
    /// Enable audit logging
    pub enable_audit_log: bool,
}

/// Logging configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    /// Log level (error, warn, info, debug, trace)
    pub level: String,
    
    /// Log to file
    pub log_to_file: bool,
    
    /// Log to stdout
    pub log_to_stdout: bool,
    
    /// Use JSON format (true for production)
    pub json_format: bool,
    
    /// Maximum log file size in MB
    pub max_file_size_mb: u64,
    
    /// Maximum number of log files to keep
    pub max_log_files: u32,
}

/// Printer configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrinterConfig {
    /// Default printer port
    pub default_port: String,
    
    /// Paper width (58mm or 80mm)
    pub paper_width: String,
    
    /// Number of copies
    pub copies: u32,
    
    /// Enable auto-print on transaction complete
    pub auto_print: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        let env = Environment::from_env();
        
        Self {
            environment: env,
            app_name: env::var("APP_NAME").unwrap_or_else(|_| "POS Kasir Alpiant".to_string()),
            version: env!("CARGO_PKG_VERSION").to_string(),
            
            database: DatabaseConfig {
                path: env::var("DB_PATH").unwrap_or_else(|_| "pos.db".to_string()),
                max_connections: env::var("DB_MAX_CONNECTIONS")
                    .ok()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(10),
                min_connections: env::var("DB_MIN_CONNECTIONS")
                    .ok()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(2),
                connect_timeout_secs: 30,
                idle_timeout_secs: 600,
            },
            
            payment: PaymentConfig {
                provider: env::var("PAYMENT_PROVIDER").unwrap_or_else(|_| "midtrans".to_string()),
                midtrans_server_key: env::var("MIDTRANS_SERVER_KEY").ok(),
                midtrans_base_url: env::var("MIDTRANS_BASE_URL")
                    .unwrap_or_else(|_| "https://api.sandbox.midtrans.com".to_string()),
                qris_enabled: env::var("QRIS_ENABLED")
                    .map(|s| s == "true")
                    .unwrap_or(true),
                payment_timeout_secs: 900, // 15 minutes
            },
            
            security: SecurityConfig {
                encryption_key: env::var("ENCRYPTION_KEY").ok(),
                session_timeout_mins: env::var("SESSION_TIMEOUT_MINS")
                    .ok()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(480), // 8 hours
                max_login_attempts: 5,
                lockout_duration_mins: 15,
                require_password_change: false,
                min_password_length: 8,
                enable_audit_log: true,
            },
            
            logging: LoggingConfig {
                level: env::var("RUST_LOG").unwrap_or_else(|_| {
                    if env.is_production() { "warn".to_string() } else { "debug".to_string() }
                }),
                log_to_file: true,
                log_to_stdout: env::var("LOG_TO_STDOUT")
                    .map(|s| s == "true")
                    .unwrap_or(true),
                json_format: env.is_production(),
                max_file_size_mb: 10,
                max_log_files: 5,
            },
            
            printer: PrinterConfig {
                default_port: env::var("PRINTER_DEFAULT_PORT").unwrap_or_else(|_| "cups".to_string()),
                paper_width: env::var("PRINTER_PAPER_WIDTH").unwrap_or_else(|_| "80mm".to_string()),
                copies: env::var("PRINTER_COPIES")
                    .ok()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(1),
                auto_print: env::var("PRINTER_AUTO_PRINT")
                    .map(|s| s == "true")
                    .unwrap_or(false),
            },
        }
    }
}

impl AppConfig {
    /// Load configuration from environment and defaults
    pub fn load() -> Self {
        Self::default()
    }

    /// Load configuration from a .env file (if exists)
    pub fn load_from_file(path: &Path) -> Option<Self> {
        if !path.exists() {
            return None;
        }

        let content = fs::read_to_string(path).ok()?;
        
        // Simple .env parser (key=value format)
        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }

            if let Some((key, value)) = line.split_once('=') {
                let key = key.trim();
                let value = value.trim().trim_matches('"').trim_matches('\'');
                
                // Set environment variable (will be picked up by load())
                env::set_var(key, value);
            }
        }

        Some(Self::default())
    }

    /// Get the log directory path
    pub fn get_log_dir(&self, app_data_dir: &Path) -> PathBuf {
        app_data_dir.join("logs")
    }

    /// Get the database path
    pub fn get_database_path(&self, app_data_dir: &Path) -> PathBuf {
        app_data_dir.join(&self.database.path)
    }

    /// Check if running in production
    pub fn is_production(&self) -> bool {
        self.environment.is_production()
    }

    /// Check if running in development
    pub fn is_development(&self) -> bool {
        self.environment.is_development()
    }

    /// Get payment gateway base URL based on environment
    pub fn get_payment_base_url(&self) -> String {
        if self.is_production() {
            "https://api.midtrans.com".to_string()
        } else {
            "https://api.sandbox.midtrans.com".to_string()
        }
    }

    /// Validate configuration for production
    pub fn validate(&self) -> Result<(), String> {
        if self.is_production() {
            // In production, require encryption key to be set
            if self.security.encryption_key.is_none() 
                && self.payment.midtrans_server_key.is_some() {
                return Err(
                    "ENCRYPTION_KEY must be set in production when using payment gateway. \
                     Set it via environment variable for security.".to_string()
                );
            }

            // Warn if using sandbox URL in production
            if self.payment.midtrans_base_url.contains("sandbox") {
                eprintln!("⚠️  WARNING: Using sandbox payment gateway in production!");
            }
        }

        Ok(())
    }
}

/// Global configuration instance
static GLOBAL_CONFIG: OnceLock<AppConfig> = OnceLock::new();

/// Initialize the global configuration
pub fn init_config() -> &'static AppConfig {
    GLOBAL_CONFIG.get_or_init(AppConfig::load)
}

/// Get the global configuration
pub fn get_config() -> &'static AppConfig {
    GLOBAL_CONFIG.get().expect("Configuration not initialized. Call init_config() first.")
}

/// Get the current environment
pub fn get_environment() -> Environment {
    Environment::from_env()
}
