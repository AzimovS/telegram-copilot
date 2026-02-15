use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::time::Instant;
use tokio::sync::RwLock;

/// Entry in the cache with timestamp
#[derive(Clone)]
pub struct CacheEntry<T> {
    pub data: T,
    pub created_at: Instant,
}

/// Generic TTL cache with in-memory storage
pub struct TTLCache<V> {
    entries: RwLock<HashMap<String, CacheEntry<V>>>,
}

impl<V: Clone> TTLCache<V> {
    /// Create a new empty cache
    pub fn new() -> Self {
        Self {
            entries: RwLock::new(HashMap::new()),
        }
    }

    /// Get a value from cache if it exists and hasn't expired
    /// Returns (data, age_secs) if found and valid
    pub async fn get(&self, key: &str, ttl_secs: u64) -> Option<(V, u64)> {
        let entries = self.entries.read().await;
        if let Some(entry) = entries.get(key) {
            let age_secs = entry.created_at.elapsed().as_secs();
            if age_secs < ttl_secs {
                return Some((entry.data.clone(), age_secs));
            }
        }
        None
    }

    /// Store a value in the cache
    pub async fn set(&self, key: &str, value: V) {
        let mut entries = self.entries.write().await;
        entries.insert(
            key.to_string(),
            CacheEntry {
                data: value,
                created_at: Instant::now(),
            },
        );
    }

    /// Invalidate a single entry by key
    pub async fn invalidate(&self, key: &str) {
        let mut entries = self.entries.write().await;
        entries.remove(key);
    }

    /// Invalidate all entries in the cache
    #[allow(dead_code)]
    pub async fn invalidate_all(&self) {
        let mut entries = self.entries.write().await;
        entries.clear();
    }
}

impl<V: Clone> Default for TTLCache<V> {
    fn default() -> Self {
        Self::new()
    }
}

/// Generate a cache key from a list of chat IDs
/// Sorts the IDs to ensure consistent keys regardless of input order
pub fn generate_chat_ids_key(chat_ids: &[i64]) -> String {
    let mut sorted_ids = chat_ids.to_vec();
    sorted_ids.sort();

    let mut hasher = DefaultHasher::new();
    for id in &sorted_ids {
        id.hash(&mut hasher);
    }
    format!("chats:{:x}", hasher.finish())
}

/// Wrapper types for different cache types
pub struct BriefingCache(pub TTLCache<crate::ai::types::BriefingV2Response>);
pub struct SummaryCache(pub TTLCache<crate::ai::types::BatchSummaryResponse>);
pub struct ContactsCache(pub TTLCache<Vec<crate::commands::contacts::ContactWithMetadata>>);

impl BriefingCache {
    pub fn new() -> Self {
        Self(TTLCache::new())
    }
}

impl Default for BriefingCache {
    fn default() -> Self {
        Self::new()
    }
}

impl SummaryCache {
    pub fn new() -> Self {
        Self(TTLCache::new())
    }
}

impl Default for SummaryCache {
    fn default() -> Self {
        Self::new()
    }
}

impl ContactsCache {
    pub fn new() -> Self {
        Self(TTLCache::new())
    }
}

impl Default for ContactsCache {
    fn default() -> Self {
        Self::new()
    }
}

/// Format age in seconds to human-readable string
pub fn format_cache_age(age_secs: u64) -> String {
    if age_secs < 60 {
        "just now".to_string()
    } else if age_secs < 3600 {
        format!("{}m ago", age_secs / 60)
    } else if age_secs < 86400 {
        format!("{}h ago", age_secs / 3600)
    } else {
        format!("{}d ago", age_secs / 86400)
    }
}
