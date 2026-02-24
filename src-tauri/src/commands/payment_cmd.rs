use crate::audit::{self, PaymentAuditAction};
use crate::models::payment::{
    MidtransChargeResponse, MidtransStatusResponse, QrisPaymentResponse, QrisStatusResponse,
};
use crate::rate_limiter;
use crate::{encryption, AppState};
use reqwest::Client;
use std::env;
use std::time::Duration;

/// Shared HTTP client with timeout (reuse across requests)
fn http_client() -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(15))
        .connect_timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))
}

/// Credentials dari database (terenkripsi) atau environment variable
struct MidtransCredentials {
    server_key: String,
    base_url: String,
}

/// Ambil Midtrans credentials dari database (prioritas) atau env fallback
async fn get_credentials(state: &AppState) -> Result<MidtransCredentials, String> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT key, value FROM settings WHERE key IN ('payment.midtrans_server_key', 'payment.midtrans_base_url')"
    )
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let map: std::collections::HashMap<String, String> = rows.into_iter().collect();

    let server_key = map.get("payment.midtrans_server_key")
        .and_then(|encrypted| encryption::decrypt(encrypted).ok())
        .or_else(|| env::var("MIDTRANS_SERVER_KEY").ok())
        .ok_or_else(|| "Server key tidak ditemukan. Konfigurasi di Settings → Payment.".to_string())?;

    let base_url = map.get("payment.midtrans_base_url")
        .cloned()
        .or_else(|| env::var("MIDTRANS_BASE_URL").ok())
        .unwrap_or_else(|| "https://api.sandbox.midtrans.com".to_string());

    Ok(MidtransCredentials { server_key, base_url })
}


/// Simpan konfigurasi payment gateway ke database
/// Server Key akan dienkripsi sebelum disimpan
#[tauri::command]
pub async fn save_payment_config(
    state: tauri::State<'_, AppState>,
    session_token: String,
    qris_enabled: bool,
    provider: String,
    midtrans_server_key: String,
    midtrans_base_url: String,
) -> Result<(), String> {
    crate::auth::guard::validate_admin(&state, &session_token)?;

    let mut tx = state.db.begin().await.map_err(|e| e.to_string())?;

    // Encrypt server key before storing
    let encrypted_key = if midtrans_server_key.trim().is_empty() {
        // If empty, keep existing key (don't update)
        let existing: Option<(String,)> = sqlx::query_as("SELECT value FROM settings WHERE key = 'payment.midtrans_server_key'")
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

        if let Some((key,)) = existing {
            key  // Keep existing encrypted key
        } else {
            return Err("Server key tidak boleh kosong untuk konfigurasi baru".to_string());
        }
    } else {
        // Validate server key format
        if !midtrans_server_key.starts_with("Mid-server-") && !midtrans_server_key.starts_with("SB-Mid-server-") {
            return Err("Format Server Key tidak valid. Harus dimulai dengan 'Mid-server-' atau 'SB-Mid-server-'".to_string());
        }
        encryption::encrypt(&midtrans_server_key)
            .map_err(|e| audit::sanitize_error(&e, "save_config_encrypt"))?
    };

    let kvs = vec![
        ("payment.qris_enabled", if qris_enabled { "1" } else { "0" }.to_string()),
        ("payment.provider", provider.clone()),
        ("payment.midtrans_server_key", encrypted_key),
        ("payment.midtrans_base_url", midtrans_base_url.clone()),
    ];

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
    
    // Log audit trail
    let user_id = audit::get_user_id_from_token(&state, &session_token);
    audit::log_payment_action(
        &state.db,
        user_id,
        PaymentAuditAction::SaveConfig,
        &format!("Payment config updated: provider={}, qris_enabled={}", provider, qris_enabled),
        Some(&serde_json::json!({
            "provider": provider,
            "qris_enabled": qris_enabled,
            "base_url": midtrans_base_url
        })),
    ).await;
    
    Ok(())
}

