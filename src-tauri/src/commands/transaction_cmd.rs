use crate::models::transaction::{
    CreateTransactionPayload, PaginatedTransactions, Transaction, TransactionDetail,
    TransactionItemWithProduct, TransactionWithCashier,
};
use crate::AppState;
use std::collections::HashMap;

/// Buat transaksi baru — pajak dihitung otomatis dari settings
#[tauri::command]
pub async fn create_transaction(
    state: tauri::State<'_, AppState>,
    session_token: String,
    payload: CreateTransactionPayload,
) -> Result<Transaction, String> {
    let session = crate::auth::guard::validate_session(&state, &session_token)?;

    if payload.items.is_empty() {
        return Err("Keranjang kosong".into());
    }

    // ── 1. Baca tax settings dari DB ──
    let rows: Vec<(String, String)> =
        sqlx::query_as("SELECT key, value FROM settings WHERE key LIKE 'tax.%'")
            .fetch_all(&state.db)
            .await
            .map_err(|e| e.to_string())?;
    let settings: HashMap<String, String> = rows.into_iter().collect();

    let tax_enabled = settings
        .get("tax.is_enabled")
        .map(|v| v == "1")
        .unwrap_or(false);
    let tax_rate = settings
        .get("tax.rate")
        .and_then(|v| v.parse::<f64>().ok())
        .unwrap_or(0.0);
    let tax_included = settings
        .get("tax.is_included")
        .map(|v| v == "1")
        .unwrap_or(false);

    // ── 2. Hitung subtotal items (dengan diskon per-item) ──
    let mut items_subtotal: f64 = 0.0;
    for item in &payload.items {
        let raw = item.price_at_time * item.quantity as f64;
        let after_discount = raw - item.discount_amount;
        items_subtotal += after_discount;
    }

    // ── 3. Kurangi diskon transaksi-level ──
    let subtotal_after_discount = items_subtotal - payload.discount_amount;

    // ── 4. Hitung pajak ──
    let tax_amount = if tax_enabled && tax_rate > 0.0 {
        if tax_included {
            // Pajak sudah termasuk dalam harga: hitung porsi pajak saja (informasi struk)
            subtotal_after_discount * tax_rate / (100.0 + tax_rate)
        } else {
            // Pajak ditambahkan di atas subtotal
            subtotal_after_discount * (tax_rate / 100.0)
        }
    } else {
        0.0
    };

    // ── 5. Hitung total ──
    let total_amount = if tax_included {
        subtotal_after_discount // pajak sudah di dalam harga
    } else {
        subtotal_after_discount + tax_amount
    };

    // Bulatkan ke angka utuh untuk Rupiah (IDR)
    let total_amount = total_amount.round();
    let tax_amount = tax_amount.round();

    if payload.amount_paid < total_amount {
        return Err(format!(
            "Uang bayar tidak cukup. Total: {}, Dibayar: {}",
            total_amount, payload.amount_paid
        ));
    }

    let change_given = (payload.amount_paid - total_amount).round();
    let transaction_id = uuid::Uuid::new_v4().to_string();

    // ── 6. Mulai DB Transaction ──
    let mut tx = state.db.begin().await.map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO transactions (
            id, cashier_id, total_amount, discount_id, discount_amount,
            tax_amount, payment_method, amount_paid, change_given, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&transaction_id)
    .bind(session.user_id)
    .bind(total_amount)
    .bind(payload.discount_id)
    .bind(payload.discount_amount)
    .bind(tax_amount)
    .bind(&payload.payment_method)
    .bind(payload.amount_paid)
    .bind(change_given)
    .bind(&payload.notes)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    // ── 7. Loop items ──
    for item in &payload.items {
        let stock_row: (i64,) = sqlx::query_as("SELECT stock FROM products WHERE id = ?")
            .bind(item.product_id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(|e| e.to_string())?
            .ok_or(format!("Produk id {} tidak ditemukan", item.product_id))?;

        if stock_row.0 < item.quantity {
            return Err(format!(
                "Stok tidak cukup untuk produk id {}",
                item.product_id
            ));
        }

        let subtotal = (item.price_at_time * item.quantity as f64) - item.discount_amount;

        sqlx::query(
            "INSERT INTO transaction_items (transaction_id, product_id, quantity, price_at_time, subtotal, discount_amount) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(&transaction_id)
        .bind(item.product_id)
        .bind(item.quantity)
        .bind(item.price_at_time)
        .bind(subtotal)
        .bind(item.discount_amount)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        sqlx::query("UPDATE products SET stock = stock - ? WHERE id = ?")
            .bind(item.quantity)
            .bind(item.product_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

        // Log Stock Adjustment (SALE)
        crate::commands::activity_cmd::log_stock_adjustment(
            &state.db,
            item.product_id,
            session.user_id,
            "OUT",
            item.quantity,
            "SALE",
            Some(&format!("Penjualan transaksi {}", transaction_id)),
        ).await;
    }

    tx.commit().await.map_err(|e| e.to_string())?;

    // Log Activity
    crate::commands::activity_cmd::log_activity(
        &state.db,
        Some(session.user_id),
        "CREATE_TRANSACTION",
        &format!("Transaksi baru berhasil: {}", transaction_id),
        None,
    ).await;

    let saved = sqlx::query_as::<_, Transaction>("SELECT * FROM transactions WHERE id = ?")
        .bind(&transaction_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(saved)
}

/// Batalkan/Void transaksi (Admin only)
#[tauri::command]
pub async fn void_transaction(
    state: tauri::State<'_, AppState>,
    session_token: String,
    transaction_id: String,
) -> Result<(), String> {
    let session = crate::auth::guard::validate_admin(&state, &session_token)?;

    let current: (String,) = sqlx::query_as("SELECT status FROM transactions WHERE id = ?")
        .bind(&transaction_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("Transaksi tidak ditemukan")?;

    if current.0 == "VOID" {
        return Err("Transaksi sudah dibatalkan sebelumnya".into());
    }

    let mut tx = state.db.begin().await.map_err(|e| e.to_string())?;

    // 1. Ubah status transaksi
    sqlx::query(
        "UPDATE transactions SET status = 'VOID', voided_by = ?, voided_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
    .bind(session.user_id)
    .bind(&transaction_id)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    // 2. Kembalikan stok
    let items: Vec<(i64, i64)> = sqlx::query_as(
        "SELECT product_id, quantity FROM transaction_items WHERE transaction_id = ?",
    )
    .bind(&transaction_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    for (product_id, qty) in items {
        sqlx::query("UPDATE products SET stock = stock + ? WHERE id = ?")
            .bind(qty)
            .bind(product_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;

        // Log Stock Adjustment (VOID)
        crate::commands::activity_cmd::log_stock_adjustment(
            &state.db,
            product_id,
            session.user_id,
            "IN",
            qty,
            "ADJUSTMENT",
            Some(&format!("Pembatalan (VOID) transaksi {}", transaction_id)),
        ).await;
    }

    tx.commit().await.map_err(|e| e.to_string())?;

    // Log Activity
    crate::commands::activity_cmd::log_activity(
        &state.db,
        Some(session.user_id),
        "VOID_TRANSACTION",
        &format!("Membatalkan transaksi: {}", transaction_id),
        None,
    ).await;

    Ok(())
}

/// Ambil daftar transaksi (Admin semua, Kasir hanya yg dibuat dirinya)
#[tauri::command]
pub async fn get_transactions(
    state: tauri::State<'_, AppState>,
    session_token: String,
    start_date: Option<String>,
    end_date: Option<String>,
    page: i64,
) -> Result<PaginatedTransactions, String> {
    let session = crate::auth::guard::validate_session(&state, &session_token)?;
    let is_admin = session.role == "ADMIN";

    let mut count_query = "SELECT COUNT(*) FROM transactions t WHERE 1=1".to_string();
    let mut data_query = "
        SELECT t.*, u.name as cashier_name
        FROM transactions t
        LEFT JOIN users u ON t.cashier_id = u.id
        WHERE 1=1
    "
    .to_string();

    if !is_admin {
        let condition = format!(" AND cashier_id = {}", session.user_id);
        count_query.push_str(&condition);
        data_query.push_str(&condition);
    }

    if let (Some(s), Some(e)) = (start_date, end_date) {
        let condition = format!(" AND date(t.timestamp) BETWEEN '{}' AND '{}'", s, e);
        count_query.push_str(&condition);
        data_query.push_str(&condition);
    }

    let total: (i64,) = sqlx::query_as(&count_query)
        .fetch_one(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    let per_page = 20;
    let offset = (page - 1) * per_page;

    data_query.push_str(&format!(
        " ORDER BY t.timestamp DESC LIMIT {} OFFSET {}",
        per_page, offset
    ));

    let data = sqlx::query_as::<_, TransactionWithCashier>(&data_query)
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(PaginatedTransactions {
        data,
        total: total.0,
        page,
        per_page,
    })
}

/// Ambil detail satu transaksi
#[tauri::command]
pub async fn get_transaction_detail(
    state: tauri::State<'_, AppState>,
    session_token: String,
    transaction_id: String,
) -> Result<TransactionDetail, String> {
    crate::auth::guard::validate_session(&state, &session_token)?;

    let transaction = sqlx::query_as::<_, TransactionWithCashier>(
        "SELECT t.*, u.name as cashier_name
         FROM transactions t
         LEFT JOIN users u ON t.cashier_id = u.id
         WHERE t.id = ?",
    )
    .bind(&transaction_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| e.to_string())?
    .ok_or("Transaksi tidak ditemukan")?;

    let items = sqlx::query_as::<_, TransactionItemWithProduct>(
        "SELECT ti.*, p.name as product_name
         FROM transaction_items ti
         LEFT JOIN products p ON ti.product_id = p.id
         WHERE ti.transaction_id = ?",
    )
    .bind(&transaction_id)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(TransactionDetail { transaction, items })
}
