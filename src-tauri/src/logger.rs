//! Production-ready logging module with structured logging support
//! 
//! This module provides a centralized logging system with:
//! - Log levels (ERROR, WARN, INFO, DEBUG, TRACE)
//! - Structured JSON logging for production
//! - Human-readable logging for development
//! - File rotation for production deployments
//! - Sensitive data redaction

use chrono::{DateTime, Local};
use serde::{Deserialize, Serialize};
use std::fs::{File, OpenOptions};
use std::io::{Write, BufWriter};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

/// Log levels following RFC 5424
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum LogLevel {
    Error = 0,
    Warn = 1,
    Info = 2,
    Debug = 3,
    Trace = 4,
}

impl LogLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            LogLevel::Error => "ERROR",
            LogLevel::Warn => "WARN",
            LogLevel::Info => "INFO",
            LogLevel::Debug => "DEBUG",
            LogLevel::Trace => "TRACE",
        }
    }

    pub fn from_env() -> Self {
        std::env::var("RUST_LOG")
            .map(|s| match s.to_uppercase().as_str() {
                "TRACE" => LogLevel::Trace,
                "DEBUG" => LogLevel::Debug,
                "INFO" => LogLevel::Info,
                "WARN" => LogLevel::Warn,
                _ => LogLevel::Error,
            })
            .unwrap_or(LogLevel::Info)
    }
}

/// Structured log entry for production logging
#[derive(Debug, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: DateTime<Local>,
    pub level: LogLevel,
    pub target: &'static str,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Logger configuration
#[derive(Debug, Clone)]
pub struct LoggerConfig {
    pub level: LogLevel,
    pub log_to_file: bool,
    pub log_to_stdout: bool,
    pub json_format: bool,
    pub max_file_size_mb: u64,
    pub max_log_files: u32,
}

impl Default for LoggerConfig {
    fn default() -> Self {
        Self {
            level: LogLevel::from_env(),
            log_to_file: true,
            log_to_stdout: true,
            json_format: cfg!(not(debug_assertions)), // JSON format in production
            max_file_size_mb: 10,
            max_log_files: 5,
        }
    }
}

/// Main logger instance
pub struct Logger {
    config: LoggerConfig,
    log_dir: PathBuf,
    current_file: Mutex<Option<BufWriter<File>>>,
    current_file_size: Mutex<u64>,
}

impl Logger {
    /// Initialize the logger with the given configuration
    pub fn init(app_data_dir: &Path, config: LoggerConfig) -> Result<Self, String> {
        let log_dir = app_data_dir.join("logs");
        
        // Create log directory if it doesn't exist
        std::fs::create_dir_all(&log_dir)
            .map_err(|e| format!("Failed to create log directory: {}", e))?;

        let logger = Self {
            config,
            log_dir,
            current_file: Mutex::new(None),
            current_file_size: Mutex::new(0),
        };

        // Initialize log file
        logger.rotate_logs()?;
        
        Ok(logger)
    }

    /// Get the log file path for today
    fn get_log_file_path(&self) -> PathBuf {
        let date = Local::now().format("%Y-%m-%d");
        self.log_dir.join(format!("app-{}.log", date))
    }

