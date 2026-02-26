use crate::models::settings::{AppSettings, CompanyProfile, ReceiptSettings, TaxSettings};
use crate::AppState;
use std::collections::HashMap;
use tauri::Manager;

// ============================================================================
// CONSTANTS - ESC/POS Commands
// ============================================================================
const ESC_POS_INIT: &[u8] = b"\x1B\x40";           // ESC @ - Initialize
const ESC_POS_CENTER: &[u8] = b"\x1B\x61\x01";     // ESC a 1 - Center alignment
const ESC_POS_LEFT: &[u8] = b"\x1B\x61\x00";       // ESC a 0 - Left alignment
const ESC_POS_BOLD_ON: &[u8] = b"\x1B\x45\x01";    // ESC E 1 - Bold ON
const ESC_POS_BOLD_OFF: &[u8] = b"\x1B\x45\x00";   // ESC E 0 - Bold OFF
const ESC_POS_DOUBLE_WIDTH: &[u8] = b"\x1D\x21\x11"; // GS ! 0x11 - Double width+height
const ESC_POS_NORMAL: &[u8] = b"\x1D\x21\x00";     // GS ! 0x00 - Normal size
const ESC_POS_CUT: &[u8] = b"\x1D\x56\x41";        // GS V A - Full cut

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Helper: create Command yang TIDAK muncul console window di Windows
#[cfg(target_os = "windows")]
fn win_cmd(program: &str) -> std::process::Command {
    use std::os::windows::process::CommandExt;
    let mut cmd = std::process::Command::new(program);
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    cmd
}

/// Convert boolean to database string ("1" or "0")
#[inline]
fn bool_to_db(b: bool) -> &'static str {
    if b { "1" } else { "0" }
}

/// Create temporary file path with unique name
fn create_temp_file(extension: &str) -> std::path::PathBuf {
    use std::time::SystemTime;
    std::env::temp_dir().join(format!(
        "pos_print_{}_{}.{}",
        std::process::id(),
        SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis(),
        extension
    ))
}

/// Format number with thousand separator (optimized)
fn format_number(n: i64) -> String {
    let s = n.abs().to_string();
    let len = s.len();
    let mut result = String::with_capacity(len + len / 3);
    for (i, c) in s.chars().enumerate() {
        if i > 0 && (len - i) % 3 == 0 {
            result.push('.');
        }
        result.push(c);
    }
    if n < 0 { result.insert(0, '-'); }
    result
}

