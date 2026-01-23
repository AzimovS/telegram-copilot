use crate::db::scopes as db_scopes;
use crate::telegram::{TelegramClient, client::Folder};
use tauri::State;
use std::sync::Arc;

#[tauri::command]
pub async fn get_folders(
    client: State<'_, Arc<TelegramClient>>,
) -> Result<Vec<Folder>, String> {
    client.get_folders().await
}

#[tauri::command]
pub async fn save_scope(
    name: String,
    config: serde_json::Value,
) -> Result<(), String> {
    let scope_config: db_scopes::ScopeConfig = serde_json::from_value(config)
        .map_err(|e| format!("Invalid config: {}", e))?;

    let now = chrono::Utc::now().timestamp();
    let profile = db_scopes::ScopeProfile {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        config: scope_config,
        is_default: false,
        created_at: now,
        updated_at: now,
    };

    db_scopes::save_scope(&profile)
}

#[tauri::command]
pub async fn load_scope(name: String) -> Result<Option<db_scopes::ScopeProfile>, String> {
    db_scopes::load_scope(&name)
}

#[tauri::command]
pub async fn list_scopes() -> Result<Vec<String>, String> {
    db_scopes::list_scopes()
}

#[tauri::command]
pub async fn delete_scope(name: String) -> Result<(), String> {
    db_scopes::delete_scope(&name)
}
