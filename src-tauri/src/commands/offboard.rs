use crate::telegram::TelegramClient;
use grammers_tl_types as tl;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommonGroup {
    pub id: i64,
    pub title: String,
    pub can_remove: bool,
    pub member_count: Option<i32>,
}

/// Cache for user access hashes (needed for API calls)
pub struct UserAccessHashCache {
    cache: RwLock<HashMap<i64, i64>>,
}

impl UserAccessHashCache {
    pub fn new() -> Self {
        Self {
            cache: RwLock::new(HashMap::new()),
        }
    }

    pub async fn get(&self, user_id: i64) -> Option<i64> {
        self.cache.read().await.get(&user_id).copied()
    }

    pub async fn set(&self, user_id: i64, access_hash: i64) {
        self.cache.write().await.insert(user_id, access_hash);
    }

    pub async fn populate_from_contacts(&self, client: &TelegramClient) -> Result<(), String> {
        let contacts = client.get_contacts_with_access_hash().await?;
        let mut cache = self.cache.write().await;
        for (user_id, access_hash) in contacts {
            cache.insert(user_id, access_hash);
        }
        log::info!("[Offboard] Cached {} user access hashes", cache.len());
        Ok(())
    }
}

impl Default for UserAccessHashCache {
    fn default() -> Self {
        Self::new()
    }
}

/// Cache for raw chat data (needed for kick operations)
pub struct ChatDataCache {
    cache: RwLock<HashMap<i64, tl::enums::Chat>>,
}

impl ChatDataCache {
    pub fn new() -> Self {
        Self {
            cache: RwLock::new(HashMap::new()),
        }
    }

    pub async fn get(&self, chat_id: i64) -> Option<tl::enums::Chat> {
        self.cache.read().await.get(&chat_id).cloned()
    }

    pub async fn set(&self, chat_id: i64, chat: tl::enums::Chat) {
        self.cache.write().await.insert(chat_id, chat);
    }
}

impl Default for ChatDataCache {
    fn default() -> Self {
        Self::new()
    }
}

#[tauri::command]
pub async fn get_common_groups(
    client: State<'_, Arc<TelegramClient>>,
    user_hash_cache: State<'_, Arc<UserAccessHashCache>>,
    chat_cache: State<'_, Arc<ChatDataCache>>,
    user_id: i64,
) -> Result<Vec<CommonGroup>, String> {
    log::info!("[Offboard] Getting common groups for user {}", user_id);

    // Try to get access hash from cache
    let mut access_hash = user_hash_cache.get(user_id).await;

    // If not in cache, populate cache from contacts
    if access_hash.is_none() {
        log::info!("[Offboard] Access hash not found, refreshing contacts cache");
        user_hash_cache.populate_from_contacts(&client).await?;
        access_hash = user_hash_cache.get(user_id).await;
    }

    let access_hash = access_hash.ok_or_else(|| {
        format!("User {} not found in contacts. Cannot lookup common groups.", user_id)
    })?;

    // Get common chats from Telegram
    let common_chats = client.get_common_chats(user_id, access_hash).await?;

    // Cache the raw chat data for later use in kick operations
    for chat in &common_chats {
        chat_cache.set(chat.id, chat.raw_chat.clone()).await;
    }

    // Convert to our response format
    let groups: Vec<CommonGroup> = common_chats
        .into_iter()
        .map(|c| CommonGroup {
            id: c.id,
            title: c.title,
            can_remove: c.can_remove,
            member_count: c.member_count,
        })
        .collect();

    log::info!("[Offboard] Found {} common groups for user {}", groups.len(), user_id);
    Ok(groups)
}

#[tauri::command]
pub async fn remove_from_group(
    client: State<'_, Arc<TelegramClient>>,
    user_hash_cache: State<'_, Arc<UserAccessHashCache>>,
    chat_cache: State<'_, Arc<ChatDataCache>>,
    chat_id: i64,
    user_id: i64,
) -> Result<(), String> {
    log::info!("[Offboard] Removing user {} from chat {}", user_id, chat_id);

    // Get user access hash
    let user_access_hash = user_hash_cache.get(user_id).await.ok_or_else(|| {
        format!("User {} not found in cache. Please lookup common groups first.", user_id)
    })?;

    // Get cached chat data
    let chat = chat_cache.get(chat_id).await.ok_or_else(|| {
        format!("Chat {} not found in cache. Please lookup common groups first.", chat_id)
    })?;

    // Perform the kick
    client.kick_chat_member(&chat, user_id, user_access_hash).await?;

    log::info!("[Offboard] Successfully removed user {} from chat {}", user_id, chat_id);
    Ok(())
}
