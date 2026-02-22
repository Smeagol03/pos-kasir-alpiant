use crate::models::product::{
    Category, CategoryWithCount, CreateProductPayload, Product, ProductWithCategory,
    UpdateProductPayload,
};
use crate::AppState;

/// Ambil daftar kategori + jumlah produk
#[tauri::command]
pub async fn get_categories(
    state: tauri::State<'_, AppState>,
    session_token: String,
) -> Result<Vec<CategoryWithCount>, String> {
    crate::auth::guard::validate_session(&state, &session_token)?;

    let query = "
        SELECT c.id, c.name, COUNT(p.id) as product_count
        FROM categories c
        LEFT JOIN products p ON c.id = p.category_id
        GROUP BY c.id
        ORDER BY c.name ASC
    ";

    let counts = sqlx::query_as::<_, CategoryWithCount>(query)
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(counts)
}

/// Tambah kategori baru (Admin only)
#[tauri::command]
pub async fn create_category(
    state: tauri::State<'_, AppState>,
    session_token: String,
    name: String,
) -> Result<Category, String> {
    crate::auth::guard::validate_admin(&state, &session_token)?;

    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Nama kategori tidak boleh kosong".into());
    }

    let result = sqlx::query("INSERT INTO categories (name) VALUES (?)")
        .bind(trimmed)
        .execute(&state.db)
        .await;

    match result {
        Ok(res) => {
            let id = res.last_insert_rowid();
            Ok(Category {
                id,
                name: trimmed.to_string(),
            })
        }
        Err(sqlx::Error::Database(err)) if err.is_unique_violation() => {
            Err("Kategori sudah ada".into())
        }
        Err(e) => Err(e.to_string()),
    }
}

/// Ambil daftar produk. Bisa difilter by category and status.
#[tauri::command]
pub async fn get_products(
    state: tauri::State<'_, AppState>,
    session_token: String,
    search: Option<String>,
    category_id: Option<i64>,
    show_inactive: Option<bool>,
) -> Result<Vec<ProductWithCategory>, String> {
    crate::auth::guard::validate_session(&state, &session_token)?;

    let is_admin = crate::auth::guard::validate_admin(&state, &session_token).is_ok();

    // Default: Kasir hanya melihat produk aktif. Admin bisa melihat semua.
    let active_only = if is_admin {
        !show_inactive.unwrap_or(true)
    } else {
        true
    };

    let base_query = "
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE 1=1
    ";

    let mut query = base_query.to_string();

    if active_only {
        query.push_str(" AND p.is_active = 1");
    }

    if let Some(id) = category_id {
        query.push_str(&format!(" AND p.category_id = {}", id));
    }

    if let Some(mut term) = search {
        term = format!("%{}%", term.to_lowercase());
        query.push_str(&format!(
            " AND (LOWER(p.name) LIKE '{}' OR LOWER(p.sku) LIKE '{}' OR p.barcode LIKE '{}')",
            term, term, term
        ));
    }

    query.push_str(" ORDER BY p.name ASC");

    let products = sqlx::query_as::<_, ProductWithCategory>(&query)
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(products)
}

/// Ambil 1 produk via barcode untuk POS
#[tauri::command]
pub async fn get_product_by_barcode(
    state: tauri::State<'_, AppState>,
    session_token: String,
    barcode: String,
) -> Result<ProductWithCategory, String> {
    crate::auth::guard::validate_session(&state, &session_token)?;

    let query = "
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.barcode = ? AND p.is_active = 1
    ";

    let product = sqlx::query_as::<_, ProductWithCategory>(query)
        .bind(&barcode)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Produk tidak ditemukan atau tidak aktif")?;

    Ok(product)
}

/// Buat produk baru (Admin only)
#[tauri::command]
pub async fn create_product(
    state: tauri::State<'_, AppState>,
    session_token: String,
    payload: CreateProductPayload,
) -> Result<Product, String> {
    crate::auth::guard::validate_admin(&state, &session_token)?;

    if payload.name.trim().is_empty() {
        return Err("Nama produk tidak boleh kosong".into());
    }

    if payload.price < 0.0 {
        return Err("Harga tidak valid".into());
    }

    if payload.stock < 0 {
        return Err("Stok tiak valid".into());
    }

    let result = sqlx::query(
        "INSERT INTO products (name, sku, barcode, category_id, price, stock) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&payload.name)
    .bind(&payload.sku)
    .bind(&payload.barcode)
    .bind(payload.category_id)
    .bind(payload.price)
    .bind(payload.stock)
    .execute(&state.db)
    .await;

    match result {
        Ok(res) => {
            let id = res.last_insert_rowid();
            let new_product = sqlx::query_as::<_, Product>("SELECT * FROM products WHERE id = ?")
                .bind(id)
                .fetch_one(&state.db)
                .await
                .map_err(|e| e.to_string())?;
            Ok(new_product)
        }
        Err(sqlx::Error::Database(err)) if err.is_unique_violation() => {
            Err("SKU atau Barcode sudah digunakan".into())
        }
        Err(e) => Err(e.to_string()),
    }
}

/// Update produk (Admin only)
#[tauri::command]
pub async fn update_product(
    state: tauri::State<'_, AppState>,
    session_token: String,
    id: i64,
    payload: UpdateProductPayload,
) -> Result<Product, String> {
    crate::auth::guard::validate_admin(&state, &session_token)?;

    if payload.name.trim().is_empty() {
        return Err("Nama produk tidak boleh kosong".into());
    }

    if payload.price < 0.0 {
        return Err("Harga tidak valid".into());
    }

    let result = sqlx::query(
        "UPDATE products SET name = ?, sku = ?, barcode = ?, category_id = ?, price = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
    .bind(&payload.name)
    .bind(&payload.sku)
    .bind(&payload.barcode)
    .bind(payload.category_id)
    .bind(payload.price)
    .bind(payload.is_active)
    .bind(id)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => {
            let updated = sqlx::query_as::<_, Product>("SELECT * FROM products WHERE id = ?")
                .bind(id)
                .fetch_one(&state.db)
                .await
                .map_err(|e| e.to_string())?;
            Ok(updated)
        }
        Err(sqlx::Error::Database(err)) if err.is_unique_violation() => {
            Err("SKU atau Barcode sudah digunakan".into())
        }
        Err(e) => Err(e.to_string()),
    }
}

/// Sesuaikan stok tambah/kurang (Admin only)
#[tauri::command]
pub async fn adjust_stock(
    state: tauri::State<'_, AppState>,
    session_token: String,
    product_id: i64,
    delta: i64,
) -> Result<i64, String> {
    crate::auth::guard::validate_admin(&state, &session_token)?;

    if delta == 0 {
        return Err("Nilai penyesuaian harus selain 0".into());
    }

    // Ambil stok sekarang
    let current_stock: (i64,) = sqlx::query_as("SELECT stock FROM products WHERE id = ?")
        .bind(product_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Produk tidak ditemukan")?;

    let new_stock = current_stock.0 + delta;

    if new_stock < 0 {
        return Err("Stok akhir tidak boleh negatif".into());
    }

    sqlx::query("UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(new_stock)
        .bind(product_id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(new_stock)
}

/// Soft Delete Produk - buat is_active = false
#[tauri::command]
pub async fn delete_product(
    state: tauri::State<'_, AppState>,
    session_token: String,
    product_id: i64,
) -> Result<(), String> {
    crate::auth::guard::validate_admin(&state, &session_token)?;

    sqlx::query("UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(product_id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
