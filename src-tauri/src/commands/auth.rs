use crate::telegram::TelegramClient;
use crate::telegram::client::{AuthState, User};
use tauri::State;
use std::sync::Arc;

#[tauri::command]
pub async fn connect(
    client: State<'_, Arc<TelegramClient>>,
) -> Result<bool, String> {
    client.connect().await
}

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
) -> Result<AuthState, String> {
    Ok(client.get_auth_state().await)
}

#[tauri::command]
pub async fn get_current_user(
    client: State<'_, Arc<TelegramClient>>,
) -> Result<Option<User>, String> {
    Ok(client.get_current_user().await)
}

#[tauri::command]
pub async fn logout(
    client: State<'_, Arc<TelegramClient>>,
) -> Result<(), String> {
    client.logout().await
}