    /// Rotate log files if they exceed the size limit
    fn rotate_logs(&self) -> Result<(), String> {
        let log_path = self.get_log_file_path();
        
        // Check if we need to rotate
        if log_path.exists() {
            let metadata = std::fs::metadata(&log_path)
                .map_err(|e| format!("Failed to read log file metadata: {}", e))?;
            
            let file_size = metadata.len();
            let max_size = self.config.max_file_size_mb * 1024 * 1024;

            if file_size >= max_size {
                // Rotate existing log files
                for i in (1..self.config.max_log_files).rev() {
                    let old_path = self.log_dir.join(format!("app-{}.{}.log", 
                        Local::now().format("%Y-%m-%d"), i));
                    let new_path = self.log_dir.join(format!("app-{}.{}.log", 
                        Local::now().format("%Y-%m-%d"), i + 1));
                    
                    if old_path.exists() {
                        let _ = std::fs::rename(&old_path, &new_path);
                    }
                }

                // Move current log to .1
                let numbered_path = self.log_dir.join(format!("app-{}.1.log", 
                    Local::now().format("%Y-%m-%d")));
                let _ = std::fs::rename(&log_path, &numbered_path);

                // Delete oldest log if exceeds max_log_files
                let oldest_path = self.log_dir.join(format!("app-{}.{}.log", 
                    Local::now().format("%Y-%m-%d"), self.config.max_log_files));
                if oldest_path.exists() {
                    let _ = std::fs::remove_file(&oldest_path);
                }
            }
        }

        // Open new log file
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
            .map_err(|e| format!("Failed to open log file: {}", e))?;

        let file_size = file.metadata()
            .map(|m| m.len())
            .unwrap_or(0);

        *self.current_file.lock().unwrap() = Some(BufWriter::new(file));
        *self.current_file_size.lock().unwrap() = file_size;

        Ok(())
    }

    /// Write a log entry
    fn write(&self, entry: &LogEntry) {
        if entry.level > self.config.level {
            return;
        }

        let log_line = if self.config.json_format {
            // JSON format for production
            serde_json::to_string(entry).unwrap_or_else(|_| "{}".to_string())
        } else {
            // Human-readable format for development
            format!(
                "{} [{}] [{}] {}{}",
                entry.timestamp.format("%Y-%m-%d %H:%M:%S%.3f"),
                entry.level.as_str(),
                entry.target,
                entry.message,
                entry.data.as_ref()
                    .map(|d| format!(" | {}", d))
                    .unwrap_or_default()
            )
        };

        // Write to stdout if configured
        if self.config.log_to_stdout {
            match entry.level {
                LogLevel::Error => eprintln!("{}", log_line),
                LogLevel::Warn => eprintln!("{}", log_line),
                _ => println!("{}", log_line),
            }
        }

        // Write to file if configured
        if self.config.log_to_file {
            if let Ok(mut guard) = self.current_file.lock() {
                if let Some(writer) = guard.as_mut() {
                    let _ = writeln!(writer, "{}", log_line);
                    let _ = writer.flush();
                    
                    // Update file size
                    if let Ok(mut size) = self.current_file_size.lock() {
                        *size += log_line.len() as u64 + 1;
                    }
                }
            }
        }
    }

    /// Log an error message
    pub fn error(&self, target: &'static str, message: &str, error: Option<&str>) {
        self.write(&LogEntry {
            timestamp: Local::now(),
            level: LogLevel::Error,
            target,
            message: message.to_string(),
            data: None,
            error: error.map(String::from),
        });
    }

    /// Log a warning message
    pub fn warn(&self, target: &'static str, message: &str) {
        self.write(&LogEntry {
            timestamp: Local::now(),
            level: LogLevel::Warn,
            target,
            message: message.to_string(),
            data: None,
            error: None,
        });
    }

    /// Log an info message with optional data
    pub fn info(&self, target: &'static str, message: &str, data: Option<serde_json::Value>) {
        self.write(&LogEntry {
            timestamp: Local::now(),
            level: LogLevel::Info,
            target,
            message: message.to_string(),
            data,
            error: None,
        });
    }

    /// Log a debug message with optional data
    pub fn debug(&self, target: &'static str, message: &str, data: Option<serde_json::Value>) {
        self.write(&LogEntry {
            timestamp: Local::now(),
            level: LogLevel::Debug,
            target,
            message: message.to_string(),
            data,
            error: None,
        });
    }

    /// Log a trace message with optional data
    pub fn trace(&self, target: &'static str, message: &str, data: Option<serde_json::Value>) {
        self.write(&LogEntry {
            timestamp: Local::now(),
            level: LogLevel::Trace,
            target,
            message: message.to_string(),
            data,
            error: None,
        });
    }

