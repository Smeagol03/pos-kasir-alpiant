use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Discount {
    pub id: i64,
    pub name: String,
    pub r#type: String, // "NOMINAL" | "PERCENT"
    pub value: f64,
    pub min_purchase: f64,
    pub is_automatic: bool,
    pub is_active: bool,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateDiscountPayload {
    pub name: String,
    pub r#type: String,
    pub value: f64,
    pub min_purchase: f64,
    pub is_automatic: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateDiscountPayload {
    pub name: String,
    pub r#type: String,
    pub value: f64,
    pub min_purchase: f64,
    pub is_automatic: bool,
    pub is_active: bool,
}
