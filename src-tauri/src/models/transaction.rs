use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Transaction {
    pub id: String, // UUID v4
    pub cashier_id: i64,
    pub timestamp: Option<String>,
    pub total_amount: f64,
    pub discount_id: Option<i64>,
    pub discount_amount: f64,
    pub tax_amount: f64,
    pub payment_method: String, // "CASH" | "DEBIT" | "QRIS"
    pub amount_paid: f64,
    pub change_given: f64,
    pub status: String, // "COMPLETED" | "VOID"
    pub voided_by: Option<i64>,
    pub voided_at: Option<String>,
    pub notes: Option<String>,
}

/// Transaction dengan nama kasir (JOIN result).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TransactionWithCashier {
    pub id: String,
    pub cashier_id: i64,
    pub cashier_name: String,
    pub timestamp: Option<String>,
    pub total_amount: f64,
    pub discount_id: Option<i64>,
    pub discount_amount: f64,
    pub tax_amount: f64,
    pub payment_method: String,
    pub amount_paid: f64,
    pub change_given: f64,
    pub status: String,
    pub voided_by: Option<i64>,
    pub voided_at: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TransactionItem {
    pub id: i64,
    pub transaction_id: String,
    pub product_id: i64,
    pub quantity: i64,
    pub price_at_time: f64,
    pub subtotal: f64,
    pub discount_amount: f64,
}

/// Item transaksi dengan nama produk (JOIN result).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TransactionItemWithProduct {
    pub id: i64,
    pub transaction_id: String,
    pub product_id: i64,
    pub product_name: String,
    pub quantity: i64,
    pub price_at_time: f64,
    pub subtotal: f64,
    pub discount_amount: f64,
}

/// Detail lengkap satu transaksi (untuk frontend).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionDetail {
    pub transaction: TransactionWithCashier,
    pub items: Vec<TransactionItemWithProduct>,
}

/// Payload membuat transaksi baru.
/// Backend menghitung total_amount dan tax_amount sendiri dari settings.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateTransactionPayload {
    pub items: Vec<CreateTransactionItem>,
    pub discount_id: Option<i64>,
    pub discount_amount: f64,
    pub payment_method: String,
    pub amount_paid: f64,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateTransactionItem {
    pub product_id: i64,
    pub quantity: i64,
    pub price_at_time: f64,
    pub discount_amount: f64, // diskon per item (0 jika tidak ada)
}

/// Hasil paginated untuk daftar transaksi.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedTransactions {
    pub data: Vec<TransactionWithCashier>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}
