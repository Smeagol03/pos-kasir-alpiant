use crate::models::activity::{ActivityLogWithUser, StockAdjustmentWithDetail};
use crate::AppState;

/// Ambil log aktivitas (Admin Only)
#[tauri::command]
pub async fn get_activity_logs(
    state: tauri::State<'_, AppState>,
    session_token: String,
    limit: i64,
) -> Result<Vec<ActivityLogWithUser>, String> {
    crate::auth::guard::validate_admin(&state, &session_token)?;

    let logs = sqlx::query_as::<_, ActivityLogWithUser>(
        r#"
        SELECT al.*, u.name as user_name
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC
        LIMIT ?
        "#
    )
    .bind(limit)
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(logs)
}

/// Ambil riwayat stok (Admin Only)
#[tauri::command]
pub async fn get_stock_history(
    state: tauri::State<'_, AppState>,
    session_token: String,
    product_id: Option<i64>,
    limit: i64,
) -> Result<Vec<StockAdjustmentWithDetail>, String> {
    crate::auth::guard::validate_admin(&state, &session_token)?;

    let mut query = r#"
        SELECT sa.*, p.name as product_name, u.name as user_name
        FROM stock_adjustments sa
        JOIN products p ON sa.product_id = p.id
        JOIN users u ON sa.user_id = u.id
    "#.to_string();

    if product_id.is_some() {
        query.push_str(" WHERE sa.product_id = ?");
    }

    query.push_str(" ORDER BY sa.created_at DESC LIMIT ?");

    let mut sql_query = sqlx::query_as::<_, StockAdjustmentWithDetail>(&query);
    
    if let Some(id) = product_id {
        sql_query = sql_query.bind(id);
    }
    
    let history = sql_query
        .bind(limit)
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(history)
}

/// Helper internal untuk mencatat aktivitas
pub async fn log_activity(
    db: &sqlx::SqlitePool,
    user_id: Option<i64>,
    action: &str,
    description: &str,
    metadata: Option<&str>,
) {
    let _ = sqlx::query(
        "INSERT INTO activity_logs (user_id, action, description, metadata) VALUES (?, ?, ?, ?)"
    )
    .bind(user_id)
    .bind(action)
    .bind(description)
    .bind(metadata)
    .execute(db)
    .await;
}

/// Helper internal untuk mencatat penyesuaian stok
pub async fn log_stock_adjustment(
    db: &sqlx::SqlitePool,
    product_id: i64,
    user_id: i64,
    adj_type: &str,
    quantity: i64,
    reason: &str,
    notes: Option<&str>,
) {
    let _ = sqlx::query(
        "INSERT INTO stock_adjustments (product_id, user_id, type, quantity, reason, notes) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(product_id)
    .bind(user_id)
    .bind(adj_type)
    .bind(quantity)
    .bind(reason)
    .bind(notes)
    .execute(db)
    .await;
}
