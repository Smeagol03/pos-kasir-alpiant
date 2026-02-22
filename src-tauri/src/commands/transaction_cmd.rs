use crate::models::transaction::{
    CreateTransactionPayload, PaginatedTransactions, Transaction, TransactionDetail,
    TransactionItemWithProduct, TransactionWithCashier,
};
use crate::AppState;

/// Buat transaksi baru
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

    if payload.amount_paid < payload.total_amount {
        return Err("Uang bayar tidak cukup".into());
    }

    let change_given = payload.amount_paid - payload.total_amount;
    let transaction_id = uuid::Uuid::new_v4().to_string();

    // Memulai database transaction
    let mut tx = state.db.begin().await.map_err(|e| e.to_string())?;

    // 1. Insert ke tabel transactions
    sqlx::query(
        "INSERT INTO transactions (
            id, cashier_id, total_amount, discount_id, discount_amount,
            tax_amount, payment_method, amount_paid, change_given, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&transaction_id)
    .bind(session.user_id)
    .bind(payload.total_amount)
    .bind(payload.discount_id)
    .bind(payload.discount_amount)
    .bind(payload.tax_amount)
    .bind(&payload.payment_method)
    .bind(payload.amount_paid)
    .bind(change_given)
    .bind(&payload.notes)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    // 2. Loop insert ke transaction_items & kurangi stok
    for item in payload.items {
        // Cek stok
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

        let subtotal = item.price_at_time * item.quantity as f64;

        // Insert Item
        sqlx::query(
            "INSERT INTO transaction_items (transaction_id, product_id, quantity, price_at_time, subtotal) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(&transaction_id)
        .bind(item.product_id)
        .bind(item.quantity)
        .bind(item.price_at_time)
        .bind(subtotal)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

        // Kurangi Stok
        sqlx::query("UPDATE products SET stock = stock - ? WHERE id = ?")
            .bind(item.quantity)
            .bind(item.product_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
    }

    // 3. Commit transaksi database
    tx.commit().await.map_err(|e| e.to_string())?;

    // 4. Return Data Transaksi
    let saved_transaction =
        sqlx::query_as::<_, Transaction>("SELECT * FROM transactions WHERE id = ?")
            .bind(&transaction_id)
            .fetch_one(&state.db)
            .await
            .map_err(|e| e.to_string())?;

    Ok(saved_transaction)
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
    }

    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

/// Ambil daftar transaksi (Admin semua, Kasir hanya yg dibuat dirinya)
#[tauri::command]
pub async fn get_transactions(
    state: tauri::State<'_, AppState>,
    session_token: String,
    date: Option<String>,
    page: i64,
) -> Result<PaginatedTransactions, String> {
    let session = crate::auth::guard::validate_session(&state, &session_token)?;
    let is_admin = session.role == "ADMIN";

    let mut count_query = "SELECT COUNT(*) FROM transactions WHERE 1=1".to_string();
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

    if let Some(d) = date {
        // Asumsi format 'YYYY-MM-DD'
        let condition = format!(" AND date(t.timestamp) = '{}'", d);
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
