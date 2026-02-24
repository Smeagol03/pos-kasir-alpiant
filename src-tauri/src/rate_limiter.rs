use std::collections::HashMap;
use std::sync::Mutex;
use chrono::{DateTime, Utc, Duration};

/// Entry untuk rate limiting
#[derive(Clone, Debug)]
struct RateLimitEntry {
    count: u32,
    window_start: DateTime<Utc>,
}

/// Rate limiter dengan sliding window
pub struct RateLimiter {
    /// Map: user_id -> (action -> RateLimitEntry)
    entries: Mutex<HashMap<i64, HashMap<String, RateLimitEntry>>>,
    /// Max requests per window
    max_requests: u32,
    /// Window duration in seconds
    window_seconds: i64,
}

impl RateLimiter {
    pub fn new(max_requests: u32, window_seconds: i64) -> Self {
        Self {
            entries: Mutex::new(HashMap::new()),
            max_requests,
            window_seconds,
        }
    }

    /// Check if action is rate limited for user
    /// Returns Ok(()) if allowed, Err(message) if rate limited
    pub fn check(&self, user_id: i64, action: &str) -> Result<(), String> {
        let mut entries = self.entries.lock()
            .map_err(|_| "Failed to acquire rate limiter lock")?;

        let now = Utc::now();
        let window_duration = Duration::seconds(self.window_seconds);

        // Get or create user's entries
        let user_entries = entries.entry(user_id)
            .or_insert_with(HashMap::new);

        // Get or create action entry
        let entry = user_entries.entry(action.to_string())
            .or_insert_with(|| RateLimitEntry {
                count: 0,
                window_start: now,
            });

        // Check if window has expired
        if now >= entry.window_start + window_duration {
            // Reset window
            entry.count = 0;
            entry.window_start = now;
        }

        // Increment count
        entry.count += 1;

        // Check if exceeded limit
        if entry.count > self.max_requests {
            let retry_after = (entry.window_start + window_duration - now).num_seconds();
            return Err(format!(
                "Rate limit exceeded. Max {} requests per {} seconds. Try again in {} seconds.",
                self.max_requests, self.window_seconds, retry_after.max(0)
            ));
        }

        Ok(())
    }
}

// Default rate limits for payment actions
lazy_static::lazy_static! {
    /// Rate limit untuk generate QR: 10 requests per minute
    pub static ref GENERATE_QR_LIMIT: RateLimiter = RateLimiter::new(10, 60);
    
    /// Rate limit untuk check status: 30 requests per minute (karena polling setiap 3 detik)
    pub static ref CHECK_STATUS_LIMIT: RateLimiter = RateLimiter::new(30, 60);
    
    /// Rate limit untuk cancel payment: 5 requests per minute
    pub static ref CANCEL_PAYMENT_LIMIT: RateLimiter = RateLimiter::new(5, 60);
    
    /// Rate limit untuk test connection: 3 requests per minute
    pub static ref TEST_CONNECTION_LIMIT: RateLimiter = RateLimiter::new(3, 60);
}
