use super::session::SessionData;
use crate::AppState;

/// Helper: validasi session dari AppState dan kembalikan SessionData clone.
pub fn validate_session(state: &AppState, token: &str) -> Result<SessionData, String> {
    let store = state.sessions.lock().map_err(|e| e.to_string())?;
    store.validate(token).cloned()
}

/// Helper: validasi session + pastikan role ADMIN.
pub fn validate_admin(state: &AppState, token: &str) -> Result<SessionData, String> {
    let store = state.sessions.lock().map_err(|e| e.to_string())?;
    store.validate_admin(token).cloned()
}
