use crate::db::contacts as db_contacts;
use crate::telegram::{TelegramClient, client::User};
use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
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
}

#[tauri::command]
pub async fn get_contacts(
    client: State<'_, Arc<TelegramClient>>,
) -> Result<Vec<ContactWithMetadata>, String> {
    let users = client.get_contacts().await?;
    let now = chrono::Utc::now().timestamp();

    let mut contacts = Vec::new();
    for user in users {
        let tags = db_contacts::get_contact_tags(user.id).unwrap_or_default();
        let notes = db_contacts::get_contact_notes(user.id).unwrap_or_default();
        let last_contact_date = db_contacts::get_last_contact_date(user.id).unwrap_or(None);

        let days_since_contact = last_contact_date.map(|date| {
            (now - date) / 86400 // seconds in a day
        });

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
        });
    }

    Ok(contacts)
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
