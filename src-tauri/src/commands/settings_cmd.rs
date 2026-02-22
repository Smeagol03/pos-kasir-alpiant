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

/// Scan port printer yang tersedia di sistem
#[tauri::command]
pub async fn list_serial_ports(
    state: tauri::State<'_, AppState>,
    session_token: String,
) -> Result<Vec<PrinterPort>, String> {
    crate::auth::guard::validate_admin(&state, &session_token)?;

    let mut ports: Vec<PrinterPort> = Vec::new();

    // Linux: cek /dev/usb/lp*, /dev/ttyUSB*, /dev/ttyACM*
    #[cfg(target_os = "linux")]
    {
        let patterns = [
            ("/dev/usb/lp", "USB Printer"),
            ("/dev/ttyUSB", "Serial USB"),
            ("/dev/ttyACM", "ACM Serial"),
        ];
        for (prefix, desc) in patterns {
            for i in 0..10 {
                let path = format!("{}{}", prefix, i);
                if std::path::Path::new(&path).exists() {
                    ports.push(PrinterPort {
                        path: path.clone(),
                        description: format!("{} ({})", desc, path),
                    });
                }
            }
        }
    }

    // macOS
    #[cfg(target_os = "macos")]
    {
        if let Ok(entries) = std::fs::read_dir("/dev") {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with("cu.usb") || name.starts_with("tty.usb") {
                    let path = format!("/dev/{}", name);
                    ports.push(PrinterPort {
                        path: path.clone(),
                        description: format!("USB Serial ({})", path),
                    });
                }
            }
        }
    }

    // Windows
    #[cfg(target_os = "windows")]
    {
        for i in 1..20 {
            let path = format!("COM{}", i);
            ports.push(PrinterPort {
                path: path.clone(),
                description: format!("Serial Port ({})", path),
            });
        }
        // USB printer
        for i in 0..5 {
            let path = format!("\\\\.\\USB{}", i);
            ports.push(PrinterPort {
                path: path.clone(),
                description: format!("USB Printer ({})", path),
            });
        }
    }

    // Selalu tambahkan opsi network/IP
    ports.push(PrinterPort {
        path: "network".to_string(),
        description: "Network Printer (TCP/IP — masukkan IP:PORT)".to_string(),
    });

    Ok(ports)
}

