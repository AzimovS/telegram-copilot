mod commands;
mod db;
pub mod error;
mod telegram;
mod utils;

use commands::{auth, chats, contacts, offboard, outreach, scopes};
use utils::rate_limiter::RateLimiter;
use std::path::PathBuf;
use std::sync::Arc;
use telegram::{TelegramClient, client::TelegramConfig};
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
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging first
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    // Load .env file - try multiple locations
    let env_paths = [
        std::path::PathBuf::from(".env"),
        std::path::PathBuf::from("../.env"),  // When running from src-tauri
    ];

    let mut env_loaded = false;
    for path in &env_paths {
        if path.exists() {
            match dotenvy::from_path(path) {
                Ok(_) => {
                    log::info!("Loaded .env from: {:?}", path.canonicalize().unwrap_or(path.clone()));
                    env_loaded = true;
                    break;
                }
                Err(e) => {
                    log::warn!("Failed to load .env from {:?}: {}", path, e);
                }
            }
        }
    }

    if !env_loaded {
        log::warn!("No .env file found. Using environment variables directly.");
    }

    // Load config from environment
    let api_id: i32 = std::env::var("TELEGRAM_API_ID")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    let api_hash = std::env::var("TELEGRAM_API_HASH").unwrap_or_default();

    let use_test_dc = std::env::var("TELEGRAM_USE_TEST_DC")
        .map(|s| s == "1" || s.to_lowercase() == "true")
        .unwrap_or(false);

    log::info!("TELEGRAM_API_ID: {}", if api_id != 0 { api_id.to_string() } else { "(not set)".to_string() });
    log::info!("TELEGRAM_API_HASH: {}", if !api_hash.is_empty() { format!("{}...", &api_hash[..8.min(api_hash.len())]) } else { "(not set)".to_string() });

    if api_id == 0 || api_hash.is_empty() {
        log::error!("TELEGRAM_API_ID and TELEGRAM_API_HASH must be set!");
        log::error!("Get your credentials from https://my.telegram.org");
        log::error!("Create a .env file in the project root with:");
        log::error!("  TELEGRAM_API_ID=your_api_id");
        log::error!("  TELEGRAM_API_HASH=your_api_hash");
    }

    // Create shared state - will be initialized with app data dir in setup
    let telegram_config = TelegramConfig {
        api_id,
        api_hash,
        session_file: PathBuf::from("telegram.session"), // Will be updated in setup
        use_test_dc,
    };

    let telegram_client = Arc::new(TelegramClient::new(telegram_config));
    let outreach_manager = Arc::new(outreach::OutreachManager::new());
    let outreach_manager_clone = outreach_manager.clone();
    let rate_limiter = Arc::new(RateLimiter::new(60)); // 60 seconds min interval between messages
    let user_hash_cache = Arc::new(offboard::UserAccessHashCache::new());
    let chat_data_cache = Arc::new(offboard::ChatDataCache::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(telegram_client.clone())
        .manage(outreach_manager.clone())
        .manage(rate_limiter)
        .manage(user_hash_cache)
        .manage(chat_data_cache)
        .setup(move |app| {
            // Initialize database
            let app_dir = match app.path().app_data_dir() {
                Ok(dir) => dir,
                Err(e) => {
                    log::error!("Failed to get app data dir: {}", e);
                    return Err(Box::new(std::io::Error::new(
                        std::io::ErrorKind::Other,
                        format!("Failed to get app data directory: {}", e),
                    )));
                }
            };

            if let Err(e) = std::fs::create_dir_all(&app_dir) {
                log::error!("Failed to create app data dir: {}", e);
                return Err(Box::new(e));
            }

            if let Err(e) = db::init_db(app_dir.clone()) {
                log::error!("Failed to initialize database: {}", e);
                return Err(Box::new(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to initialize database: {}", e),
                )));
            }

            log::info!("App data directory: {:?}", app_dir);
            log::info!("Telegram Copilot started");
            log::info!("API ID configured: {}", api_id != 0);
            log::info!("Test DC: {}", use_test_dc);

            // Set session file path in app data directory
            let session_path = app_dir.join("telegram.session");
            telegram_client.set_session_file(session_path);

            // Restore outreach queues from database
            let manager = outreach_manager_clone.clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = manager.restore_from_db().await {
                    log::error!("Failed to restore outreach queues: {}", e);
                }
            });

            // Setup Telegram event forwarding to frontend
            setup_telegram_events(app, telegram_client.clone());

            // Connect to Telegram in background
            let client = telegram_client.clone();
            tauri::async_runtime::spawn(async move {
                match client.connect().await {
                    Ok(authorized) => {
                        log::info!("Telegram connected, authorized: {}", authorized);
                    }
                    Err(e) => {
                        log::error!("Failed to connect to Telegram: {}", e);
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth commands
            auth::connect,
            auth::send_phone_number,
            auth::send_auth_code,
            auth::send_password,
            auth::get_auth_state,
            auth::get_current_user,
            auth::logout,
            // Chat commands
            chats::get_chats,
            chats::get_chat_messages,
            chats::send_message,
            chats::invalidate_chat_cache,
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
            // Offboard commands
            offboard::get_common_groups,
            offboard::remove_from_group,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
