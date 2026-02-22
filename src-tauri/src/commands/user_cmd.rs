use crate::models::user::{CreateUserPayload, DbUser, UpdateUserPayload, User};
use crate::AppState;

/// Ambil semua user (Admin only)
#[tauri::command]
pub async fn get_all_users(
    state: tauri::State<'_, AppState>,
    session_token: String,
) -> Result<Vec<User>, String> {
    crate::auth::guard::validate_admin(&state, &session_token)?;

    let users = sqlx::query_as::<_, DbUser>("SELECT * FROM users ORDER BY name ASC")
        .fetch_all(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(users.into_iter().map(User::from).collect())
}

/// Buat kasir baru (Admin only)
#[tauri::command]
pub async fn create_user(
    state: tauri::State<'_, AppState>,
    session_token: String,
    payload: CreateUserPayload,
) -> Result<User, String> {
    let session = crate::auth::guard::validate_admin(&state, &session_token)?;

    if payload.username.len() < 4 {
        return Err("Username minimal 4 karakter".into());
    }
    if payload.password.len() < 8 {
        return Err("Password minimal 8 karakter".into());
    }

    let hashed = bcrypt::hash(&payload.password, 12).map_err(|e| e.to_string())?;

    // Hanya bisa membuat role KASIR dari UI
    let result = sqlx::query(
        "INSERT INTO users (name, username, password_hash, role, created_by) VALUES (?, ?, ?, 'KASIR', ?)"
    )
    .bind(&payload.name)
    .bind(&payload.username)
    .bind(&hashed)
    .bind(session.user_id)
    .execute(&state.db)
    .await;

    match result {
        Ok(res) => {
            let id = res.last_insert_rowid();
            let new_user = sqlx::query_as::<_, DbUser>("SELECT * FROM users WHERE id = ?")
                .bind(id)
                .fetch_one(&state.db)
                .await
                .map_err(|e| e.to_string())?;
            Ok(User::from(new_user))
        }
        Err(sqlx::Error::Database(err)) if err.is_unique_violation() => {
            Err("Username sudah digunakan".into())
        }
        Err(e) => Err(e.to_string()),
    }
}

/// Update user (Admin only)
#[tauri::command]
pub async fn update_user(
    state: tauri::State<'_, AppState>,
    session_token: String,
    id: i64,
    payload: UpdateUserPayload,
) -> Result<User, String> {
    crate::auth::guard::validate_admin(&state, &session_token)?;

    if payload.username.len() < 4 {
        return Err("Username minimal 4 karakter".into());
    }

    let result = sqlx::query("UPDATE users SET name = ?, username = ? WHERE id = ?")
        .bind(&payload.name)
        .bind(&payload.username)
        .bind(id)
        .execute(&state.db)
        .await;

    match result {
        Ok(_) => {
            let updated = sqlx::query_as::<_, DbUser>("SELECT * FROM users WHERE id = ?")
                .bind(id)
                .fetch_one(&state.db)
                .await
                .map_err(|e| e.to_string())?;
            Ok(User::from(updated))
        }
        Err(sqlx::Error::Database(err)) if err.is_unique_violation() => {
            Err("Username sudah digunakan".into())
        }
        Err(e) => Err(e.to_string()),
    }
}

/// Toggle status aktif/nonaktif (Admin only)
#[tauri::command]
pub async fn toggle_user_status(
    state: tauri::State<'_, AppState>,
    session_token: String,
    user_id: i64,
) -> Result<bool, String> {
    let session = crate::auth::guard::validate_admin(&state, &session_token)?;

    if session.user_id == user_id {
        return Err("Anda tidak dapat menonaktifkan akun sendiri".into());
    }

    // Ambil status saat ini
    let current_status: (bool,) = sqlx::query_as("SELECT is_active FROM users WHERE id = ?")
        .bind(user_id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    let new_status = !current_status.0;

    sqlx::query("UPDATE users SET is_active = ? WHERE id = ?")
        .bind(new_status)
        .bind(user_id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(new_status)
}

/// Reset password user (Admin only)
#[tauri::command]
pub async fn reset_user_password(
    state: tauri::State<'_, AppState>,
    session_token: String,
    user_id: i64,
    new_password: String,
) -> Result<(), String> {
    crate::auth::guard::validate_admin(&state, &session_token)?;

    if new_password.len() < 8 {
        return Err("Password minimal 8 karakter".into());
    }

    let hashed = bcrypt::hash(&new_password, 12).map_err(|e| e.to_string())?;

    sqlx::query("UPDATE users SET password_hash = ? WHERE id = ?")
        .bind(&hashed)
        .bind(user_id)
        .execute(&state.db)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