    /// Log a payment-related action (with sensitive data redaction)
    pub fn payment(&self, action: &str, data: &serde_json::Value) {
        // Redact sensitive fields
        let redacted = self.redact_sensitive_data(data.clone());
        
        self.write(&LogEntry {
            timestamp: Local::now(),
            level: LogLevel::Info,
            target: "PAYMENT",
            message: action.to_string(),
            data: Some(redacted),
            error: None,
        });
    }

    /// Redact sensitive data from JSON
    fn redact_sensitive_data(&self, value: serde_json::Value) -> serde_json::Value {
        match value {
            serde_json::Value::Object(mut map) => {
                for (key, val) in map.iter_mut() {
                    if key.to_lowercase().contains("key") || 
                       key.to_lowercase().contains("secret") ||
                       key.to_lowercase().contains("password") ||
                       key.to_lowercase().contains("token") {
                        *val = serde_json::Value::String("***REDACTED***".to_string());
                    } else {
                        *val = self.redact_sensitive_data(val.clone());
                    }
                }
                serde_json::Value::Object(map)
            }
            serde_json::Value::Array(arr) => {
                serde_json::Value::Array(arr.into_iter()
                    .map(|v| self.redact_sensitive_data(v))
                    .collect())
            }
            _ => value,
        }
    }
}

/// Global logger instance
static GLOBAL_LOGGER: OnceLock<Mutex<Logger>> = OnceLock::new();

/// Initialize the global logger
pub fn init_global_logger(app_data_dir: &Path) -> Result<(), String> {
    let config = LoggerConfig::default();
    let logger = Logger::init(app_data_dir, config)?;

    GLOBAL_LOGGER
        .set(Mutex::new(logger))
        .map_err(|_| "Logger already initialized")?;

    Ok(())
}

/// Get the global logger instance
pub fn get_logger() -> Option<&'static Mutex<Logger>> {
    GLOBAL_LOGGER.get()
}

/// Convenience macros for logging
#[macro_export]
macro_rules! log_error {
    ($target:expr, $msg:expr) => {
        if let Some(logger) = $crate::logger::get_logger() {
            if let Ok(l) = logger.lock() {
                l.error($target, $msg, None);
            }
        }
    };
    ($target:expr, $msg:expr, $err:expr) => {
        if let Some(logger) = $crate::logger::get_logger() {
            if let Ok(l) = logger.lock() {
                l.error($target, $msg, Some(&$err));
            }
        }
    };
}

#[macro_export]
macro_rules! log_warn {
    ($target:expr, $msg:expr) => {
        if let Some(logger) = $crate::logger::get_logger() {
            if let Ok(l) = logger.lock() {
                l.warn($target, $msg);
            }
        }
    };
}

#[macro_export]
macro_rules! log_info {
    ($target:expr, $msg:expr) => {
        if let Some(logger) = $crate::logger::get_logger() {
            if let Ok(l) = logger.lock() {
                l.info($target, $msg, None);
            }
        }
    };
    ($target:expr, $msg:expr, $data:expr) => {
        if let Some(logger) = $crate::logger::get_logger() {
            if let Ok(l) = logger.lock() {
                let opt_data: ::std::option::Option<serde_json::Value> = ::std::option::Option::Some($data);
                l.info($target, $msg, opt_data);
            }
        }
    };
}

#[macro_export]
macro_rules! log_debug {
    ($target:expr, $msg:expr) => {
        if let Some(logger) = $crate::logger::get_logger() {
            if let Ok(l) = logger.lock() {
                l.debug($target, $msg, None);
            }
        }
    };
    ($target:expr, $msg:expr, $data:expr) => {
        if let Some(logger) = $crate::logger::get_logger() {
            if let Ok(l) = logger.lock() {
                let opt_data: ::std::option::Option<serde_json::Value> = ::std::option::Option::Some($data);
                l.debug($target, $msg, opt_data);
            }
        }
    };
}

#[macro_export]
macro_rules! log_payment {
    ($action:expr, $data:expr) => {
        if let Some(logger) = $crate::logger::get_logger() {
            if let Ok(l) = logger.lock() {
                l.payment($action, $data);
            }
        }
    };
}
