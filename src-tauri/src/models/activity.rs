use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ActivityLog {
    pub id: i64,
    pub user_id: Option<i64>,
    pub action: String,
    pub description: String,
    pub metadata: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ActivityLogWithUser {
    pub id: i64,
    pub user_id: Option<i64>,
    pub user_name: Option<String>,
    pub action: String,
    pub description: String,
    pub metadata: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct StockAdjustment {
    pub id: i64,
    pub product_id: i64,
    pub user_id: i64,
    pub r#type: String, // "IN" | "OUT"
    pub quantity: i64,
    pub reason: String,
    pub notes: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct StockAdjustmentWithDetail {
    pub id: i64,
    pub product_id: i64,
    pub product_name: String,
    pub user_id: i64,
    pub user_name: String,
    pub r#type: String,
    pub quantity: i64,
    pub reason: String,
    pub notes: Option<String>,
    pub created_at: Option<String>,
}
