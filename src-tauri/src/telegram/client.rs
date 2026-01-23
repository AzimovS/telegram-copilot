use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock, broadcast};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AuthState {
    WaitPhoneNumber,
    WaitCode { phone_number: String },
    WaitPassword { hint: String },
    Ready,
    LoggingOut,
    Closed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub first_name: String,
    pub last_name: String,
    pub username: Option<String>,
    pub phone_number: Option<String>,
    pub profile_photo_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chat {
    pub id: i64,
    #[serde(rename = "type")]
    pub chat_type: String,
    pub title: String,
    pub unread_count: i32,
    pub is_pinned: bool,
    pub order: i64,
    pub photo: Option<String>,
    pub last_message: Option<Message>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: i64,
    pub chat_id: i64,
    pub sender_id: i64,
    pub sender_name: String,
    pub content: MessageContent,
    pub date: i64,
    pub is_outgoing: bool,
    pub is_read: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum MessageContent {
    Text { text: String },
    Photo { caption: Option<String> },
    Video { caption: Option<String> },
    Document { file_name: String },
    Voice { duration: i32 },
    Sticker { emoji: Option<String> },
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Folder {
    pub id: i32,
    pub title: String,
    pub included_chat_ids: Vec<i64>,
    pub excluded_chat_ids: Vec<i64>,
    pub include_contacts: bool,
    pub include_non_contacts: bool,
    pub include_groups: bool,
    pub include_channels: bool,
    pub include_bots: bool,
}

/// Events emitted by the Telegram client
#[derive(Debug, Clone)]
pub enum TelegramEvent {
    AuthStateChanged(AuthState),
    NewMessage(Message),
    MessageUpdated(Message),
    ChatUpdated(Chat),
    UserUpdated(User),
    Error(String),
}

/// Configuration for TDLib
#[derive(Debug, Clone)]
pub struct TdLibConfig {
    pub api_id: i32,
    pub api_hash: String,
    pub database_directory: String,
    pub files_directory: String,
    pub use_test_dc: bool,
}

impl Default for TdLibConfig {
    fn default() -> Self {
        Self {
            api_id: 0, // Must be set from environment
            api_hash: String::new(),
            database_directory: String::from("tdlib"),
            files_directory: String::from("tdlib_files"),
            use_test_dc: false,
        }
    }
}

pub struct TelegramClient {
    auth_state: Arc<RwLock<AuthState>>,
    current_user: Arc<RwLock<Option<User>>>,
    chats: Arc<RwLock<HashMap<i64, Chat>>>,
    users: Arc<RwLock<HashMap<i64, User>>>,
    event_tx: broadcast::Sender<TelegramEvent>,
    config: TdLibConfig,
    #[cfg(feature = "tdlib-integration")]
    tdlib_client: Option<tdlib::Client>,
}

impl TelegramClient {
    pub fn new(config: TdLibConfig) -> Self {
        let (event_tx, _) = broadcast::channel(100);

        Self {
            auth_state: Arc::new(RwLock::new(AuthState::WaitPhoneNumber)),
            current_user: Arc::new(RwLock::new(None)),
            chats: Arc::new(RwLock::new(HashMap::new())),
            users: Arc::new(RwLock::new(HashMap::new())),
            event_tx,
            config,
            #[cfg(feature = "tdlib-integration")]
            tdlib_client: None,
        }
    }

    /// Subscribe to Telegram events
    pub fn subscribe(&self) -> broadcast::Receiver<TelegramEvent> {
        self.event_tx.subscribe()
    }

    /// Emit an event to all subscribers
    fn emit_event(&self, event: TelegramEvent) {
        let _ = self.event_tx.send(event);
    }

    pub async fn get_auth_state(&self) -> AuthState {
        self.auth_state.read().await.clone()
    }

    pub async fn set_auth_state(&self, state: AuthState) {
        let mut auth_state = self.auth_state.write().await;
        *auth_state = state.clone();
        self.emit_event(TelegramEvent::AuthStateChanged(state));
    }

    pub async fn get_current_user(&self) -> Option<User> {
        self.current_user.read().await.clone()
    }

    /// Initialize TDLib and start receiving updates
    #[cfg(feature = "tdlib-integration")]
    pub async fn initialize(&mut self) -> Result<(), String> {
        // Real TDLib initialization would go here
        // This requires the tdlib crate and TDLib to be installed
        log::info!("Initializing TDLib...");

        // Set TDLib parameters
        // Start update handler
        // Handle authorization flow

        Ok(())
    }

    #[cfg(not(feature = "tdlib-integration"))]
    pub async fn initialize(&mut self) -> Result<(), String> {
        log::info!("TDLib integration not enabled, using mock mode");
        Ok(())
    }

    /// Send phone number for authentication
    pub async fn send_phone_number(&self, phone_number: &str) -> Result<(), String> {
        log::info!("Sending phone number: {}", phone_number);

        #[cfg(feature = "tdlib-integration")]
        {
            // Real implementation:
            // tdlib::functions::set_authentication_phone_number(phone_number, settings)
        }

        // For now, simulate success and move to code verification
        self.set_auth_state(AuthState::WaitCode {
            phone_number: phone_number.to_string(),
        })
        .await;

        Ok(())
    }

    /// Send authentication code
    pub async fn send_auth_code(&self, code: &str) -> Result<(), String> {
        log::info!("Sending auth code");

        #[cfg(feature = "tdlib-integration")]
        {
            // Real implementation:
            // tdlib::functions::check_authentication_code(code)
        }

        // For now, simulate success
        // In real implementation, this might transition to WaitPassword or Ready
        self.set_auth_state(AuthState::Ready).await;

        // Set a mock user
        *self.current_user.write().await = Some(User {
            id: 12345,
            first_name: "Demo".to_string(),
            last_name: "User".to_string(),
            username: Some("demo_user".to_string()),
            phone_number: None,
            profile_photo_url: None,
        });

        Ok(())
    }

    /// Send 2FA password
    pub async fn send_password(&self, password: &str) -> Result<(), String> {
        log::info!("Sending 2FA password");

        #[cfg(feature = "tdlib-integration")]
        {
            // Real implementation:
            // tdlib::functions::check_authentication_password(password)
        }

        self.set_auth_state(AuthState::Ready).await;
        Ok(())
    }

    /// Logout from Telegram
    pub async fn logout(&self) -> Result<(), String> {
        log::info!("Logging out");

        #[cfg(feature = "tdlib-integration")]
        {
            // Real implementation:
            // tdlib::functions::log_out()
        }

        self.set_auth_state(AuthState::WaitPhoneNumber).await;
        *self.current_user.write().await = None;
        self.chats.write().await.clear();

        Ok(())
    }

    /// Get chat list
    pub async fn get_chats(&self, limit: i32) -> Result<Vec<Chat>, String> {
        log::info!("Getting chats, limit: {}", limit);

        #[cfg(feature = "tdlib-integration")]
        {
            // Real implementation:
            // tdlib::functions::get_chats(chat_list, limit)
        }

        // Return cached chats
        let chats = self.chats.read().await;
        let mut chat_list: Vec<Chat> = chats.values().cloned().collect();
        chat_list.sort_by(|a, b| b.order.cmp(&a.order));
        chat_list.truncate(limit as usize);

        Ok(chat_list)
    }

    /// Get messages from a chat
    pub async fn get_chat_messages(
        &self,
        chat_id: i64,
        limit: i32,
        from_message_id: Option<i64>,
    ) -> Result<Vec<Message>, String> {
        log::info!(
            "Getting messages for chat {}, limit: {}, from: {:?}",
            chat_id, limit, from_message_id
        );

        #[cfg(feature = "tdlib-integration")]
        {
            // Real implementation:
            // tdlib::functions::get_chat_history(chat_id, from_message_id, offset, limit, only_local)
        }

        // Return empty for now - real messages come from TDLib
        Ok(vec![])
    }

    /// Send a text message
    pub async fn send_message(&self, chat_id: i64, text: &str) -> Result<Message, String> {
        log::info!("Sending message to chat {}: {}", chat_id, text);

        #[cfg(feature = "tdlib-integration")]
        {
            // Real implementation:
            // let content = tdlib::types::InputMessageContent::InputMessageText { ... };
            // tdlib::functions::send_message(chat_id, 0, None, None, None, content)
        }

        // Create a mock message for demo
        let message = Message {
            id: chrono::Utc::now().timestamp(),
            chat_id,
            sender_id: self.current_user.read().await.as_ref().map(|u| u.id).unwrap_or(0),
            sender_name: "You".to_string(),
            content: MessageContent::Text { text: text.to_string() },
            date: chrono::Utc::now().timestamp(),
            is_outgoing: true,
            is_read: false,
        };

        self.emit_event(TelegramEvent::NewMessage(message.clone()));
        Ok(message)
    }

    /// Get chat folders
    pub async fn get_folders(&self) -> Result<Vec<Folder>, String> {
        log::info!("Getting folders");

        #[cfg(feature = "tdlib-integration")]
        {
            // Real implementation:
            // tdlib::functions::get_chat_folder_info()
        }

        // Return empty for now
        Ok(vec![])
    }

    /// Get contacts
    pub async fn get_contacts(&self) -> Result<Vec<User>, String> {
        log::info!("Getting contacts");

        #[cfg(feature = "tdlib-integration")]
        {
            // Real implementation:
            // tdlib::functions::get_contacts()
        }

        // Return cached users that are contacts
        let users = self.users.read().await;
        Ok(users.values().cloned().collect())
    }

    /// Search for chats and messages
    pub async fn search(&self, query: &str, limit: i32) -> Result<Vec<Chat>, String> {
        log::info!("Searching for: {}", query);

        #[cfg(feature = "tdlib-integration")]
        {
            // Real implementation:
            // tdlib::functions::search_chats(query, limit)
        }

        // Simple local search
        let chats = self.chats.read().await;
        let query_lower = query.to_lowercase();
        let results: Vec<Chat> = chats
            .values()
            .filter(|c| c.title.to_lowercase().contains(&query_lower))
            .take(limit as usize)
            .cloned()
            .collect();

        Ok(results)
    }

    /// Mark messages as read
    pub async fn mark_as_read(&self, chat_id: i64, message_ids: Vec<i64>) -> Result<(), String> {
        log::info!("Marking {} messages as read in chat {}", message_ids.len(), chat_id);

        #[cfg(feature = "tdlib-integration")]
        {
            // Real implementation:
            // tdlib::functions::view_messages(chat_id, message_ids, source, force_read)
        }

        Ok(())
    }

    /// Update local chat cache
    pub async fn update_chat(&self, chat: Chat) {
        let mut chats = self.chats.write().await;
        chats.insert(chat.id, chat.clone());
        self.emit_event(TelegramEvent::ChatUpdated(chat));
    }

    /// Update local user cache
    pub async fn update_user(&self, user: User) {
        let mut users = self.users.write().await;
        users.insert(user.id, user.clone());
        self.emit_event(TelegramEvent::UserUpdated(user));
    }
}

impl Default for TelegramClient {
    fn default() -> Self {
        Self::new(TdLibConfig::default())
    }
}
