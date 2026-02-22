use crate::models::settings::{AppSettings, CompanyProfile, ReceiptSettings, TaxSettings};
use crate::AppState;
use std::collections::HashMap;
use tauri::Manager;

/// Ambil semua setting dari DB dan bentuk struct AppSettings
#[tauri::command]
pub async fn get_settings(
    state: tauri::State<'_, AppState>,
    session_token: String,
) -> Result<AppSettings, String> {
    crate::auth::guard::validate_session(&state, &session_token)?;

    let rows: Vec<(String, String)> = sqlx::query_as("SELECT key, value FROM settings")
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    let map: HashMap<String, String> = rows.into_iter().collect();

    let company = CompanyProfile {
        store_name: map.get("company.store_name").cloned().unwrap_or_default(),
        address: map.get("company.address").cloned().unwrap_or_default(),
        phone: map.get("company.phone").cloned().unwrap_or_default(),
        email: map.get("company.email").cloned().unwrap_or_default(),
        website: map.get("company.website").cloned().unwrap_or_default(),
        logo_path: map.get("company.logo_path").cloned().unwrap_or_default(),
        tax_number: map.get("company.tax_number").cloned().unwrap_or_default(),
    };

    let receipt = ReceiptSettings {
        show_logo: map.get("receipt.show_logo").unwrap_or(&"0".to_string()) == "1",
        header_text: map.get("receipt.header_text").cloned().unwrap_or_default(),
        footer_text: map.get("receipt.footer_text").cloned().unwrap_or_default(),
        show_cashier_name: map
            .get("receipt.show_cashier_name")
            .unwrap_or(&"1".to_string())
            == "1",
        show_tax_detail: map
            .get("receipt.show_tax_detail")
            .unwrap_or(&"1".to_string())
            == "1",
        show_discount_detail: map
            .get("receipt.show_discount_detail")
            .unwrap_or(&"1".to_string())
            == "1",
        paper_width: map
            .get("receipt.paper_width")
            .cloned()
            .unwrap_or_else(|| "80mm".into()),
        copies: map
            .get("receipt.copies")
            .unwrap_or(&"1".to_string())
            .parse()
            .unwrap_or(1),
    };

    let tax = TaxSettings {
        is_enabled: map.get("tax.is_enabled").unwrap_or(&"0".to_string()) == "1",
        rate: map
            .get("tax.rate")
            .unwrap_or(&"0".to_string())
            .parse()
            .unwrap_or(0.0),
        label: map
            .get("tax.label")
            .cloned()
            .unwrap_or_else(|| "PPN".into()),
        is_included: map.get("tax.is_included").unwrap_or(&"0".to_string()) == "1",
    };

    let app = AppSettings {
        company,
        receipt,
        tax,
        low_stock_threshold: map
            .get("app.low_stock_threshold")
            .unwrap_or(&"5".to_string())
            .parse()
            .unwrap_or(5),
        printer_port: map.get("app.printer_port").cloned().unwrap_or_default(),
        timezone: map
            .get("app.timezone")
            .cloned()
            .unwrap_or_else(|| "Asia/Jakarta".into()),
    };

    Ok(app)
}

/// Simpan semua settings (Admin only)
#[tauri::command]
pub async fn save_settings(
    state: tauri::State<'_, AppState>,
    session_token: String,
    payload: AppSettings,
) -> Result<(), String> {
    crate::auth::guard::validate_admin(&state, &session_token)?;

    let kvs = vec![
        ("company.store_name", payload.company.store_name),
        ("company.address", payload.company.address),
        ("company.phone", payload.company.phone),
        ("company.email", payload.company.email),
        ("company.website", payload.company.website),
        ("company.logo_path", payload.company.logo_path),
        ("company.tax_number", payload.company.tax_number),
        (
            "receipt.show_logo",
            if payload.receipt.show_logo {
                "1".into()
            } else {
                "0".into()
            },
        ),
        ("receipt.header_text", payload.receipt.header_text),
        ("receipt.footer_text", payload.receipt.footer_text),
        (
            "receipt.show_cashier_name",
            if payload.receipt.show_cashier_name {
                "1".into()
            } else {
                "0".into()
            },
        ),
        (
            "receipt.show_tax_detail",
            if payload.receipt.show_tax_detail {
                "1".into()
            } else {
                "0".into()
            },
        ),
        (
            "receipt.show_discount_detail",
            if payload.receipt.show_discount_detail {
                "1".into()
            } else {
                "0".into()
            },
        ),
        ("receipt.paper_width", payload.receipt.paper_width),
        ("receipt.copies", payload.receipt.copies.to_string()),
        (
            "tax.is_enabled",
            if payload.tax.is_enabled {
                "1".into()
            } else {
                "0".into()
            },
        ),
        ("tax.rate", payload.tax.rate.to_string()),
        ("tax.label", payload.tax.label),
        (
            "tax.is_included",
            if payload.tax.is_included {
                "1".into()
            } else {
                "0".into()
            },
        ),
        (
            "app.low_stock_threshold",
            payload.low_stock_threshold.to_string(),
        ),
        ("app.printer_port", payload.printer_port),
        ("app.timezone", payload.timezone),
    ];

    let mut tx = state.db.begin().await.map_err(|e| e.to_string())?;

    for (k, v) in kvs {
        sqlx::query("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?")
            .bind(&k)
            .bind(&v)
            .bind(&v)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(())
}

/// Simpan logo toko — copy file ke AppData dan simpan path-nya (Admin only)
#[tauri::command]
pub async fn save_logo(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    session_token: String,
    file_path: String,
) -> Result<String, String> {
    crate::auth::guard::validate_admin(&state, &session_token)?;

    let source = std::path::Path::new(&file_path);
    if !source.exists() {
        return Err("File tidak ditemukan".into());
    }

    // Validasi ekstensi
    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    if ext != "png" && ext != "jpg" && ext != "jpeg" {
        return Err("Format file harus PNG atau JPG".into());
    }

    // Validasi ukuran (max 2MB)
    let metadata = std::fs::metadata(source).map_err(|e| e.to_string())?;
    if metadata.len() > 2 * 1024 * 1024 {
        return Err("Ukuran file maksimal 2MB".into());
    }

    // Copy ke AppData
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let logo_dir = app_data_dir.join("assets");
    std::fs::create_dir_all(&logo_dir).map_err(|e| e.to_string())?;

    let dest_path = logo_dir.join(format!("logo.{}", ext));
    std::fs::copy(source, &dest_path).map_err(|e| e.to_string())?;

    let dest_str = dest_path.to_string_lossy().to_string();

    // Simpan path di settings
    sqlx::query("INSERT INTO settings (key, value) VALUES ('company.logo_path', ?) ON CONFLICT(key) DO UPDATE SET value = ?")
        .bind(&dest_str)
        .bind(&dest_str)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(dest_str)
}

/// Cetak struk - mock untuk sekarang, bisa di integrasikan escpos-rs nanti
#[tauri::command]
pub async fn print_receipt(
    state: tauri::State<'_, AppState>,
    session_token: String,
    transaction_id: String,
) -> Result<(), String> {
    crate::auth::guard::validate_session(&state, &session_token)?;
    // TODO: Integrasi printer nyata
    println!("Printing receipt for transaction: {}", transaction_id);
    Ok(())
}

/// Test printer koneksi - mock
#[tauri::command]
pub async fn test_print(
    state: tauri::State<'_, AppState>,
    session_token: String,
) -> Result<(), String> {
    crate::auth::guard::validate_admin(&state, &session_token)?;
    // TODO: Integrasi test print nyata
    println!("Test printing...");
    Ok(())
}