/// Ambil konfigurasi payment gateway dari database
/// PENTING: Server Key TIDAK dikembalikan ke frontend untuk keamanan
#[tauri::command]
pub async fn get_payment_config(
    state: tauri::State<'_, AppState>,
    session_token: String,
) -> Result<serde_json::Value, String> {
    crate::auth::guard::validate_session(&state, &session_token)?;

    let rows: Vec<(String, String)> = sqlx::query_as("SELECT key, value FROM settings WHERE key LIKE 'payment.%'")
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    let map: std::collections::HashMap<String, String> = rows.into_iter().collect();

    // Mask server key untuk display (hanya tampilkan 4 karakter terakhir)
    let server_key_encrypted = map.get("payment.midtrans_server_key").cloned().unwrap_or_default();
    let masked_key = if !server_key_encrypted.is_empty() {
        encryption::decrypt(&server_key_encrypted)
            .map(|key| {
                if key.len() > 8 {
                    format!("****{}", &key[key.len()-4..])
                } else {
                    "****".to_string()
                }
            })
            .unwrap_or_else(|_| "****".to_string())
    } else {
        "".to_string()
    };

    Ok(serde_json::json!({
        "qris_enabled": map.get("payment.qris_enabled").map(|v| v == "1").unwrap_or(true),
        "provider": map.get("payment.provider").cloned().unwrap_or_else(|| "midtrans".to_string()),
        "midtrans_server_key_masked": masked_key,
        "midtrans_base_url": map.get("payment.midtrans_base_url").cloned().unwrap_or_else(|| "https://api.sandbox.midtrans.com".to_string()),
    }))
}

/// Test koneksi ke payment gateway dari backend
#[tauri::command]
pub async fn test_payment_connection(
    state: tauri::State<'_, AppState>,
    session_token: String,
    server_key: String,
    base_url: String,
) -> Result<String, String> {
    if server_key.is_empty() {
        return Err("Server key tidak boleh kosong".to_string());
    }

    let user_id = crate::audit::get_user_id_from_token(&state, &session_token)
        .ok_or("Invalid session")?;
    rate_limiter::TEST_CONNECTION_LIMIT.check(user_id, "test_connection")?;

    let client = http_client()?;
    let response = client
        .get(&format!("{}/v2/TEST-ORDER-NOT-EXIST/status", base_url))
        .basic_auth(&server_key, Some(""))
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                "Koneksi timeout. Periksa koneksi internet Anda.".to_string()
            } else {
                format!("Gagal koneksi: {}", e)
            }
        })?;

    let status = response.status();

    // Log audit trail
    let user_id = audit::get_user_id_from_token(&state, &session_token);
    let success = status.as_u16() == 404 || status.as_u16() == 200;
    audit::log_payment_action(
        &state.db,
        user_id,
        PaymentAuditAction::TestConnection,
        if success { "Payment connection test successful" } else { "Payment connection test failed" },
        Some(&serde_json::json!({
            "base_url": base_url,
            "status_code": status.as_u16(),
            "success": success
        })),
    ).await;

    if status.as_u16() == 404 || status.as_u16() == 200 {
        Ok("Koneksi berhasil! Server key valid.".to_string())
    } else if status.as_u16() == 401 || status.as_u16() == 403 {
        Err("Server key tidak valid. Periksa kembali credentials Anda.".to_string())
    } else {
        Err(format!("Response tidak dikenali (status {})", status.as_u16()))
    }
}

