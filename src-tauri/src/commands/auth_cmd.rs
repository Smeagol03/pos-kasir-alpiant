use crate::models::user::{AuthUserData, DbUser, LoginResult};
use crate::AppState;

/// Cek apakah ini pertama kali aplikasi dibuka (belum ada admin).
#[tauri::command]
pub async fn check_first_run(state: tauri::State<'_, AppState>) -> Result<bool, String> {
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users WHERE role = 'ADMIN'")
        .fetch_one(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(count.0 == 0)
}

/// Buat akun admin pertama (hanya bisa 1x).
#[tauri::command]
pub async fn create_admin(
    state: tauri::State<'_, AppState>,
    name: String,
    username: String,
    password: String,
) -> Result<(), String> {
    // Pastikan admin belum ada
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM users WHERE role = 'ADMIN'")
        .fetch_one(&state.db)
        .await
        .map_err(|e| e.to_string())?;
    if count.0 > 0 {
        return Err("Admin sudah ada".into());
    }

    // Validasi input
    if name.trim().is_empty() {
        return Err("Nama tidak boleh kosong".into());
    }
    if username.len() < 4 {
        return Err("Username minimal 4 karakter".into());
    }
    if password.len() < 8 {
        return Err("Password minimal 8 karakter".into());
    }

    let hashed = bcrypt::hash(&password, 12).map_err(|e| e.to_string())?;

    sqlx::query(
        "INSERT INTO users (name, username, password_hash, role) VALUES (?, ?, ?, 'ADMIN')",
    )
    .bind(&name)
    .bind(&username)
    .bind(&hashed)
    .execute(&state.db)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Login user dan buat session.
#[tauri::command]
pub async fn login(
    state: tauri::State<'_, AppState>,
    username: String,
    password: String,
) -> Result<LoginResult, String> {
    let user =
        sqlx::query_as::<_, DbUser>("SELECT * FROM users WHERE username = ? AND is_active = 1")
            .bind(&username)
            .fetch_optional(&state.db)
            .await
            .map_err(|e| e.to_string())?
            .ok_or("Username tidak ditemukan atau akun tidak aktif")?;

    let valid =
        bcrypt::verify(&password, &user.password_hash).map_err(|_| "Gagal verifikasi password")?;
    if !valid {
        return Err("Password salah".into());
    }

    // Catat last login
    sqlx::query("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(user.id)
        .execute(&state.db)
        .await
        .ok();

    let token = state.sessions.lock().map_err(|e| e.to_string())?.create(
        user.id,
        user.username.clone(),
        user.name.clone(),
        user.role.clone(),
    );

    // Log Activity
    crate::commands::activity_cmd::log_activity(
        &state.db,
        None,
        Some(user.id),
        "LOGIN",
        &format!("User {} berhasil login", user.username),
        None,
    ).await;

    Ok(LoginResult {
        user: AuthUserData {
            id: user.id,
            name: user.name,
            username: user.username,
            role: user.role,
        },
        session_token: token,
        login_at: chrono::Utc::now().to_rfc3339(),
    })
}

/// Logout — hapus session.
#[tauri::command]
pub async fn logout(
    state: tauri::State<'_, AppState>,
    session_token: String,
) -> Result<(), String> {
    // Get user id before destroying session for logging
    let user_id = if let Ok(session) = crate::auth::guard::validate_session(&state, &session_token) {
        Some(session.user_id)
    } else {
        None
    };

    state
        .sessions
        .lock()
        .map_err(|e| e.to_string())?
        .destroy(&session_token);

    if let Some(id) = user_id {
        crate::commands::activity_cmd::log_activity(
            &state.db,
            None,
            Some(id),
            "LOGOUT",
            "User melakukan logout",
            None,
        ).await;
    }

    Ok(())
}

/// Cek apakah session masih valid (untuk auto-login saat app reload).
#[tauri::command]
pub async fn check_session(
    state: tauri::State<'_, AppState>,
    session_token: String,
) -> Result<AuthUserData, String> {
    let session = crate::auth::guard::validate_session(&state, &session_token)?;
    Ok(AuthUserData {
        id: session.user_id,
        name: session.name,
        username: session.username,
        role: session.role,
    })
}
