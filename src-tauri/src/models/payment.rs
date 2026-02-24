use serde::{Deserialize, Serialize};

/// Response dari Midtrans setelah generate QRIS
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QrisPaymentResponse {
    pub qr_string: String,
    pub order_id: String,
    pub expires_at: String,
}

/// Status pembayaran dari Midtrans
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QrisStatusResponse {
    pub status: String,            // "pending", "settlement", "expire", "cancel"
    pub transaction_status: String,
    pub order_id: String,
}

/// Record di tabel qris_payments
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct QrisPayment {
    pub id: i64,
    pub order_id: String,
    pub amount: f64,
    pub qr_string: Option<String>,
    pub status: String,
    pub transaction_id: Option<String>,
    pub expires_at: Option<String>,
    pub created_at: Option<String>,
    pub settled_at: Option<String>,
}

/// Midtrans Charge API response (raw)
#[derive(Debug, Deserialize)]
pub struct MidtransChargeResponse {
    pub status_code: String,
    pub status_message: Option<String>,
    pub transaction_id: Option<String>,
    pub order_id: Option<String>,
    pub gross_amount: Option<String>,
    pub payment_type: Option<String>,
    pub transaction_time: Option<String>,
    pub transaction_status: Option<String>,
    pub actions: Option<Vec<MidtransAction>>,
    pub expiry_time: Option<String>,
    // QRIS specific
    pub qr_string: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MidtransAction {
    pub name: String,
    pub method: String,
    pub url: String,
}

/// Midtrans Status API response (raw)
#[derive(Debug, Deserialize)]
pub struct MidtransStatusResponse {
    pub status_code: String,
    pub transaction_status: String,
    pub order_id: String,
    pub gross_amount: Option<String>,
    pub payment_type: Option<String>,
    pub settlement_time: Option<String>,
}