/// Generate QRIS payment QR code via Midtrans
#[tauri::command]
pub async fn generate_qris_payment(
    state: tauri::State<'_, AppState>,
    session_token: String,
    amount: f64,
) -> Result<QrisPaymentResponse, String> {
    // 1. Validasi session
    crate::auth::guard::validate_session(&state, &session_token)?;

    // 2. Rate limiting
    let user_id = crate::audit::get_user_id_from_token(&state, &session_token)
        .ok_or("Invalid session")?;
    rate_limiter::GENERATE_QR_LIMIT.check(user_id, "generate_qr")?;

    // 3. Validasi amount (minimum Rp 1.500 sesuai ketentuan QRIS)
    if amount < 1500.0 {
        return Err("Minimum pembayaran QRIS adalah Rp 1.500".into());
    }

    // 4. Generate unique order_id
    let order_id = format!(
        "QRIS-{}-{}",
        chrono::Utc::now().format("%Y%m%d%H%M%S"),
        &uuid::Uuid::new_v4().to_string()[..8]
    );

    // 5. Ambil credentials
    let creds = get_credentials(&state).await?;

    // 6. Prepare payload Midtrans Charge API (QRIS)
    let payload = serde_json::json!({
        "payment_type": "qris",
        "transaction_details": {
            "order_id": order_id,
            "gross_amount": amount.round() as i64
        }
    });

    // 7. Call Midtrans API
    let client = http_client()?;
    let response = client
        .post(&format!("{}/v2/charge", creds.base_url))
        .basic_auth(&creds.server_key, Some(""))
        .json(&payload)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                "Koneksi ke payment gateway timeout. Coba lagi.".to_string()
            } else {
                audit::sanitize_error(&e.to_string(), "generate_qr_send_request")
            }
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        eprintln!("[PAYMENT ERROR] Midtrans HTTP error {}: {}", status.as_u16(), body);
        return Err(format!("Payment gateway error (HTTP {}). Pastikan fitur QRIS aktif di akun Midtrans.", status.as_u16()));
    }

    // Parse as text first for debugging
    let raw_body = response.text().await
        .map_err(|e| format!("Gagal membaca response: {}", e))?;
    
    eprintln!("[QRIS] Raw Midtrans response: {}", raw_body);

    let midtrans_resp: MidtransChargeResponse = serde_json::from_str(&raw_body)
        .map_err(|e| {
            eprintln!("[PAYMENT ERROR] Failed to parse Midtrans response: {}", e);
            format!("Gagal memproses response dari Midtrans: {}", e)
        })?;

    // Check Midtrans status_code (201 = success, others = error)
    if midtrans_resp.status_code != "201" && midtrans_resp.status_code != "200" {
        let msg = midtrans_resp.status_message.unwrap_or_else(|| "Unknown error".to_string());
        eprintln!("[PAYMENT ERROR] Midtrans error {}: {}", midtrans_resp.status_code, msg);
        return Err(format!("Midtrans: {} ({})", msg, midtrans_resp.status_code));
    }

    // DEBUG: Log response untuk testing — HAPUS baris di bawah ini saat production
    eprintln!("[QRIS] Generated order_id={}, status_code={}", order_id, midtrans_resp.status_code);
    eprintln!("[QRIS] qr_string: {:?}", midtrans_resp.qr_string.as_ref().map(|s| &s[..20.min(s.len())]));
    if let Some(ref actions) = midtrans_resp.actions {
        for a in actions {
            eprintln!("[QRIS] action: name={}, url={}", a.name, a.url);
        }
    }
    // END DEBUG

    // 8. Extract QR string
    let qr_string = midtrans_resp
        .qr_string
        .or_else(|| {
            midtrans_resp.actions.as_ref().and_then(|actions| {
                actions
                    .iter()
                    .find(|a| a.name == "generate-qr-code")
                    .map(|a| a.url.clone())
            })
        })
        .ok_or("QR string tidak ditemukan di response Payment Gateway")?;

    let expires_at = midtrans_resp
        .expiry_time
        .unwrap_or_else(|| {
            // Default 15 menit dari sekarang (UTC+7)
            (chrono::Utc::now() + chrono::Duration::hours(7) + chrono::Duration::minutes(15))
                .format("%Y-%m-%d %H:%M:%S")
                .to_string()
        });

    // 9. Simpan ke database
    sqlx::query(
        "INSERT INTO qris_payments (order_id, amount, qr_string, status, expires_at)
         VALUES (?, ?, ?, 'PENDING', ?)"
    )
    .bind(&order_id)
    .bind(amount)
    .bind(&qr_string)
    .bind(&expires_at)
    .execute(&state.db)
    .await
    .map_err(|e| format!("Gagal simpan QRIS payment: {}", e))?;

    // Log audit trail
    let user_id = audit::get_user_id_from_token(&state, &session_token);
    audit::log_payment_action(
        &state.db,
        user_id,
        PaymentAuditAction::GenerateQR,
        &format!("QRIS QR generated: order_id={}, amount={}", order_id, amount),
        Some(&serde_json::json!({
            "order_id": order_id,
            "amount": amount
        })),
    ).await;

    Ok(QrisPaymentResponse {
        qr_string,
        order_id,
        expires_at,
    })
}