/// RAII wrapper for temporary file cleanup
struct TempFile(std::path::PathBuf);
impl TempFile {
    fn new(extension: &str) -> Self {
        TempFile(create_temp_file(extension))
    }
    fn path(&self) -> &std::path::Path {
        &self.0
    }
}
impl Drop for TempFile {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

/// Generate HTML for receipt (single source of truth)
fn generate_receipt_html(html_content: &str, transaction_id: &str, include_instructions: bool) -> String {
    let print_instructions = if include_instructions {
        r#"<div class="print-instructions" id="printInstructions">
        <h3>📄 Export ke PDF</h3>
        <ol>
            <li>Klik tombol "Print" di bawah</li>
            <li>Pilih "Save as PDF" atau "Microsoft Print to PDF"</li>
            <li>Pilih lokasi penyimpanan</li>
            <li>Klik "Save"</li>
        </ol>
        <button class="btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
        <button class="btn" onclick="document.getElementById('printInstructions').style.display='none'" style="background:#6c757d;margin-left:5px;">Sembunyikan Panduan</button>
    </div>
    <script>
        setTimeout(() => {
            const instructions = document.getElementById('printInstructions');
            if (instructions) { instructions.style.opacity = '0.5'; }
        }, 5000);
    </script>"#
    } else {
        ""
    };

    format!(r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Struk Penjualan - {transaction_id}</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        @page {{ size: auto; margin: 0; }}
        body {{
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            line-height: 1.4;
            color: #000;
            background: #fff;
            width: 58mm;
            min-height: 100vh;
            padding: 3mm;
        }}
        .receipt-container {{ width: 100%; max-width: 58mm; margin: 0 auto; }}
        .header {{ text-align: center; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 10px; }}
        .store-name {{ font-size: 16px; font-weight: bold; margin-bottom: 5px; }}
        .store-info {{ font-size: 10px; margin-bottom: 3px; }}
        .divider {{ border-bottom: 1px dashed #000; margin: 8px 0; }}
        .divider-double {{ border-bottom: 2px solid #000; margin: 8px 0; }}
        .items-table {{ width: 100%; border-collapse: collapse; margin: 8px 0; }}
        .items-table th {{ text-align: left; border-bottom: 1px solid #000; padding: 4px 0; font-size: 11px; }}
        .items-table td {{ padding: 4px 0; vertical-align: top; }}
        .item-name {{ width: 55%; }}
        .item-qty {{ width: 15%; text-align: center; }}
        .item-price {{ width: 30%; text-align: right; }}
        .totals {{ margin-top: 10px; }}
        .totals-row {{ display: flex; justify-content: space-between; margin: 3px 0; }}
        .totals-row.total {{ font-weight: bold; font-size: 14px; border-top: 1px solid #000; padding-top: 5px; margin-top: 5px; }}
        .footer {{ text-align: center; margin-top: 15px; font-size: 10px; }}
        .barcode {{ text-align: center; margin: 10px 0; font-family: 'Libre Barcode 39 Text', cursive; font-size: 18px; }}
        @media print {{ body {{ width: 58mm; padding: 0; }} .receipt-container {{ width: 100%; }} }}
        .print-instructions {{ position: fixed; top: 10px; right: 10px; background: #f0f0f0; padding: 15px; border-radius: 5px; font-family: Arial, sans-serif; font-size: 12px; max-width: 300px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); }}
        .print-instructions h3 {{ margin-bottom: 10px; color: #333; }}
        .print-instructions ol {{ margin-left: 20px; }}
        .print-instructions li {{ margin: 5px 0; }}
        .print-instructions .btn {{ display: inline-block; background: #007bff; color: white; padding: 8px 16px; border-radius: 4px; text-decoration: none; margin-top: 10px; cursor: pointer; }}
        .print-instructions .btn:hover {{ background: #0056b3; }}
    </style>
</head>
<body>
    {print_instructions}
    <div class="receipt-container">
        {html_content}
    </div>
</body>
</html>"#, transaction_id = transaction_id, html_content = html_content, print_instructions = print_instructions)
}

// ============================================================================
// MAIN COMMANDS
// ============================================================================

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
        // Company
        ("company.store_name", payload.company.store_name),
        ("company.address", payload.company.address),
        ("company.phone", payload.company.phone),
        ("company.email", payload.company.email),
        ("company.website", payload.company.website),
        ("company.logo_path", payload.company.logo_path),
        ("company.tax_number", payload.company.tax_number),
        // Receipt
        ("receipt.show_logo", bool_to_db(payload.receipt.show_logo).to_string()),
        ("receipt.header_text", payload.receipt.header_text),
        ("receipt.footer_text", payload.receipt.footer_text),
        ("receipt.show_cashier_name", bool_to_db(payload.receipt.show_cashier_name).to_string()),
        ("receipt.show_tax_detail", bool_to_db(payload.receipt.show_tax_detail).to_string()),
        ("receipt.show_discount_detail", bool_to_db(payload.receipt.show_discount_detail).to_string()),
        ("receipt.paper_width", payload.receipt.paper_width),
        ("receipt.copies", payload.receipt.copies.to_string()),
        // Tax
        ("tax.is_enabled", bool_to_db(payload.tax.is_enabled).to_string()),
        ("tax.rate", payload.tax.rate.to_string()),
        ("tax.label", payload.tax.label),
        ("tax.is_included", bool_to_db(payload.tax.is_included).to_string()),
        // App
        ("app.low_stock_threshold", payload.low_stock_threshold.to_string()),
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
    let mut seen_paths: std::collections::HashSet<String> = std::collections::HashSet::new();

    eprintln!("[PRINTER SCAN] Starting cross-platform printer scan...");

    // ── Step 1: serialport crate — native cross-platform serial/USB detection ──
    // Works on Linux, macOS, and Windows automatically
    match serialport::available_ports() {
        Ok(serial_ports) => {
            eprintln!("[PRINTER SCAN] serialport found {} ports", serial_ports.len());
            for sp in serial_ports {
                let port_type_desc = match &sp.port_type {
                    serialport::SerialPortType::UsbPort(info) => {
                        let product = info.product.as_deref().unwrap_or("Unknown");
                        let manufacturer = info.manufacturer.as_deref().unwrap_or("");
                        if manufacturer.is_empty() {
                            format!("USB: {}", product)
                        } else {
                            format!("USB: {} ({})", product, manufacturer)
                        }
                    }
                    serialport::SerialPortType::PciPort => "PCI Serial".to_string(),
                    serialport::SerialPortType::BluetoothPort => "Bluetooth Serial".to_string(),
                    serialport::SerialPortType::Unknown => "Serial Port".to_string(),
                };

                let path = sp.port_name.clone();
                
                // Check write permission on Unix
                #[cfg(unix)]
                let permission_info = {
                    use std::os::unix::fs::PermissionsExt;
                    match std::fs::metadata(&path) {
                        Ok(meta) => {
                            let mode = meta.permissions().mode();
                            let has_write = (mode & 0o002) != 0 || (mode & 0o020) != 0;
                            if has_write { " ✓" } else { " ✗ (butuh: sudo usermod -aG dialout,lp $USER)" }
                        }
                        Err(_) => " ⚠"
                    }
                };
                #[cfg(not(unix))]
                let permission_info = "";

                seen_paths.insert(path.clone());
                ports.push(PrinterPort {
                    path: format!("serial:{}", path),
                    description: format!("{} — {}{}", port_type_desc, path, permission_info),
                });
            }
        }
        Err(e) => {
            eprintln!("[PRINTER SCAN] serialport scan error: {}", e);
        }
    }

    // ── Step 2: USB Printer class devices (Linux /dev/usb/lp*) ──
    // These are NOT serial ports — they are USB printer class devices
    // serialport won't find them, we must check manually
    #[cfg(target_os = "linux")]
    {
        use std::os::unix::fs::PermissionsExt;
        for i in 0..10 {
            let path = format!("/dev/usb/lp{}", i);
            if !seen_paths.contains(&path) {
                if let Ok(meta) = std::fs::metadata(&path) {
                    let mode = meta.permissions().mode();
                    let has_write = (mode & 0o002) != 0 || (mode & 0o020) != 0;
                    let status = if has_write { "✓ ready" } else { "✗ butuh: sudo usermod -aG lp $USER" };
                    seen_paths.insert(path.clone());
                    ports.push(PrinterPort {
                        path: path.clone(),
                        description: format!("USB Printer Direct — {} ({})", path, status),
                    });
                }
            }
        }
    }

    // ── Step 3: CUPS printers (Linux & macOS) ──
    #[cfg(unix)]
    {
        eprintln!("[PRINTER SCAN] Checking CUPS printers...");
        if let Ok(output) = std::process::Command::new("lpstat")
            .arg("-p")
            .output()
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                for line in stdout.lines() {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 2 {
                        let name = parts[1];
                        // Extract status from lpstat output
                        let status = if line.contains("idle") {
                            "✓ idle"
                        } else if line.contains("disabled") {
                            "⚠ disabled"
                        } else if line.contains("printing") {
                            "🖨 printing"
                        } else {
                            "?"
                        };
                        ports.push(PrinterPort {
                            path: format!("cups:{}", name),
                            description: format!("CUPS: {} ({})", name, status),
                        });
                    }
                }
                eprintln!("[PRINTER SCAN] CUPS scan complete");
            } else {
                eprintln!("[PRINTER SCAN] lpstat failed — CUPS mungkin belum terinstall");
            }
        } else {
            eprintln!("[PRINTER SCAN] lpstat not found — CUPS not installed");
        }

        // Check user groups for permission
        #[cfg(target_os = "linux")]
        if let Ok(user) = std::env::var("USER") {
            if let Ok(output) = std::process::Command::new("groups").arg(&user).output() {
                let groups = String::from_utf8_lossy(&output.stdout);
                let missing: Vec<&str> = ["lp", "dialout"].iter()
                    .filter(|g| !groups.contains(**g))
                    .copied()
                    .collect();
                if !missing.is_empty() {
                    eprintln!("[PRINTER WARNING] User '{}' tidak di group: {}. Run: sudo usermod -aG {} $USER",
                        user, missing.join(", "), missing.join(","));
                }
            }
        }
    }

    // ── Step 4: Windows Print Spooler ──
    #[cfg(target_os = "windows")]
    {
        eprintln!("[PRINTER SCAN] Scanning Windows Print Spooler...");
        
        // Method A: PowerShell Get-Printer (Windows 8+)
        let ps_result = win_cmd("powershell")
            .args(["-NoProfile", "-Command", 
                "Get-Printer | Select-Object -Property Name,DriverName,PortName,PrinterStatus | Format-List"])
            .output();
        
        let mut found_spooler = false;
        if let Ok(output) = ps_result {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let mut current_name = String::new();
                let mut current_driver = String::new();
                let mut current_port_name = String::new();
                
                let process_entry = |name: &str, driver: &str, port_name: &str, ports: &mut Vec<PrinterPort>| {
                    if name.is_empty() { return; }
                    let nl = name.to_lowercase();
                    let is_virtual = nl.contains("pdf") || nl.contains("xps")
                        || nl.contains("onenote") || nl.contains("fax")
                        || nl.contains("microsoft print");
                    if !is_virtual {
                        ports.push(PrinterPort {
                            path: format!("winprint:{}", name),
                            description: format!("🖨️ {} (Driver: {}, Port: {})", name, driver, port_name),
                        });
                    }
                };

                for line in stdout.lines() {
                    let line = line.trim();
                    if let Some(val) = line.strip_prefix("Name") {
                        current_name = val.trim().trim_start_matches(':').trim().to_string();
                    } else if let Some(val) = line.strip_prefix("DriverName") {
                        current_driver = val.trim().trim_start_matches(':').trim().to_string();
                    } else if let Some(val) = line.strip_prefix("PortName") {
                        current_port_name = val.trim().trim_start_matches(':').trim().to_string();
                    } else if line.is_empty() && !current_name.is_empty() {
                        process_entry(&current_name, &current_driver, &current_port_name, &mut ports);
                        current_name.clear();
                        current_driver.clear();
                        current_port_name.clear();
                    }
                }
                process_entry(&current_name, &current_driver, &current_port_name, &mut ports);
                found_spooler = true;
                eprintln!("[PRINTER SCAN] Found printers via PowerShell");
            }
        }
        
        // Method B: wmic fallback
        if !found_spooler {
            if let Ok(output) = win_cmd("wmic")
                .args(["printer", "get", "Name,PortName,DriverName", "/format:csv"])
                .output()
            {
                if output.status.success() {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    for line in stdout.lines().skip(1) {
                        let fields: Vec<&str> = line.split(',').collect();
                        if fields.len() >= 4 {
                            let driver = fields[1].trim();
                            let name = fields[2].trim();
                            let port_name = fields[3].trim();
                            if name.is_empty() { continue; }
                            let nl = name.to_lowercase();
                            let is_virtual = nl.contains("pdf") || nl.contains("xps")
                                || nl.contains("onenote") || nl.contains("fax")
                                || nl.contains("microsoft print");
                            if !is_virtual {
                                ports.push(PrinterPort {
                                    path: format!("winprint:{}", name),
                                    description: format!("🖨️ {} (Driver: {}, Port: {})", name, driver, port_name),
                                });
                            }
                        }
                    }
                    eprintln!("[PRINTER SCAN] Found printers via wmic");
                }
            }
        }
    }

    // ── Step 5: Options tambahan ──
    ports.push(PrinterPort {
        path: "network".to_string(),
        description: "🌐 Network Printer (TCP/IP — masukkan IP:PORT, contoh: 192.168.1.100:9100)".to_string(),
    });
    
    ports.push(PrinterPort {
        path: "manual".to_string(),
        description: "✏️ Manual — Ketik nama printer / path device secara manual".to_string(),
    });

    eprintln!("[PRINTER SCAN] Total {} printers found", ports.len());
    Ok(ports)
}

/// Print HTML receipt via Windows Print Spooler (for regular printers)
#[tauri::command]
pub async fn print_receipt_windows(
    state: tauri::State<'_, AppState>,
    session_token: String,
    _html_content: String,
    _printer_name: Option<String>,
) -> Result<(), String> {
    crate::auth::guard::validate_session(&state, &session_token)?;

    #[cfg(target_os = "windows")]
    {
        print_via_windows_html(&_html_content, _printer_name.as_deref()).await
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Windows printing hanya tersedia di Windows. Untuk printer biasa, gunakan browser print (Ctrl+P).".into())
    }
}

/// Export receipt to PDF file
#[tauri::command]
pub async fn export_receipt_pdf(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    session_token: String,
    html_content: String,
    transaction_id: String,
) -> Result<String, String> {
    crate::auth::guard::validate_session(&state, &session_token)?;

    // Get documents directory
    let docs_dir = app_handle
        .path()
        .document_dir()
        .map_err(|e| format!("Gagal akses folder Documents: {}", e))?;

    let receipts_dir = docs_dir.join("POS-Kasir-Receipts");
    std::fs::create_dir_all(&receipts_dir)
        .map_err(|e| format!("Gagal buat folder: {}", e))?;

    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let tx_prefix = transaction_id.split('-').next().unwrap_or("TX");

    // Generate HTML with instructions (for interactive use)
    let filename = format!("Struk_{}_{}.pdf.html", tx_prefix, timestamp);
    let file_path = receipts_dir.join(&filename);
    let full_html = generate_receipt_html(&html_content, &transaction_id, true);
    std::fs::write(&file_path, &full_html)
        .map_err(|e| format!("Gagal simpan file: {}", e))?;

    // Generate plain HTML (for batch printing)
    let plain_filename = format!("Struk_{}_{}_plain.html", tx_prefix, timestamp);
    let plain_path = receipts_dir.join(&plain_filename);
    let plain_html = generate_receipt_html(&html_content, &transaction_id, false);
    std::fs::write(&plain_path, &plain_html)
        .map_err(|e| format!("Gagal simpan file plain: {}", e))?;

    Ok(format!("File tersimpan di:\n\n1. {}\n   (dengan panduan print)\n\n2. {}\n   (tanpa panduan, siap print)", 
        file_path.to_string_lossy(), 
        plain_path.to_string_lossy()))
}

/// Print receipt via ESC/POS (thermal printer)
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
    let mut esc: Vec<u8> = Vec::with_capacity(1024);

    // Init printer
    esc.extend_from_slice(ESC_POS_INIT);

    // Center align
    esc.extend_from_slice(ESC_POS_CENTER);

    // Bold + Double height for store name
    esc.extend_from_slice(ESC_POS_BOLD_ON);
    esc.extend_from_slice(ESC_POS_DOUBLE_WIDTH);
    esc.extend_from_slice(store_name.as_bytes());
    esc.push(b'\n');

    // Reset size
    esc.extend_from_slice(ESC_POS_NORMAL);
    esc.extend_from_slice(ESC_POS_BOLD_OFF);

    if !address.is_empty() {
        esc.extend_from_slice(address.as_bytes());
        esc.push(b'\n');
    }

    // Separator
    esc.extend_from_slice(b"================================\n");

    // Left align for items
    esc.extend_from_slice(ESC_POS_LEFT);

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
    esc.extend_from_slice(ESC_POS_CENTER);
    esc.extend_from_slice(footer.as_bytes());
    esc.push(b'\n');
    esc.push(b'\n');

    // Cut paper (thermal)
    esc.extend_from_slice(ESC_POS_CUT);
    esc.extend_from_slice(b"\x03"); // Partial cut
    esc.extend_from_slice(b"\n\n\n");

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
    let mut esc: Vec<u8> = Vec::with_capacity(512);
    esc.extend_from_slice(ESC_POS_INIT);
    esc.extend_from_slice(ESC_POS_CENTER);
    esc.extend_from_slice(ESC_POS_BOLD_ON);
    esc.extend_from_slice(ESC_POS_DOUBLE_WIDTH);
    esc.extend_from_slice(b"TEST PRINT\n");
    esc.extend_from_slice(ESC_POS_NORMAL);
    esc.extend_from_slice(ESC_POS_BOLD_OFF);
    esc.extend_from_slice(b"================================\n");
    esc.extend_from_slice(b"Printer berhasil terhubung!\n");
    esc.extend_from_slice(b"POS Kasir Alpiant\n");
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    esc.extend_from_slice(format!("{}\n", now).as_bytes());
    esc.extend_from_slice(b"================================\n\n\n");
    esc.extend_from_slice(ESC_POS_CUT);
    esc.extend_from_slice(b"\x03"); // Partial cut
    esc.extend_from_slice(b"\n\n\n");

    send_to_printer(&port, &esc).await?;

    Ok(())
}

/// Cetak label barcode via printer thermal (ESC/POS native barcode)
#[tauri::command]
pub async fn print_barcode_labels(
    state: tauri::State<'_, AppState>,
    session_token: String,
    labels: Vec<BarcodeLabelItem>,
) -> Result<(), String> {
    crate::auth::guard::validate_admin(&state, &session_token)?;

    let port = get_printer_port(&state).await?;
    if port.is_empty() {
        return Err("Printer belum dikonfigurasi. Silakan atur di Settings → Hardware.".into());
    }

    if labels.is_empty() {
        return Err("Tidak ada label untuk dicetak.".into());
    }

    let mut esc: Vec<u8> = Vec::with_capacity(labels.len() * 200);

    // Init printer
    esc.extend_from_slice(ESC_POS_INIT);

    for label in &labels {
        for _ in 0..label.qty {
            // Center align
            esc.extend_from_slice(ESC_POS_CENTER);

            // Product name (bold)
            esc.extend_from_slice(ESC_POS_BOLD_ON);
            let name: String = label.name.chars().take(24).collect();
            esc.extend_from_slice(name.as_bytes());
            esc.push(b'\n');
            esc.extend_from_slice(ESC_POS_BOLD_OFF);

            // Price
            let price_str = format!("Rp {}", format_number(label.price as i64));
            esc.extend_from_slice(price_str.as_bytes());
            esc.push(b'\n');

            // Barcode settings
            esc.extend_from_slice(b"\x1D\x48\x02"); // GS H 2 — HRI below barcode
            esc.extend_from_slice(b"\x1D\x68\x50"); // GS h 80 — Barcode height 80 dots
            esc.extend_from_slice(b"\x1D\x77\x02"); // GS w 2 — Barcode width multiplier

            // Print barcode
            let barcode = &label.barcode;
            if barcode.len() == 13 {
                // EAN-13
                esc.extend_from_slice(b"\x1D\x6B\x43"); // GS k C (CODE 67 = EAN13)
                esc.push(barcode.len() as u8);
                esc.extend_from_slice(barcode.as_bytes());
            } else {
                // Code128 for arbitrary length
                esc.extend_from_slice(b"\x1D\x6B\x49"); // GS k I (CODE 73 = CODE128)
                esc.push(barcode.len() as u8);
                esc.extend_from_slice(barcode.as_bytes());
            }
            esc.push(b'\n');

            // Separator between labels
            esc.extend_from_slice(b"--------------------------------\n");
        }
    }

    // Feed and cut
    esc.extend_from_slice(b"\n\n");
    esc.extend_from_slice(ESC_POS_CUT);
    esc.extend_from_slice(b"\x03"); // Partial cut
    esc.extend_from_slice(b"\n\n\n");

    send_to_printer(&port, &esc).await?;

    eprintln!("[PRINTER] Barcode labels printed: {} items", labels.len());
    Ok(())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BarcodeLabelItem {
    pub name: String,
    pub price: f64,
    pub barcode: String,
    pub qty: u32,
}

// ──────── Helper Functions ────────

/// Print via CUPS (Linux/macOS)
#[cfg(unix)]
async fn print_via_cups(printer_name: &str, data: &[u8]) -> Result<(), String> {
    use std::io::Write;

    eprintln!("[PRINTER CUPS] Printing to CUPS printer: {}", printer_name);

    // Create temporary file with RAII cleanup
    let temp_file = TempFile::new("bin");

    // Write data to temp file
    let mut file = std::fs::File::create(temp_file.path())
        .map_err(|e| format!("Gagal buat file temporary: {}", e))?;
    file.write_all(data)
        .map_err(|e| format!("Gagal tulis data: {}", e))?;
    drop(file);

    // Use lp command to print with raw option for ESC/POS data
    let output = std::process::Command::new("lp")
        .arg("-d")
        .arg(printer_name)
        .arg("-o")
        .arg("raw")
        .arg(temp_file.path())
        .output()
        .map_err(|e| format!("Gagal jalankan lp command: {}. Pastikan CUPS terinstall.", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("CUPS error: {}", stderr));
    }

    eprintln!("[PRINTER CUPS] Print job sent successfully");
    Ok(())
}

/// Print via Windows Print Spooler
#[cfg(target_os = "windows")]
async fn print_via_windows_spooler(printer_name: &str, data: &[u8]) -> Result<(), String> {
    use std::io::Write;

    eprintln!("[PRINTER WIN] Printing to Windows printer: {}", printer_name);

    // Create temporary file with RAII cleanup
    let temp_file = TempFile::new("bin");

    // Write ESC/POS data to temp file
    let mut file = std::fs::File::create(temp_file.path())
        .map_err(|e| format!("Gagal buat file temporary: {}", e))?;
    file.write_all(data)
        .map_err(|e| format!("Gagal tulis data: {}", e))?;
    drop(file);

    let temp_path_str = temp_file.path().to_string_lossy().to_string();

    // Method 1: PowerShell Out-Printer (most reliable for Windows 10/11)
    let ps_result = win_cmd("powershell")
        .args(["-NoProfile", "-Command",
            &format!("Get-Content -Encoding Byte -Path '{}' | Out-Printer -Name '{}'", temp_path_str, printer_name)])
        .output();

    if let Ok(output) = ps_result {
        if output.status.success() {
            eprintln!("[PRINTER WIN] Print job sent via PowerShell Out-Printer");
            return Ok(());
        }
        let stderr = String::from_utf8_lossy(&output.stderr);
        eprintln!("[PRINTER WIN] PowerShell Out-Printer failed: {}, trying copy method...", stderr);
    }

    // Method 2: Try direct file copy to printer (for USB thermal printers)
    let copy_result = win_cmd("cmd")
        .args(["/C", &format!("copy /b \"{}\" \"{}\"", temp_path_str, printer_name)])
        .output();

    if let Ok(output) = copy_result {
        if output.status.success() {
            eprintln!("[PRINTER WIN] Print job sent via copy /b");
            return Ok(());
        }
        let stderr = String::from_utf8_lossy(&output.stderr);
        eprintln!("[PRINTER WIN] copy /b failed: {}, trying print command...", stderr);
    }

    // Method 3: Fallback to `print` command (legacy)
    let print_result = win_cmd("cmd")
        .args(["/C", &format!("print /d:\"{}\" \"{}\"", printer_name, temp_path_str)])
        .output();

    if let Ok(output) = print_result {
        if output.status.success() {
            eprintln!("[PRINTER WIN] Print job sent via print command");
            return Ok(());
        }
        let stderr = String::from_utf8_lossy(&output.stderr);
        eprintln!("[PRINTER WIN] print command failed: {}", stderr);

        return Err(format!(
            "Gagal cetak ke printer '{}'!\n\n\
             Pastikan:\n\
             1. Printer '{}' terdaftar di Windows (Settings → Printers & scanners)\n\
             2. Nama printer sesuai (case-sensitive)\n\
             3. Printer menyala dan terhubung\n\
             4. Driver printer terinstall dengan benar\n\n\
             Error: {}", printer_name, printer_name, stderr
        ));
    }

    Err(format!("Tidak dapat mengirim ke printer '{}'. Pastikan printer terdaftar dan menyala.", printer_name))
}

/// Print HTML content via Windows Print Spooler
#[cfg(target_os = "windows")]
async fn print_via_windows_html(html_content: &str, printer_name: Option<&str>) -> Result<(), String> {
    use std::io::Write;

    let printer = printer_name.unwrap_or("POS-58");
    eprintln!("[PRINTER WIN HTML] Printing HTML to Windows printer: {}", printer);

    // Create temporary file with RAII cleanup
    let temp_file = TempFile::new("html");

    // Write HTML data to temp file
    let mut file = std::fs::File::create(temp_file.path())
        .map_err(|e| format!("Gagal buat file temporary: {}", e))?;
    file.write_all(html_content.as_bytes())
        .map_err(|e| format!("Gagal tulis data: {}", e))?;
    drop(file);

    let temp_path_str = temp_file.path().to_string_lossy().to_string();

    // Method 1: Try using start command to print HTML file
    let start_result = win_cmd("cmd")
        .args(["/C", &format!("start /w \"\" print /D:\"{}\" \"{}\"", printer, temp_path_str)])
        .output();

    if let Ok(output) = start_result {
        if output.status.success() {
            eprintln!("[PRINTER WIN HTML] Print job sent via start command");
            return Ok(());
        }
        let stderr = String::from_utf8_lossy(&output.stderr);
        eprintln!("[PRINTER WIN HTML] start command failed: {}, trying alternative...", stderr);
    }

    // Method 2: Try PowerShell with Word/IE automation fallback
    let ps_result = win_cmd("powershell")
        .args(["-NoProfile", "-Command",
            &format!("$ie = New-Object -ComObject InternetExplorer.Application; $ie.Navigate('{}'); Start-Sleep -Seconds 2; $ie.ExecWB(6, 1); $ie.Quit(); $ie = $null", temp_path_str)])
        .output();

    if let Ok(output) = ps_result {
        if output.status.success() {
            eprintln!("[PRINTER WIN HTML] Print job sent via PowerShell IE automation");
            return Ok(());
        }
        let stderr = String::from_utf8_lossy(&output.stderr);
        eprintln!("[PRINTER WIN HTML] PowerShell method failed: {}", stderr);
    }

    // Fallback: return success with warning (user can print manually)
    eprintln!("[PRINTER WIN HTML] All automated methods failed, but HTML file saved at: {}", temp_path_str);
    Ok(())
}

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

async fn send_to_printer(port: &str, data: &[u8]) -> Result<(), String> {
    eprintln!("[PRINTER] Sending {} bytes to port: {}", data.len(), port);
    
    // Route 1: CUPS printer (Linux/macOS)
    if port.starts_with("cups:") {
        #[cfg(unix)]
        {
            let printer_name = port.trim_start_matches("cups:");
            return print_via_cups(printer_name, data).await;
        }
        #[cfg(not(unix))]
        {
            return Err("CUPS printing hanya didukung di Linux/macOS".to_string());
        }
    }
    
    // Route 2: Windows Print Spooler
    if port.starts_with("winprint:") {
        #[cfg(target_os = "windows")]
        {
            let printer_name = port.trim_start_matches("winprint:");
            return print_via_windows_spooler(printer_name, data).await;
        }
        #[cfg(not(target_os = "windows"))]
        {
            return Err("Windows printing hanya didukung di Windows".to_string());
        }
    }
    
    // Route 3: Network printer (TCP/IP)
    if port.starts_with("network:") {
        let addr = port.trim_start_matches("network:").trim();
        if !addr.contains(':') {
            return Err(format!("Format alamat network salah: '{}'. Gunakan IP:PORT (contoh: 192.168.1.100:9100)", addr));
        }
        return send_via_network(addr, data).await;
    }
    
    // Route 4: Serial port via serialport crate (cross-platform)
    if port.starts_with("serial:") {
        let device_path = port.trim_start_matches("serial:");
        return send_via_serial(device_path, data);
    }
    
    // Route 5: Direct USB printer class device (Linux /dev/usb/lp*)
    if port.starts_with("/dev/usb/lp") {
        return send_via_device_file(port, data).await;
    }
    
    // Route 6: Legacy — try to detect the best method
    // If it looks like an IP:PORT, try network
    if port.contains(':') && !port.starts_with('/') && !port.starts_with('\\') {
        return send_via_network(port, data).await;
    }
    
    // If it looks like a serial port, try serialport crate
    if port.starts_with("/dev/tty") || port.starts_with("/dev/cu.") || port.starts_with("COM") {
        return send_via_serial(port, data);
    }
    
    // Fallback: direct file write
    send_via_device_file(port, data).await
}

/// Send data via TCP network connection
async fn send_via_network(addr: &str, data: &[u8]) -> Result<(), String> {
    use tokio::io::AsyncWriteExt;
    
    eprintln!("[PRINTER NET] Connecting to {}...", addr);
    
    let stream = tokio::net::TcpStream::connect(addr)
        .await
        .map_err(|e| format!(
            "Gagal koneksi ke printer network {}!\n\n\
             Pastikan:\n\
             1. IP dan Port benar\n\
             2. Printer menyala dan terhubung ke jaringan\n\
             3. Port tidak diblokir firewall\n\n\
             Error: {}", addr, e
        ))?;
    
    let mut stream = stream;
    stream.write_all(data).await
        .map_err(|e| format!("Gagal kirim data ke printer: {}", e))?;
    stream.flush().await
        .map_err(|e| format!("Gagal flush data: {}", e))?;
    
    eprintln!("[PRINTER NET] Sent {} bytes to {}", data.len(), addr);
    Ok(())
}

/// Send data via serial port using serialport crate (proper baud rate, cross-platform)
fn send_via_serial(device_path: &str, data: &[u8]) -> Result<(), String> {
    use std::io::Write;
    use std::time::Duration;
    
    eprintln!("[PRINTER SERIAL] Opening {} with serialport crate...", device_path);
    
    // Standard baud rates for thermal/receipt printers
    // Most common: 9600, 19200, 38400, 115200
    let baud_rates = [9600u32, 19200, 38400, 115200];
    
    // Try primary baud rate first (9600 is the most common for thermal printers)
    let mut last_error = String::new();
    
    for (i, &baud_rate) in baud_rates.iter().enumerate() {
        match serialport::new(device_path, baud_rate)
            .timeout(Duration::from_secs(5))
            .open()
        {
            Ok(mut port) => {
                eprintln!("[PRINTER SERIAL] Connected at {} baud", baud_rate);
                
                // Send data in chunks to avoid buffer overflow
                let chunk_size = 1024;
                for chunk in data.chunks(chunk_size) {
                    port.write_all(chunk).map_err(|e| {
                        format!("Gagal kirim data serial ke {}: {}", device_path, e)
                    })?;
                    // Small delay between chunks for slow printers
                    std::thread::sleep(Duration::from_millis(10));
                }
                
                port.flush().map_err(|e| {
                    format!("Gagal flush data serial: {}", e)
                })?;
                
                eprintln!("[PRINTER SERIAL] Sent {} bytes successfully", data.len());
                return Ok(());
            }
            Err(e) => {
                last_error = e.to_string();
                if i == 0 {
                    // Only retry with different baud rates if the first attempt suggests a connection issue
                    // If it's permission/not-found, don't retry
                    let desc = e.description.to_lowercase();
                    if desc.contains("permission") || desc.contains("not found") || desc.contains("no such") {
                        break;
                    }
                }
                eprintln!("[PRINTER SERIAL] Baud {} failed: {}, trying next...", baud_rate, e);
            }
        }
    }
    
    // Provide helpful error message
    let error_lower = last_error.to_lowercase();
    if error_lower.contains("permission") {
        #[cfg(unix)]
        return Err(format!(
            "Permission denied untuk {}!\n\n\
             Solusi:\n\
             1. sudo usermod -aG dialout,lp $USER\n\
             2. Logout dan login ulang\n\
             3. Atau sementara: sudo chmod 666 {}", device_path, device_path
        ));
        #[cfg(windows)]
        return Err(format!(
            "Permission denied untuk {}! Jalankan aplikasi sebagai Administrator.", device_path
        ));
    }
    if error_lower.contains("not found") || error_lower.contains("no such") {
        return Err(format!(
            "Device {} tidak ditemukan.\n\n\
             Pastikan:\n\
             1. Printer terhubung via USB/Serial\n\
             2. Driver printer terinstall\n\
             3. Kabel USB tidak longgar\n\
             4. Cek port yang benar di Settings → Hardware → Scan Port", device_path
        ));
    }
    
    Err(format!("Gagal koneksi serial ke {}: {}", device_path, last_error))
}

/// Send data via direct device file write (for /dev/usb/lp* and similar devices)
async fn send_via_device_file(port: &str, data: &[u8]) -> Result<(), String> {
    eprintln!("[PRINTER FILE] Writing directly to device: {}", port);
    
    // Permission check on Linux/macOS
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        match tokio::fs::metadata(port).await {
            Ok(meta) => {
                let mode = meta.permissions().mode();
                let has_write = (mode & 0o002) != 0 || (mode & 0o020) != 0;
                if !has_write {
                    eprintln!("[PRINTER WARNING] {} mungkin tidak writable (mode: {:o})", port, mode);
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                return Err(format!("Device {} tidak ditemukan. Pastikan printer terhubung.", port));
            }
            Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => {
                return Err(format!(
                    "Permission denied untuk {}!\n\n\
                     Solusi: sudo usermod -aG lp $USER (lalu logout/login)\
                     \nAtau sementara: sudo chmod 666 {}", port, port
                ));
            }
            Err(_) => {}
        }
    }
    
    tokio::fs::write(port, data)
        .await
        .map_err(|e| {
            match e.kind() {
                std::io::ErrorKind::PermissionDenied => {
                    format!(
                        "Permission denied untuk {}!\n\n\
                         Solusi: sudo usermod -aG lp $USER (lalu logout/login)\
                         \nAtau sementara: sudo chmod 666 {}", port, port
                    )
                }
                std::io::ErrorKind::NotFound => {
                    format!("Device {} tidak ditemukan. Pastikan printer terhubung.", port)
                }
                _ => {
                    format!("Gagal kirim ke printer {}: {}", port, e)
                }
            }
        })?;
    
    eprintln!("[PRINTER FILE] Sent {} bytes to {}", data.len(), port);
    Ok(())
}
