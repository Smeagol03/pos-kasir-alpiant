use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Autentikasi gagal: {0}")]
    Auth(String),

    #[error("Akses ditolak: {0}")]
    Forbidden(String),

    #[error("Data tidak ditemukan: {0}")]
    NotFound(String),

    #[error("Validasi gagal: {0}")]
    Validation(String),

    #[error("Error: {0}")]
    Internal(String),
}

impl From<AppError> for String {
    fn from(err: AppError) -> String {
        err.to_string()
    }
}
