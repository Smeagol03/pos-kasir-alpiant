use serde::{Deserialize, Serialize};

/// Struct dari database — untuk query_as.
#[derive(Debug, Clone, sqlx::FromRow)]
pub struct DbUser {
    pub id: i64,
    pub name: String,
    pub username: String,
    pub password_hash: String,
    pub role: String,
    pub is_active: bool,
    pub created_at: Option<String>,
    pub created_by: Option<i64>,
    pub last_login_at: Option<String>,
}

/// Struct yang dikirim ke frontend (tanpa password_hash).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub name: String,
    pub username: String,
    pub role: String,
    pub is_active: bool,
    pub created_at: Option<String>,
    pub last_login_at: Option<String>,
}

impl From<DbUser> for User {
    fn from(u: DbUser) -> Self {
        Self {
            id: u.id,
            name: u.name,
            username: u.username,
            role: u.role,
            is_active: u.is_active,
            created_at: u.created_at,
            last_login_at: u.last_login_at,
        }
    }
}

/// Hasil login yang dikirim ke frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginResult {
    pub user: AuthUserData,
    pub session_token: String,
    pub login_at: String,
}

/// Data user dalam LoginResult.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthUserData {
    pub id: i64,
    pub name: String,
    pub username: String,
    pub role: String,
}

/// Payload untuk membuat user baru.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateUserPayload {
    pub name: String,
    pub username: String,
    pub password: String,
}

/// Payload untuk mengupdate user.
#[derive(Debug, Clone, Deserialize)]
pub struct UpdateUserPayload {
    pub name: String,
    pub username: String,
}
