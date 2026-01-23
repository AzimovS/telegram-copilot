mod commands;
mod db;
mod telegram;
mod utils;

use commands::{auth, chats, contacts, outreach, scopes};
use std::sync::Arc;
use telegram::{TelegramClient, client::TdLibConfig};
use tauri::{Manager, Emitter};

fn setup_telegram_events(app: &tauri::App, client: Arc<TelegramClient>) {
    let app_handle = app.handle().clone();
    let mut receiver = client.subscribe();

    tauri::async_runtime::spawn(async move {
        while let Ok(event) = receiver.recv().await {
            match &event {
                telegram::client::TelegramEvent::AuthStateChanged(state) => {
                    let _ = app_handle.emit("telegram://auth-state", state);
                }
                telegram::client::TelegramEvent::NewMessage(message) => {
                    let _ = app_handle.emit("telegram://new-message", message);
                }
                telegram::client::TelegramEvent::ChatUpdated(chat) => {
                    let _ = app_handle.emit("telegram://chat-updated", chat);
                }
                telegram::client::TelegramEvent::UserUpdated(user) => {
                    let _ = app_handle.emit("telegram://user-updated", user);
                }
                telegram::client::TelegramEvent::Error(error) => {
                    let _ = app_handle.emit("telegram://error", error);
                }
                _ => {}
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    env_logger::init();

    // Load TDLib config from environment
    let tdlib_config = TdLibConfig {
        api_id: std::env::var("TELEGRAM_API_ID")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(0),
        api_hash: std::env::var("TELEGRAM_API_HASH").unwrap_or_default(),
        database_directory: String::from("tdlib"),
        files_directory: String::from("tdlib_files"),
        use_test_dc: std::env::var("TELEGRAM_USE_TEST_DC")
            .map(|s| s == "1" || s.to_lowercase() == "true")
            .unwrap_or(false),
    };

    // Create shared state
    let telegram_client = Arc::new(TelegramClient::new(tdlib_config));
    let outreach_manager = Arc::new(outreach::OutreachManager::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(telegram_client.clone())
        .manage(outreach_manager)
        .setup(move |app| {
            // Initialize database
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_dir).expect("Failed to create app data dir");
            db::init_db(app_dir).expect("Failed to initialize database");

            // Setup Telegram event forwarding to frontend
            setup_telegram_events(app, telegram_client.clone());

            log::info!("Telegram Copilot started");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth commands
            auth::send_phone_number,
            auth::send_auth_code,
            auth::send_password,
            auth::get_auth_state,
            auth::logout,
            // Chat commands
            chats::get_chats,
            chats::get_chat_messages,
            chats::send_message,
            // Contact commands
            contacts::get_contacts,
            contacts::add_contact_tag,
            contacts::remove_contact_tag,
            contacts::update_contact_notes,
            contacts::get_all_tags,
            // Scope commands
            scopes::get_folders,
            scopes::save_scope,
            scopes::load_scope,
            scopes::list_scopes,
            scopes::delete_scope,
            // Outreach commands
            outreach::queue_outreach_messages,
            outreach::get_outreach_status,
            outreach::cancel_outreach,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
