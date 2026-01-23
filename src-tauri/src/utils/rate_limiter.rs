use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

pub struct RateLimiter {
    min_interval_secs: u64,
    last_send_times: Mutex<HashMap<i64, Instant>>,
    flood_wait_until: Mutex<Option<Instant>>,
}

impl RateLimiter {
    pub fn new(min_interval_secs: u64) -> Self {
        Self {
            min_interval_secs,
            last_send_times: Mutex::new(HashMap::new()),
            flood_wait_until: Mutex::new(None),
        }
    }

    /// Check if we can send a message to a user
    /// Returns Ok(()) if we can send, Err with wait time in seconds otherwise
    pub fn can_send(&self, user_id: i64) -> Result<(), u64> {
        // Check global flood wait first
        if let Some(until) = *self.flood_wait_until.lock().unwrap() {
            if Instant::now() < until {
                let wait = until.duration_since(Instant::now()).as_secs();
                return Err(wait);
            }
        }

        // Check per-user rate limit
        let times = self.last_send_times.lock().unwrap();
        if let Some(last_time) = times.get(&user_id) {
            let elapsed = last_time.elapsed();
            let min_interval = Duration::from_secs(self.min_interval_secs);
            if elapsed < min_interval {
                let wait = (min_interval - elapsed).as_secs();
                return Err(wait);
            }
        }

        Ok(())
    }

    /// Record that a message was sent to a user
    pub fn record_send(&self, user_id: i64) {
        self.last_send_times
            .lock()
            .unwrap()
            .insert(user_id, Instant::now());
    }

    /// Handle FLOOD_WAIT error from Telegram
    /// wait_seconds is the time Telegram told us to wait
    pub fn handle_flood_wait(&self, wait_seconds: u64) {
        // Add some buffer to the wait time
        let buffer = wait_seconds / 10 + 5;
        let total_wait = wait_seconds + buffer;

        *self.flood_wait_until.lock().unwrap() =
            Some(Instant::now() + Duration::from_secs(total_wait));

        log::warn!(
            "FLOOD_WAIT received, pausing for {} seconds (including {} second buffer)",
            total_wait,
            buffer
        );
    }

    /// Get the next time we can send (for queue scheduling)
    pub fn next_available_time(&self, user_id: i64) -> Instant {
        // Check global flood wait
        let flood_until = *self.flood_wait_until.lock().unwrap();

        // Check per-user wait
        let times = self.last_send_times.lock().unwrap();
        let user_until = times.get(&user_id).map(|last_time| {
            *last_time + Duration::from_secs(self.min_interval_secs)
        });

        // Return the later of the two
        match (flood_until, user_until) {
            (Some(f), Some(u)) => f.max(u),
            (Some(f), None) => f,
            (None, Some(u)) => u,
            (None, None) => Instant::now(),
        }
    }

    /// Calculate wait time with exponential backoff for repeated failures
    pub fn backoff_time(&self, consecutive_failures: u32) -> Duration {
        let base_wait = self.min_interval_secs;
        let multiplier = 2u64.pow(consecutive_failures.min(6)); // Cap at 2^6 = 64x
        Duration::from_secs(base_wait * multiplier)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rate_limiter() {
        let limiter = RateLimiter::new(60);

        // First send should be allowed
        assert!(limiter.can_send(123).is_ok());

        // Record the send
        limiter.record_send(123);

        // Second send should be rate limited
        assert!(limiter.can_send(123).is_err());

        // Different user should be allowed
        assert!(limiter.can_send(456).is_ok());
    }
}
