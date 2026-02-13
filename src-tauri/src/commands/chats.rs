use crate::telegram::{TelegramClient, client::{Chat, Message, ChatFilters, BatchMessageRequest, BatchMessageResult}};
use tauri::State;
use std::sync::Arc;

#[tauri::command]
pub async fn get_chats(
    client: State<'_, Arc<TelegramClient>>,
    limit: i32,
    filters: Option<ChatFilters>,
) -> Result<Vec<Chat>, String> {
    client.get_chats(limit, filters).await
}

#[tauri::command]
pub async fn get_chat(
    client: State<'_, Arc<TelegramClient>>,
    chat_id: i64,
) -> Result<Option<Chat>, String> {
    client.get_chat(chat_id).await
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

#[tauri::command]
pub async fn get_batch_messages(
    client: State<'_, Arc<TelegramClient>>,
    requests: Vec<BatchMessageRequest>,
) -> Result<Vec<BatchMessageResult>, String> {
    client.get_batch_messages(requests).await
}

#[tauri::command]
pub async fn invalidate_chat_cache(
    client: State<'_, Arc<TelegramClient>>,
) -> Result<(), String> {
    client.invalidate_cache().await;
    Ok(())
}
