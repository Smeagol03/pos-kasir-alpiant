use serde::{Deserialize, Serialize};

/// Profil perusahaan/toko.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompanyProfile {
    pub store_name: String,
    pub address: String,
    pub phone: String,
    pub email: String,
    pub website: String,
    pub logo_path: String,
    pub tax_number: String,
}

/// Pengaturan struk.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceiptSettings {
    pub show_logo: bool,
    pub header_text: String,
    pub footer_text: String,
    pub show_cashier_name: bool,
    pub show_tax_detail: bool,
    pub show_discount_detail: bool,
    pub paper_width: String, // "58mm" | "80mm"
    pub copies: i32,
}

/// Pengaturan pajak.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaxSettings {
    pub is_enabled: bool,
    pub rate: f64,
    pub label: String,
    pub is_included: bool,
}

/// Semua pengaturan aplikasi.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub company: CompanyProfile,
    pub receipt: ReceiptSettings,
    pub tax: TaxSettings,
    pub low_stock_threshold: i64,
    pub printer_port: String,
    pub timezone: String,
}

/// Laporan keuangan lengkap untuk periode tertentu.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FinancialSummary {
    pub start_date: String,
    pub end_date: String,
    pub gross_revenue: f64,
    pub net_revenue: f64,
    pub tax_total: f64,
    pub discount_total: f64,
    pub transaction_count: i64,
    pub cash_total: f64,
    pub debit_total: f64,
    pub qris_total: f64,
    pub void_count: i64,
    pub void_total: f64,
}

/// Data laporan harian.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyReport {
    pub date: String,
    pub total_revenue: f64,
    pub transaction_count: i64,
    pub average_transaction: f64,
    pub total_items_sold: i64,
    pub cash_total: f64,
    pub debit_total: f64,
    pub qris_total: f64,
    pub void_count: i64,
}

/// Data chart penjualan per hari.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ChartPoint {
    pub date: String,
    pub revenue: f64,
    pub count: i64,
}

/// Statistik produk terlaris.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ProductStat {
    pub product_id: i64,
    pub name: String,
    pub total_sold: i64,
    pub total_revenue: f64,
}

/// Ringkasan shift kasir.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShiftSummary {
    pub cashier_name: String,
    pub login_at: String,
    pub transaction_count: i64,
    pub total_revenue: f64,
}
