use crate::cache::{format_cache_age, ContactsCache};
use crate::db::contacts as db_contacts;
use crate::telegram::client::ChatFilters;
use crate::telegram::TelegramClient;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContactWithMetadata {
    pub user_id: i64,
    pub first_name: String,
    pub last_name: String,
    pub username: Option<String>,
    pub phone_number: Option<String>,
    pub tags: Vec<String>,
    pub notes: String,
    pub last_contact_date: Option<i64>,
    pub days_since_contact: Option<i64>,
    pub unread_count: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContactsResponse {
    pub contacts: Vec<ContactWithMetadata>,
    pub cached: bool,
    pub cache_age: Option<String>,
}

const CONTACTS_CACHE_KEY: &str = "contacts:all";

#[tauri::command]
pub async fn get_contacts(
    client: State<'_, Arc<TelegramClient>>,
    cache: State<'_, Arc<ContactsCache>>,
    force_refresh: Option<bool>,
    ttl_minutes: Option<i64>,
) -> Result<ContactsResponse, String> {
    let force_refresh = force_refresh.unwrap_or(false);
    let ttl_minutes = ttl_minutes.unwrap_or(10080); // Default 7 days
    let ttl_secs = (ttl_minutes * 60) as u64;

    log::info!(
        "Getting contacts (force_refresh: {}, ttl: {}m)",
        force_refresh,
        ttl_minutes
    );

    // Check cache unless force refresh
    if !force_refresh {
        if let Some((cached_contacts, age_secs)) = cache.0.get(CONTACTS_CACHE_KEY, ttl_secs).await {
            log::info!("Returning cached contacts (age: {}s)", age_secs);
            return Ok(ContactsResponse {
                contacts: cached_contacts,
                cached: true,
                cache_age: Some(format_cache_age(age_secs)),
            });
        }
    }
    let users = client.get_contacts().await?;
    let now = chrono::Utc::now().timestamp();

    // Get private chats to find last message dates for contacts
    // For private chats, the chat ID equals the user ID
    let private_filter = ChatFilters {
        include_private_chats: true,
        include_non_contacts: true,
        include_groups: false,
        include_channels: false,
        include_bots: false,
        include_archived: true,
        include_muted: true,
        ..Default::default()
    };

    let chats = client.get_chats(200, Some(private_filter)).await.unwrap_or_default();

    // Build a map of user_id -> (last_message_date, unread_count) from private chats
    let mut chat_data_map: HashMap<i64, (i64, i32)> = HashMap::new();
    for chat in chats {
        if chat.chat_type == "private" {
            if let Some(msg) = chat.last_message {
                chat_data_map.insert(chat.id, (msg.date as i64, chat.unread_count));
            }
        }
    }

    let mut contacts = Vec::new();
    for user in users {
        let tags = db_contacts::get_contact_tags(user.id).unwrap_or_default();
        let notes = db_contacts::get_contact_notes(user.id).unwrap_or_default();

        // Get chat data (last message date and unread count)
        let chat_data = chat_data_map.get(&user.id);

        // Use last message date from chat, fall back to DB if not found
        let last_contact_date = chat_data.map(|(date, _)| *date)
            .or_else(|| db_contacts::get_last_contact_date(user.id).unwrap_or(None));

        let days_since_contact = last_contact_date.map(|date| {
            (now - date) / 86400 // seconds in a day
        });

        let unread_count = chat_data.map(|(_, count)| *count);

        contacts.push(ContactWithMetadata {
            user_id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            username: user.username,
            phone_number: user.phone_number,
            tags,
            notes,
            last_contact_date,
            days_since_contact,
            unread_count,
        });
    }

    // Store in cache
    cache.0.set(CONTACTS_CACHE_KEY, contacts.clone()).await;

    Ok(ContactsResponse {
        contacts,
        cached: false,
        cache_age: None,
    })
}

#[tauri::command]
pub async fn add_contact_tag(
    user_id: i64,
    tag: String,
) -> Result<(), String> {
    db_contacts::add_contact_tag(user_id, &tag)
}

#[tauri::command]
pub async fn remove_contact_tag(
    user_id: i64,
    tag: String,
) -> Result<(), String> {
    db_contacts::remove_contact_tag(user_id, &tag)
}

#[tauri::command]
pub async fn update_contact_notes(
    user_id: i64,
    notes: String,
) -> Result<(), String> {
    db_contacts::update_contact_notes(user_id, &notes)
}

#[tauri::command]
pub async fn get_all_tags() -> Result<Vec<(String, i32)>, String> {
    db_contacts::get_all_tags()
}
