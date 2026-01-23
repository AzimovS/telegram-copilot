use crate::telegram::{TelegramClient, client::{Chat, Message}};
use tauri::State;
use std::sync::Arc;

#[tauri::command]
pub async fn get_chats(
    client: State<'_, Arc<TelegramClient>>,
    limit: i32,
) -> Result<Vec<Chat>, String> {
    client.get_chats(limit).await
}

#[tauri::command]
pub async fn get_chat_messages(
    client: State<'_, Arc<TelegramClient>>,
    chat_id: i64,
    limit: i32,
    from_message_id: Option<i64>,
) -> Result<Vec<Message>, String> {
    client.get_chat_messages(chat_id, limit, from_message_id).await
}

#[tauri::command]
pub async fn send_message(
    client: State<'_, Arc<TelegramClient>>,
    chat_id: i64,
    text: String,
) -> Result<Message, String> {
    client.send_message(chat_id, &text).await
}
