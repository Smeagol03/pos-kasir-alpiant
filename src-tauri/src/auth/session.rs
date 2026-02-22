use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SessionData {
    pub user_id: i64,
    pub username: String,
    pub name: String,
    pub role: String, // "ADMIN" | "KASIR"
    pub login_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

pub struct SessionStore {
    sessions: HashMap<String, SessionData>,
}

impl SessionStore {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }

    /// Membuat sesi baru dan mengembalikan session token (UUID v4).
    pub fn create(&mut self, user_id: i64, username: String, name: String, role: String) -> String {
        let token = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();
        self.sessions.insert(
            token.clone(),
            SessionData {
                user_id,
                username,
                name,
                role,
                login_at: now,
                expires_at: now + Duration::hours(8),
            },
        );
        token
    }

    /// Validasi session token — cek ada dan belum expired.
    pub fn validate(&self, token: &str) -> Result<&SessionData, String> {
        match self.sessions.get(token) {
            None => Err("Sesi tidak valid, silakan login ulang".into()),
            Some(s) if Utc::now() > s.expires_at => Err("Sesi expired, silakan login ulang".into()),
            Some(s) => Ok(s),
        }
    }

    /// Validasi session token + pastikan role ADMIN.
    pub fn validate_admin(&self, token: &str) -> Result<&SessionData, String> {
        let s = self.validate(token)?;
        if s.role != "ADMIN" {
            return Err("Akses ditolak: hanya Admin yang bisa melakukan ini".into());
        }
        Ok(s)
    }

    /// Hapus sesi (logout).
    pub fn destroy(&mut self, token: &str) {
        self.sessions.remove(token);
    }
}
