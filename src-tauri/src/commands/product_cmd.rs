use crate::models::product::{
    Category, CategoryWithCount, CreateProductPayload, Product, ProductWithCategory,
    UpdateProductPayload,
};
use crate::AppState;
use tauri::Manager;

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
        "INSERT INTO products (name, sku, barcode, category_id, price, stock, image_path) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&payload.name)
    .bind(&payload.sku)
    .bind(&payload.barcode)
    .bind(payload.category_id)
    .bind(payload.price)
    .bind(payload.stock)
    .bind(&payload.image_path)
    .execute(&state.db)
    .await;

    match result {
        Ok(res) => {
            let id = res.last_insert_rowid();
            
            // Log Stock Adjustment (Initial)
            if payload.stock > 0 {
                let session = crate::auth::guard::validate_admin(&state, &session_token)?;
                crate::commands::activity_cmd::log_stock_adjustment(
                    &state.db,
                    id,
                    session.user_id,
                    "IN",
                    payload.stock,
                    "RESTOCK",
                    Some("Stok awal saat pembuatan produk"),
                ).await;
            }

            // Log Activity
            let session = crate::auth::guard::validate_admin(&state, &session_token)?;
            crate::commands::activity_cmd::log_activity(
                &state.db,
                Some(session.user_id),
                "CREATE_PRODUCT",
                &format!("Membuat produk baru: {}", payload.name),
                None,
            ).await;

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
        "UPDATE products SET name = ?, sku = ?, barcode = ?, category_id = ?, price = ?, is_active = ?, image_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
    .bind(&payload.name)
    .bind(&payload.sku)
    .bind(&payload.barcode)
    .bind(payload.category_id)
    .bind(payload.price)
    .bind(payload.is_active)
    .bind(&payload.image_path)
    .bind(id)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => {
            let session = crate::auth::guard::validate_admin(&state, &session_token)?;
            crate::commands::activity_cmd::log_activity(
                &state.db,
                Some(session.user_id),
                "UPDATE_PRODUCT",
                &format!("Memperbarui produk ID {}: {}", id, payload.name),
                None,
            ).await;

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

    // Log Stock Adjustment
    let session = crate::auth::guard::validate_admin(&state, &session_token)?;
    crate::commands::activity_cmd::log_stock_adjustment(
        &state.db,
        product_id,
        session.user_id,
        if delta > 0 { "IN" } else { "OUT" },
        delta.abs(),
        "ADJUSTMENT",
        None,
    ).await;

    // Log Activity
    crate::commands::activity_cmd::log_activity(
        &state.db,
        Some(session.user_id),
        "ADJUST_STOCK",
        &format!("Menyesuaikan stok produk ID {}: {} (menjadi {})", product_id, delta, new_stock),
        None,
    ).await;

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

    // Log Activity
    let session = crate::auth::guard::validate_admin(&state, &session_token)?;
    crate::commands::activity_cmd::log_activity(
        &state.db,
        Some(session.user_id),
        "DELETE_PRODUCT",
        &format!("Menghapus (soft-delete) produk ID {}", product_id),
        None,
    ).await;

    Ok(())
}

/// Simpan gambar produk — copy file ke AppData/products/ (Admin only)
#[tauri::command]
pub async fn save_product_image(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    session_token: String,
    product_id: i64,
    file_path: String,
) -> Result<String, String> {
    crate::auth::guard::validate_admin(&state, &session_token)?;

    let source = std::path::Path::new(&file_path);
    if !source.exists() {
        return Err("File tidak ditemukan".into());
    }

    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    if !matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "webp") {
        return Err("Format file harus PNG, JPG, atau WEBP".into());
    }

    let metadata = std::fs::metadata(source).map_err(|e| e.to_string())?;
    if metadata.len() > 5 * 1024 * 1024 {
        return Err("Ukuran file maksimal 5MB".into());
    }

    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let img_dir = app_data_dir.join("products");
    std::fs::create_dir_all(&img_dir).map_err(|e| e.to_string())?;

    let dest_path = img_dir.join(format!("{}.{}", product_id, ext));
    std::fs::copy(source, &dest_path).map_err(|e| e.to_string())?;

    let dest_str = dest_path.to_string_lossy().to_string();

    sqlx::query("UPDATE products SET image_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(&dest_str)
        .bind(product_id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(dest_str)
}

/// Generate barcode unik untuk produk (Admin only)
/// Format: KP-{timestamp_hex}-{random} — 13 karakter, compatible barcode scanner
#[tauri::command]
pub async fn generate_barcode(
    state: tauri::State<'_, AppState>,
    session_token: String,
    product_id: i64,
) -> Result<String, String> {
    crate::auth::guard::validate_admin(&state, &session_token)?;

    // Cek produk ada
    let exists: Option<(i64,)> = sqlx::query_as("SELECT id FROM products WHERE id = ?")
        .bind(product_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    if exists.is_none() {
        return Err("Produk tidak ditemukan".into());
    }

    // Generate barcode: 13 digit numeric (EAN-13 compatible)
    // Format: 200 (in-store prefix) + product_id (7 digits) + random (2 digits) + check digit
    let mut barcode;
    loop {
        let base = format!("200{:07}{:02}", product_id % 10_000_000, rand_digits());
        // Hitung check digit EAN-13
        let check = ean13_check_digit(&base);
        barcode = format!("{}{}", base, check);

        // Pastikan unik
        let dup: Option<(i64,)> =
            sqlx::query_as("SELECT id FROM products WHERE barcode = ? AND id != ?")
                .bind(&barcode)
                .bind(product_id)
                .fetch_optional(&state.db)
                .await
                .map_err(|e| e.to_string())?;

        if dup.is_none() {
            break;
        }
    }

    sqlx::query("UPDATE products SET barcode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(&barcode)
        .bind(product_id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(barcode)
}

/// Generate 2 digit acak (00-99)
fn rand_digits() -> u32 {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    nanos % 100
}

/// Hitung check digit EAN-13 dari 12 digit pertama
fn ean13_check_digit(digits: &str) -> u32 {
    let sum: u32 = digits
        .chars()
        .enumerate()
        .map(|(i, c)| {
            let d = c.to_digit(10).unwrap_or(0);
            if i % 2 == 0 {
                d
            } else {
                d * 3
            }
        })
        .sum();
    (10 - (sum % 10)) % 10
}
