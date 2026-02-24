use crate::AppState;
use sqlx::SqlitePool;

/// Audit log actions untuk payment
pub enum PaymentAuditAction {
    SaveConfig,
    GenerateQR,
    CheckStatus,
    CancelPayment,
    TestConnection,
}

impl PaymentAuditAction {
    pub fn as_str(&self) -> &'static str {
        match self {
            PaymentAuditAction::SaveConfig => "PAYMENT_CONFIG_SAVE",
            PaymentAuditAction::GenerateQR => "PAYMENT_QR_GENERATE",
            PaymentAuditAction::CheckStatus => "PAYMENT_STATUS_CHECK",
            PaymentAuditAction::CancelPayment => "PAYMENT_CANCEL",
            PaymentAuditAction::TestConnection => "PAYMENT_CONNECTION_TEST",
        }
    }
}

/// Log payment-related activity
pub async fn log_payment_action(
    db: &SqlitePool,
    user_id: Option<i64>,
    action: PaymentAuditAction,
    description: &str,
    metadata: Option<&serde_json::Value>,
) {
    let metadata_str = metadata.map(|m| m.to_string());
    
    let sql = "INSERT INTO activity_logs (user_id, action, description, metadata) VALUES (?, ?, ?, ?)";
    
    let _ = sqlx::query(sql)
        .bind(user_id)
        .bind(action.as_str())
        .bind(description)
        .bind(metadata_str.as_deref())
        .execute(db)
        .await;
}

/// Helper untuk extract user_id dari session token
pub fn get_user_id_from_token(
    state: &AppState,
    session_token: &str,
) -> Option<i64> {
    let sessions = state.sessions.lock().ok()?;
    let session = sessions.get(session_token)?;
    Some(session.user_id)
}

/// Sanitize error message untuk frontend - hide internal details
pub fn sanitize_error(error: &str, context: &str) -> String {
    // Log full error internally (bisa ditambahkan logging ke file)
    eprintln!("[PAYMENT ERROR] {}: {}", context, error);
    
    // Categorize error dan return user-friendly message
    let error_lower = error.to_lowercase();
    
    if error_lower.contains("server key") || error_lower.contains("credential") || error_lower.contains("auth") {
        return "Koneksi ke payment gateway gagal. Periksa konfigurasi Server Key di Settings.".to_string();
    }
    
    if error_lower.contains("rate limit") {
        // Return rate limit message as-is (useful for user)
        return error.to_string();
    }
    
    if error_lower.contains("amount") || error_lower.contains("invalid") {
        return "Jumlah pembayaran tidak valid.".to_string();
    }
    
    if error_lower.contains("connection") || error_lower.contains("network") || error_lower.contains("timeout") {
        return "Gagal koneksi ke server pembayaran. Periksa koneksi internet Anda.".to_string();
    }
    
    if error_lower.contains("qr") || error_lower.contains("qris") {
        return "Gagal generate QR code. Silakan coba lagi.".to_string();
    }
    
    if error_lower.contains("database") || error_lower.contains("sql") {
        return "Terjadi kesalahan internal. Silakan hubungi administrator.".to_string();
    }
    
    // Default: generic error message
    "Terjadi kesalahan. Silakan coba lagi atau hubungi administrator jika masalah berlanjut.".to_string()
}
