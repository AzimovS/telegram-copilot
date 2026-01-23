use crate::telegram::TelegramClient;
use tauri::State;
use std::sync::Arc;

#[tauri::command]
pub async fn send_phone_number(
    client: State<'_, Arc<TelegramClient>>,
    phone_number: String,
) -> Result<(), String> {
    client.send_phone_number(&phone_number).await
}

#[tauri::command]
pub async fn send_auth_code(
    client: State<'_, Arc<TelegramClient>>,
    code: String,
) -> Result<(), String> {
    client.send_auth_code(&code).await
}

#[tauri::command]
pub async fn send_password(
    client: State<'_, Arc<TelegramClient>>,
    password: String,
) -> Result<(), String> {
    client.send_password(&password).await
}

#[tauri::command]
pub async fn get_auth_state(
    client: State<'_, Arc<TelegramClient>>,
) -> Result<String, String> {
    let state = client.get_auth_state().await;
    serde_json::to_string(&state).map_err(|e| format!("Failed to serialize state: {}", e))
}

#[tauri::command]
pub async fn logout(
    client: State<'_, Arc<TelegramClient>>,
) -> Result<(), String> {
    client.logout().await
}