/// Check QRIS payment status dari Midtrans
#[tauri::command]
pub async fn check_qris_status(
    state: tauri::State<'_, AppState>,
    session_token: String,
    order_id: String,
) -> Result<QrisStatusResponse, String> {
    crate::auth::guard::validate_session(&state, &session_token)?;

    let user_id = crate::audit::get_user_id_from_token(&state, &session_token)
        .ok_or("Invalid session")?;
    rate_limiter::CHECK_STATUS_LIMIT.check(user_id, "check_status")?;

    let creds = get_credentials(&state).await?;

    let client = http_client()?;
    let response = client
        .get(&format!("{}/v2/{}/status", creds.base_url, order_id))
        .basic_auth(&creds.server_key, Some(""))
        .send()
        .await
        .map_err(|e| audit::sanitize_error(&e.to_string(), "check_status_send_request"))?;

    if !response.status().is_success() {
        let status = response.status();
        return Err(audit::sanitize_error(
            &format!("API error {}", status.as_u16()),
            "check_status_api_error"
        ));
    }

    let midtrans_status: MidtransStatusResponse = response
        .json()
        .await
        .map_err(|e| audit::sanitize_error(&e.to_string(), "check_status_parse_response"))?;

    // Map Midtrans status ke internal status
    let status = match midtrans_status.transaction_status.as_str() {
        "settlement" | "capture" => "settlement",
        "pending" => "pending",
        "expire" => "expire",
        "cancel" | "deny" => "cancel",
        other => other,
    };

    // Update DB hanya saat status berubah (bukan pending)
    if status == "settlement" {
        sqlx::query("UPDATE qris_payments SET status = 'SETTLED', settled_at = CURRENT_TIMESTAMP WHERE order_id = ? AND status != 'SETTLED'")
            .bind(&order_id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;

        // Hanya log settlement (bukan setiap poll)
        let user_id = audit::get_user_id_from_token(&state, &session_token);
        audit::log_payment_action(
            &state.db,
            user_id,
            PaymentAuditAction::CheckStatus,
            &format!("QRIS payment settled: order_id={}", order_id),
            Some(&serde_json::json!({ "order_id": order_id, "status": "settlement" })),
        ).await;
    } else if status == "expire" {
        sqlx::query("UPDATE qris_payments SET status = 'EXPIRED' WHERE order_id = ? AND status != 'EXPIRED'")
            .bind(&order_id)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(QrisStatusResponse {
        status: status.to_string(),
        transaction_status: midtrans_status.transaction_status,
        order_id: midtrans_status.order_id,
    })
}

/// Cancel QRIS payment
#[tauri::command]
pub async fn cancel_qris_payment(
    state: tauri::State<'_, AppState>,
    session_token: String,
    order_id: String,
) -> Result<(), String> {
    crate::auth::guard::validate_session(&state, &session_token)?;

    let user_id = crate::audit::get_user_id_from_token(&state, &session_token)
        .ok_or("Invalid session")?;
    rate_limiter::CANCEL_PAYMENT_LIMIT.check(user_id, "cancel_payment")?;

    let creds = get_credentials(&state).await?;

    let client = http_client()?;
    // Cancel via Midtrans — ignore error jika sudah expired
    let _ = client
        .post(&format!("{}/v2/{}/cancel", creds.base_url, order_id))
        .basic_auth(&creds.server_key, Some(""))
        .send()
        .await;

    // Update status di database
    sqlx::query("UPDATE qris_payments SET status = 'CANCELLED' WHERE order_id = ?")
        .bind(&order_id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    // Log audit trail
    let user_id = audit::get_user_id_from_token(&state, &session_token);
    audit::log_payment_action(
        &state.db,
        user_id,
        PaymentAuditAction::CancelPayment,
        &format!("QRIS payment cancelled: order_id={}", order_id),
        Some(&serde_json::json!({ "order_id": order_id })),
    ).await;

    Ok(())
}