/// Cetak struk ke printer ESC/POS
#[tauri::command]
pub async fn print_receipt(
    state: tauri::State<'_, AppState>,
    session_token: String,
    transaction_id: String,
) -> Result<(), String> {
    crate::auth::guard::validate_session(&state, &session_token)?;

    // Ambil printer port dari settings
    let port = get_printer_port(&state).await?;
    if port.is_empty() {
        return Err("Printer belum dikonfigurasi. Silakan atur di Settings → Hardware.".into());
    }

    // Ambil data transaksi
    let tx: Option<(String, f64, f64, f64, String, String)> = sqlx::query_as(
        "SELECT id, total_amount, discount_amount, tax_amount, payment_method, timestamp FROM transactions WHERE id = ?"
    )
    .bind(&transaction_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let tx = tx.ok_or("Transaksi tidak ditemukan")?;

    // Ambil item transaksi
    let items: Vec<(String, i64, f64, f64)> = sqlx::query_as(
        "SELECT p.name, ti.quantity, ti.price_at_time, ti.subtotal FROM transaction_items ti JOIN products p ON ti.product_id = p.id WHERE ti.transaction_id = ?"
    )
    .bind(&transaction_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    // Ambil settings toko
    let store_name = get_setting(&state, "company.store_name").await.unwrap_or("TOKO".to_string());
    let address = get_setting(&state, "company.address").await.unwrap_or_default();
    let footer = get_setting(&state, "receipt.footer_text").await.unwrap_or("Terima Kasih!".to_string());

    // Build ESC/POS receipt
    let mut esc: Vec<u8> = Vec::new();

    // Init printer
    esc.extend_from_slice(b"\x1B\x40"); // ESC @ — Initialize

    // Center align
    esc.extend_from_slice(b"\x1B\x61\x01"); // ESC a 1 — Center

    // Bold + Double height for store name
    esc.extend_from_slice(b"\x1B\x45\x01"); // ESC E 1 — Bold ON
    esc.extend_from_slice(b"\x1D\x21\x11"); // GS ! 0x11 — Double width+height
    esc.extend_from_slice(store_name.as_bytes());
    esc.push(b'\n');

    // Reset size
    esc.extend_from_slice(b"\x1D\x21\x00"); // GS ! 0 — Normal size
    esc.extend_from_slice(b"\x1B\x45\x00"); // ESC E 0 — Bold OFF

    if !address.is_empty() {
        esc.extend_from_slice(address.as_bytes());
        esc.push(b'\n');
    }

    // Separator
    esc.extend_from_slice(b"================================\n");

    // Left align for items
    esc.extend_from_slice(b"\x1B\x61\x00"); // ESC a 0 — Left

    // Transaction info
    esc.extend_from_slice(format!("No: {}\n", &tx.0[..8.min(tx.0.len())]).as_bytes());
    esc.extend_from_slice(format!("Tgl: {}\n", tx.5).as_bytes());
    esc.extend_from_slice(b"--------------------------------\n");

    // Items
    for (name, qty, price, subtotal) in &items {
        let short_name: String = name.chars().take(20).collect();
        esc.extend_from_slice(format!("{} x{}\n", short_name, qty).as_bytes());
        esc.extend_from_slice(format!("  @{:>10} = {:>10}\n",
            format_number(*price as i64),
            format_number(*subtotal as i64),
        ).as_bytes());
    }

    esc.extend_from_slice(b"--------------------------------\n");

    // Totals
    if tx.2 > 0.0 {
        esc.extend_from_slice(format!("Diskon:     {:>10}\n", format_number(tx.2 as i64)).as_bytes());
    }
    if tx.3 > 0.0 {
        esc.extend_from_slice(format!("Pajak:      {:>10}\n", format_number(tx.3 as i64)).as_bytes());
    }
    esc.extend_from_slice(b"\x1B\x45\x01"); // Bold
    esc.extend_from_slice(format!("TOTAL:      {:>10}\n", format_number(tx.1 as i64)).as_bytes());
    esc.extend_from_slice(b"\x1B\x45\x00"); // Bold off
    esc.extend_from_slice(format!("Bayar ({:>4}): {:>10}\n", tx.4, format_number(tx.1 as i64)).as_bytes());

    esc.extend_from_slice(b"================================\n");

    // Footer (center)
    esc.extend_from_slice(b"\x1B\x61\x01"); // Center
    esc.extend_from_slice(footer.as_bytes());
    esc.push(b'\n');
    esc.push(b'\n');

    // Cut paper
    esc.extend_from_slice(b"\x1D\x56\x41\x03"); // GS V A 3 — Partial cut + 3 lines feed

    // Kirim ke printer
    send_to_printer(&port, &esc).await?;

    Ok(())
}

/// Test printer koneksi
#[tauri::command]
pub async fn test_print(
    state: tauri::State<'_, AppState>,
    session_token: String,
) -> Result<(), String> {
    crate::auth::guard::validate_admin(&state, &session_token)?;

    let port = get_printer_port(&state).await?;
    if port.is_empty() {
        return Err("Printer belum dikonfigurasi. Silakan atur di Settings → Hardware.".into());
    }

    // Build test receipt
    let mut esc: Vec<u8> = Vec::new();
    esc.extend_from_slice(b"\x1B\x40"); // Init
    esc.extend_from_slice(b"\x1B\x61\x01"); // Center
    esc.extend_from_slice(b"\x1B\x45\x01"); // Bold
    esc.extend_from_slice(b"\x1D\x21\x11"); // Double
    esc.extend_from_slice(b"TEST PRINT\n");
    esc.extend_from_slice(b"\x1D\x21\x00"); // Reset size
    esc.extend_from_slice(b"\x1B\x45\x00"); // No bold
    esc.extend_from_slice(b"================================\n");
    esc.extend_from_slice(b"Printer berhasil terhubung!\n");
    esc.extend_from_slice(b"POS Kasir Alpiant\n");
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    esc.extend_from_slice(format!("{}\n", now).as_bytes());
    esc.extend_from_slice(b"================================\n\n\n");
    esc.extend_from_slice(b"\x1D\x56\x41\x03"); // Cut

    send_to_printer(&port, &esc).await?;

    Ok(())
}

// ──────── Helper Functions ────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PrinterPort {
    pub path: String,
    pub description: String,
}

async fn get_printer_port(state: &tauri::State<'_, AppState>) -> Result<String, String> {
    let result: Option<(String,)> = sqlx::query_as(
        "SELECT value FROM settings WHERE key = 'app.printer_port'"
    )
    .fetch_optional(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    Ok(result.map(|r| r.0).unwrap_or_default())
}

async fn get_setting(state: &tauri::State<'_, AppState>, key: &str) -> Option<String> {
    let result: Option<(String,)> = sqlx::query_as(
        "SELECT value FROM settings WHERE key = ?"
    )
    .bind(key)
    .fetch_optional(&state.db)
    .await
    .ok()?;
    result.map(|r| r.0)
}

fn format_number(n: i64) -> String {
    let s = n.abs().to_string();
    let mut result = String::new();
    for (i, c) in s.chars().rev().enumerate() {
        if i > 0 && i % 3 == 0 {
            result.push('.');
        }
        result.push(c);
    }
    if n < 0 { result.push('-'); }
    result.chars().rev().collect()
}

async fn send_to_printer(port: &str, data: &[u8]) -> Result<(), String> {
    if port.starts_with("network:") || port.contains(':') {
        // Network printer (IP:PORT)
        let addr = port.trim_start_matches("network:").trim();
        let stream = tokio::net::TcpStream::connect(addr)
            .await
            .map_err(|e| format!("Gagal koneksi ke printer network {}: {}", addr, e))?;
        use tokio::io::AsyncWriteExt;
        let mut stream = stream;
        stream.write_all(data)
            .await
            .map_err(|e| format!("Gagal kirim data ke printer: {}", e))?;
        stream.flush()
            .await
            .map_err(|e| format!("Gagal flush data: {}", e))?;
        Ok(())
    } else {
        // USB/Serial — write langsung ke device file
        tokio::fs::write(port, data)
            .await
            .map_err(|e| format!("Gagal kirim ke printer {}: {}. Pastikan printer menyala dan port benar.", port, e))?;
        Ok(())
    }
}
