use crate::models::settings::{ChartPoint, DailyReport, ProductStat, ShiftSummary};
use crate::AppState;

/// Ambil laporan harian (Admin Only)
#[tauri::command]
pub async fn get_daily_report(
    state: tauri::State<'_, AppState>,
    session_token: String,
    date: String,
) -> Result<DailyReport, String> {
    crate::auth::guard::validate_admin(&state, &session_token)?;

    let query = "
        SELECT
            COUNT(id) as transaction_count,
            COALESCE(SUM(total_amount), 0) as total_revenue,
            COALESCE(SUM(CASE WHEN payment_method = 'CASH' THEN total_amount ELSE 0 END), 0) as cash_total,
            COALESCE(SUM(CASE WHEN payment_method = 'DEBIT' THEN total_amount ELSE 0 END), 0) as debit_total,
            COALESCE(SUM(CASE WHEN payment_method = 'QRIS' THEN total_amount ELSE 0 END), 0) as qris_total,
            SUM(CASE WHEN status = 'VOID' THEN 1 ELSE 0 END) as void_count
        FROM transactions
        WHERE date(timestamp) = ?
    ";

    let (trx_count, revenue, cash, debit, qris, void): (i64, f64, f64, f64, f64, i64) =
        sqlx::query_as(query)
            .bind(&date)
            .fetch_one(&state.db)
            .await
            .map_err(|e| e.to_string())?;

    let items_query = "
        SELECT COALESCE(SUM(ti.quantity), 0) as total_items
        FROM transaction_items ti
        JOIN transactions t ON ti.transaction_id = t.id
        WHERE date(t.timestamp) = ? AND t.status != 'VOID'
    ";

    let (items_count,): (i64,) = sqlx::query_as(items_query)
        .bind(&date)
        .fetch_one(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    let avg_trx = if trx_count > 0 {
        revenue / trx_count as f64
    } else {
        0.0
    };

    Ok(DailyReport {
        date,
        total_revenue: revenue,
        transaction_count: trx_count,
        average_transaction: avg_trx,
        total_items_sold: items_count,
        cash_total: cash,
        debit_total: debit,
        qris_total: qris,
        void_count: void,
    })
}

/// Ambil grafik pendapatan harian (Admin Only)
#[tauri::command]
pub async fn get_sales_chart(
    state: tauri::State<'_, AppState>,
    session_token: String,
    start_date: String,
    end_date: String,
) -> Result<Vec<ChartPoint>, String> {
    crate::auth::guard::validate_admin(&state, &session_token)?;

    let query = "
        SELECT
            date(timestamp) as date,
            COALESCE(SUM(total_amount), 0) as revenue,
            COUNT(id) as count
        FROM transactions
        WHERE date(timestamp) BETWEEN ? AND ? AND status != 'VOID'
        GROUP BY date(timestamp)
        ORDER BY date(timestamp) ASC
    ";

    let points = sqlx::query_as::<_, ChartPoint>(query)
        .bind(&start_date)
        .bind(&end_date)
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(points)
}

/// Ambil produk terlaris (Admin Only)
#[tauri::command]
pub async fn get_top_products(
    state: tauri::State<'_, AppState>,
    session_token: String,
    start_date: String,
    end_date: String,
    limit: i64,
) -> Result<Vec<ProductStat>, String> {
    crate::auth::guard::validate_admin(&state, &session_token)?;

    let query = "
        SELECT
            p.id as product_id,
            p.name as name,
            SUM(ti.quantity) as total_sold,
            SUM(ti.subtotal) as total_revenue
        FROM transaction_items ti
        JOIN transactions t ON ti.transaction_id = t.id
        JOIN products p ON ti.product_id = p.id
        WHERE date(t.timestamp) BETWEEN ? AND ? AND t.status != 'VOID'
        GROUP BY p.id
        ORDER BY total_sold DESC
        LIMIT ?
    ";

    let stats = sqlx::query_as::<_, ProductStat>(query)
        .bind(&start_date)
        .bind(&end_date)
        .bind(limit)
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(stats)
}

/// Ambil ringkasan shift harian kasir saat ini
#[tauri::command]
pub async fn get_shift_summary(
    state: tauri::State<'_, AppState>,
    session_token: String,
) -> Result<ShiftSummary, String> {
    let session = crate::auth::guard::validate_session(&state, &session_token)?;

    // Gunakan login_at dari session
    let login_time = session.login_at.to_rfc3339();

    let query = "
        SELECT
            COUNT(id) as count,
            COALESCE(SUM(total_amount), 0) as revenue
        FROM transactions
        WHERE cashier_id = ? AND timestamp >= ? AND status != 'VOID'
    ";

    // Gunakan rfc3339 string untuk SQLite comparison (pastikan format setara)
    // Atau jika sqlite simpan timestamp dalam UTC, compare langsung.
    let (count, revenue): (i64, f64) = sqlx::query_as(query)
        .bind(session.user_id)
        .bind(&login_time)
        .fetch_one(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(ShiftSummary {
        cashier_name: session.name,
        login_at: login_time,
        transaction_count: count,
        total_revenue: revenue,
    })
}
