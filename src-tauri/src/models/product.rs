use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Product {
    pub id: i64,
    pub category_id: Option<i64>,
    pub sku: Option<String>,
    pub name: String,
    pub price: f64,
    pub stock: i64,
    pub barcode: Option<String>,
    pub is_active: bool,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

/// Product dengan nama kategori (JOIN result).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ProductWithCategory {
    pub id: i64,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
    pub sku: Option<String>,
    pub name: String,
    pub price: f64,
    pub stock: i64,
    pub barcode: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Category {
    pub id: i64,
    pub name: String,
}

/// Category dengan jumlah produk.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryWithCount {
    pub id: i64,
    pub name: String,
    pub product_count: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateProductPayload {
    pub name: String,
    pub sku: Option<String>,
    pub barcode: Option<String>,
    pub category_id: Option<i64>,
    pub price: f64,
    pub stock: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateProductPayload {
    pub name: String,
    pub sku: Option<String>,
    pub barcode: Option<String>,
    pub category_id: Option<i64>,
    pub price: f64,
    pub is_active: bool,
}
