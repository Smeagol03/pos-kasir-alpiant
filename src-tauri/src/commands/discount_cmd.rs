use crate::models::discount::{CreateDiscountPayload, Discount, UpdateDiscountPayload};
use crate::AppState;

/// Ambil semua diskon
#[tauri::command]
pub async fn get_discounts(
    state: tauri::State<'_, AppState>,
    session_token: String,
) -> Result<Vec<Discount>, String> {
    crate::auth::guard::validate_session(&state, &session_token)?;

    let is_admin = crate::auth::guard::validate_admin(&state, &session_token).is_ok();

    let query = if is_admin {
        "SELECT * FROM discounts ORDER BY is_active DESC, name ASC"
    } else {
        "SELECT * FROM discounts WHERE is_active = 1 ORDER BY name ASC"
    };

    let discounts = sqlx::query_as::<_, Discount>(query)
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(discounts)
}

/// Buat diskon baru (Admin only)
#[tauri::command]
pub async fn create_discount(
    state: tauri::State<'_, AppState>,
    session_token: String,
    payload: CreateDiscountPayload,
) -> Result<Discount, String> {
    crate::auth::guard::validate_admin(&state, &session_token)?;

    if payload.name.trim().is_empty() {
        return Err("Nama diskon tidak boleh kosong".into());
    }
    if payload.r#type != "NOMINAL" && payload.r#type != "PERCENT" {
        return Err("Tipe diskon tidak valid".into());
    }
    if payload.value <= 0.0 {
        return Err("Nilai diskon harus lebih dari 0".into());
    }

    let result =
        sqlx::query("INSERT INTO discounts (name, type, value, min_purchase, is_automatic) VALUES (?, ?, ?, ?, ?)")
            .bind(&payload.name)
            .bind(&payload.r#type)
            .bind(payload.value)
            .bind(payload.min_purchase)
            .bind(payload.is_automatic)
            .execute(&state.db)
            .await
            .map_err(|e| e.to_string())?;

    let id = result.last_insert_rowid();
    let new_discount = sqlx::query_as::<_, Discount>("SELECT * FROM discounts WHERE id = ?")
        .bind(id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(new_discount)
}

/// Update diskon (Admin only)
#[tauri::command]
pub async fn update_discount(
    state: tauri::State<'_, AppState>,
    session_token: String,
    id: i64,
    payload: UpdateDiscountPayload,
) -> Result<Discount, String> {
    crate::auth::guard::validate_admin(&state, &session_token)?;

    if payload.name.trim().is_empty() {
        return Err("Nama diskon tidak boleh kosong".into());
    }
    if payload.r#type != "NOMINAL" && payload.r#type != "PERCENT" {
        return Err("Tipe diskon tidak valid".into());
    }
    if payload.value <= 0.0 {
        return Err("Nilai diskon harus lebih dari 0".into());
    }

    sqlx::query(
        "UPDATE discounts SET name = ?, type = ?, value = ?, min_purchase = ?, is_automatic = ?, is_active = ? WHERE id = ?"
    )
    .bind(&payload.name)
    .bind(&payload.r#type)
    .bind(payload.value)
    .bind(payload.min_purchase)
    .bind(payload.is_automatic)
    .bind(payload.is_active)
    .bind(id)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    let updated = sqlx::query_as::<_, Discount>("SELECT * FROM discounts WHERE id = ?")
        .bind(id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(updated)
}

/// Toggle status aktif/nonaktif
#[tauri::command]
pub async fn toggle_discount(
    state: tauri::State<'_, AppState>,
    session_token: String,
    id: i64,
) -> Result<bool, String> {
    crate::auth::guard::validate_admin(&state, &session_token)?;

    let current: (bool,) = sqlx::query_as("SELECT is_active FROM discounts WHERE id = ?")
        .bind(id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    let new_status = !current.0;

    sqlx::query("UPDATE discounts SET is_active = ? WHERE id = ?")
        .bind(new_status)
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(new_status)
}
