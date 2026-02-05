use grammers_client::{Client, Config, InitParams, SignInError};
use grammers_client::types::PasswordToken;
use grammers_session::Session;
use grammers_tl_types as tl;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, RwLock as StdRwLock};
use tokio::sync::{broadcast, RwLock, Mutex, Semaphore};

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
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: i64,
    pub first_name: String,
    pub last_name: String,
    pub username: Option<String>,
    pub phone_number: Option<String>,
    pub profile_photo_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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
    pub member_count: Option<i32>,
    #[serde(default)]
    pub is_muted: bool,
    #[serde(default)]
    pub is_archived: bool,
    #[serde(default)]
    pub is_bot: bool,
    #[serde(default)]
    pub is_contact: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ChatFilters {
    // Include DMs with users in contacts list
    #[serde(default = "default_true")]
    pub include_private_chats: bool,
    // Include DMs with users NOT in contacts list
    #[serde(default = "default_true")]
    pub include_non_contacts: bool,
    #[serde(default = "default_true")]
    pub include_groups: bool,
    #[serde(default = "default_true")]
    pub include_channels: bool,
    #[serde(default)]
    pub include_bots: bool,
    #[serde(default)]
    pub include_archived: bool,
    #[serde(default)]
    pub include_muted: bool,
    // None = no limit, Some(n) = min members required
    pub group_size_min: Option<i32>,
    // None = no limit, Some(n) = max n members allowed
    pub group_size_max: Option<i32>,
    // Empty = no folder filtering, non-empty = only show chats in these folders
    #[serde(default)]
    pub selected_folder_ids: Vec<i32>,
    // Pre-computed list of chat IDs from selected folders (union of all included_chat_ids)
    // Empty = no folder filtering, non-empty = only show chats with these IDs
    #[serde(default)]
    pub folder_chat_ids: Vec<i64>,
    // Only include chats with unread messages (unread_count > 0)
    #[serde(default)]
    pub include_unread_only: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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
    Document {
        #[serde(rename = "fileName")]
        file_name: String,
    },
    Voice { duration: i32 },
    Sticker { emoji: Option<String> },
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub id: i32,
    pub title: String,
    pub emoticon: Option<String>,
    pub included_chat_ids: Vec<i64>,
    pub excluded_chat_ids: Vec<i64>,
    pub include_contacts: bool,
    pub include_non_contacts: bool,
    pub include_groups: bool,
    pub include_channels: bool,
    pub include_bots: bool,
}

#[derive(Debug, Clone)]
pub struct CommonChat {
    pub id: i64,
    pub title: String,
    pub member_count: Option<i32>,
    pub can_remove: bool,
    pub raw_chat: tl::enums::Chat,
}

/// Events emitted by the Telegram client.
/// Note: Some variants (ChatUpdated, UserUpdated, Error) are set up for future
/// real-time update handling. Handlers exist in lib.rs but emission isn't
/// yet implemented for all update types.
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub enum TelegramEvent {
    AuthStateChanged(AuthState),
    NewMessage(Message),
    ChatUpdated(Chat),
    UserUpdated(User),
    Error(String),
}

/// Configuration for Telegram client
#[derive(Debug, Clone)]
pub struct TelegramConfig {
    pub api_id: i32,
    pub api_hash: String,
    pub session_file: PathBuf,
    /// Whether to use Telegram's test DC (not currently implemented).
    /// TODO: Implement test DC support via grammers InitParams when needed.
    #[allow(dead_code)]
    pub use_test_dc: bool,
}

impl Default for TelegramConfig {
    fn default() -> Self {
        Self {
            api_id: 0,
            api_hash: String::new(),
            session_file: PathBuf::from("telegram.session"),
            use_test_dc: false,
        }
    }
}

pub struct TelegramClient {
    client: Arc<RwLock<Option<Client>>>,
    auth_state: Arc<RwLock<AuthState>>,
    current_user: Arc<RwLock<Option<User>>>,
    event_tx: broadcast::Sender<TelegramEvent>,
    config: StdRwLock<TelegramConfig>,
    login_token: Arc<Mutex<Option<grammers_client::types::LoginToken>>>,
    password_token: Arc<Mutex<Option<PasswordToken>>>,
    phone_number: Arc<RwLock<Option<String>>>,
    // Chat cache to avoid repeated GetDialogs calls
    chat_cache: Arc<RwLock<HashMap<i64, grammers_client::types::Chat>>>,
    cache_loaded: Arc<RwLock<bool>>,
    // Semaphore to prevent concurrent dialog loading
    dialog_semaphore: Arc<Semaphore>,
}

impl TelegramClient {
    pub fn new(config: TelegramConfig) -> Self {
        let (event_tx, _) = broadcast::channel(100);

        Self {
            client: Arc::new(RwLock::new(None)),
            auth_state: Arc::new(RwLock::new(AuthState::WaitPhoneNumber)),
            current_user: Arc::new(RwLock::new(None)),
            event_tx,
            config: StdRwLock::new(config),
            login_token: Arc::new(Mutex::new(None)),
            password_token: Arc::new(Mutex::new(None)),
            phone_number: Arc::new(RwLock::new(None)),
            chat_cache: Arc::new(RwLock::new(HashMap::new())),
            cache_loaded: Arc::new(RwLock::new(false)),
            dialog_semaphore: Arc::new(Semaphore::new(1)), // Only one dialog load at a time
        }
    }

    /// Set the session file path (must be called before connect)
    pub fn set_session_file(&self, path: PathBuf) {
        self.config.write().unwrap().session_file = path;
    }

    /// Ensure parent directory exists and save session to file
    fn save_session_to_file(session: &grammers_session::Session, path: &PathBuf) -> Result<(), String> {
        // Log the path for debugging
        log::info!("Saving session to: {:?}", path);

        // Warn if path is not absolute - this could indicate a configuration issue
        if !path.is_absolute() {
            log::warn!("Session file path is not absolute: {:?}. This may cause issues.", path);
        }

        if let Some(parent) = path.parent() {
            // Only create directory if parent is not empty (handles relative paths like "file.session")
            if !parent.as_os_str().is_empty() {
                log::debug!("Creating session directory: {:?}", parent);
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create session directory {:?}: {}", parent, e))?;
            }
        }
        session.save_to_file(path)
            .map_err(|e| format!("Failed to save session to {:?}: {}", path, e))
    }

    /// Check if an error message indicates a connection failure that can be retried
    fn is_connection_error(error: &str) -> bool {
        error.contains("read error")
            || error.contains("IO failed")
            || error.contains("read 0 bytes")
            || error.contains("connection")
            || error.contains("timed out")
            || error.contains("broken pipe")
    }

    /// Reconnect to Telegram using saved session
    pub async fn reconnect(&self) -> Result<(), String> {
        log::info!("Reconnecting to Telegram...");

        let (session_file, api_id, api_hash) = {
            let config = self.config.read().unwrap();
            (config.session_file.clone(), config.api_id, config.api_hash.clone())
        };

        let session = Session::load_file_or_create(&session_file)
            .map_err(|e| format!("Failed to load session: {}", e))?;

        let client = Client::connect(Config {
            session,
            api_id,
            api_hash,
            params: InitParams::default(),
        })
        .await
        .map_err(|e| format!("Failed to reconnect: {}", e))?;

        // Verify we're still authorized
        let is_authorized = client.is_authorized().await
            .map_err(|e| format!("Failed to check auth after reconnect: {}", e))?;

        if !is_authorized {
            return Err("Session expired. Please log in again.".to_string());
        }

        // Save session after successful reconnect
        Self::save_session_to_file(client.session(), &session_file)
            .map_err(|e| format!("Failed to save session after reconnect: {}", e))?;

        // Clear cache since connection was reset
        *self.cache_loaded.write().await = false;
        self.chat_cache.write().await.clear();

        *self.client.write().await = Some(client);
        log::info!("Reconnected successfully");

        Ok(())
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

    /// Connect to Telegram and check if already authorized
    pub async fn connect(&self) -> Result<bool, String> {
        log::info!("Connecting to Telegram...");

        let (session_file, api_id, api_hash) = {
            let config = self.config.read().unwrap();
            (config.session_file.clone(), config.api_id, config.api_hash.clone())
        };

        log::info!("Session file path for connect: {:?}", session_file);

        let session = Session::load_file_or_create(&session_file)
            .map_err(|e| format!("Failed to load session: {}", e))?;

        let client = Client::connect(Config {
            session,
            api_id,
            api_hash,
            params: InitParams::default(),
        })
        .await
        .map_err(|e| format!("Failed to connect: {}", e))?;

        let is_authorized = client.is_authorized().await
            .map_err(|e| format!("Failed to check auth: {}", e))?;

        if is_authorized {
            log::info!("Already authorized");

            // Get current user info
            if let Ok(me) = client.get_me().await {
                let user = User {
                    id: me.id(),
                    first_name: me.first_name().to_string(),
                    last_name: me.last_name().unwrap_or("").to_string(),
                    username: me.username().map(|s| s.to_string()),
                    phone_number: me.phone().map(|s| s.to_string()),
                    profile_photo_url: None,
                };
                *self.current_user.write().await = Some(user);
            }

            self.set_auth_state(AuthState::Ready).await;
        } else {
            log::info!("Not authorized, need to login");
            self.set_auth_state(AuthState::WaitPhoneNumber).await;
        }

        // Save session - propagate errors to ensure session integrity
        Self::save_session_to_file(client.session(), &session_file)
            .map_err(|e| format!("Failed to save session after connect: {}", e))?;

        *self.client.write().await = Some(client);

        Ok(is_authorized)
    }

    /// Send phone number for authentication
    pub async fn send_phone_number(&self, phone_number: &str) -> Result<(), String> {
        log::info!("Sending phone number: {}", phone_number);

        let client_guard = self.client.read().await;
        let client = client_guard.as_ref().ok_or("Client not connected")?;

        let token = client
            .request_login_code(phone_number)
            .await
            .map_err(|e| format!("Failed to request code: {}", e))?;

        *self.login_token.lock().await = Some(token);
        *self.phone_number.write().await = Some(phone_number.to_string());

        self.set_auth_state(AuthState::WaitCode {
            phone_number: phone_number.to_string(),
        })
        .await;

        Ok(())
    }

    /// Send authentication code
    pub async fn send_auth_code(&self, code: &str) -> Result<(), String> {
        log::info!("Sending auth code");

        let session_file = self.config.read().unwrap().session_file.clone();
        log::info!("Session file path: {:?}", session_file);

        let client_guard = self.client.read().await;
        let client = client_guard.as_ref().ok_or("Client not connected")?;

        let mut token_guard = self.login_token.lock().await;
        let login_token = token_guard.take().ok_or("No login token")?;

        match client.sign_in(&login_token, code).await {
            Ok(user) => {
                log::info!("Signed in as: {}", user.first_name());

                let current_user = User {
                    id: user.id(),
                    first_name: user.first_name().to_string(),
                    last_name: user.last_name().unwrap_or("").to_string(),
                    username: user.username().map(|s| s.to_string()),
                    phone_number: self.phone_number.read().await.clone(),
                    profile_photo_url: None,
                };

                *self.current_user.write().await = Some(current_user);

                // Save session - propagate errors to ensure session integrity
                Self::save_session_to_file(client.session(), &session_file)
                    .map_err(|e| format!("Failed to save session after sign in: {}", e))?;

                self.set_auth_state(AuthState::Ready).await;
                Ok(())
            }
            Err(SignInError::PasswordRequired(password_token)) => {
                log::info!("2FA password required");
                let hint = password_token.hint().unwrap_or("").to_string();

                // Store the password token for later use
                *self.password_token.lock().await = Some(password_token);

                self.set_auth_state(AuthState::WaitPassword { hint: hint.clone() }).await;
                // Return error to signal frontend to show password input
                Err(format!("2FA required. Hint: {}", hint))
            }
            Err(SignInError::InvalidCode) => {
                // Put the token back so they can try again
                *token_guard = Some(login_token);
                Err("Invalid code. Please try again.".to_string())
            }
            Err(e) => {
                Err(format!("Sign in failed: {}", e))
            }
        }
    }

    /// Send 2FA password
    pub async fn send_password(&self, password: &str) -> Result<(), String> {
        log::info!("Sending 2FA password");

        let session_file = self.config.read().unwrap().session_file.clone();

        let client_guard = self.client.read().await;
        let client = client_guard.as_ref().ok_or("Client not connected")?;

        let phone = self.phone_number.read().await.clone()
            .ok_or("No phone number stored")?;

        // Get the stored password token
        let mut password_token_guard = self.password_token.lock().await;
        let password_token = password_token_guard.take()
            .ok_or("No password token stored. Please restart the login process.")?;

        match client.check_password(password_token, password.to_string()).await {
            Ok(user) => {
                let current_user = User {
                    id: user.id(),
                    first_name: user.first_name().to_string(),
                    last_name: user.last_name().unwrap_or("").to_string(),
                    username: user.username().map(|s| s.to_string()),
                    phone_number: Some(phone),
                    profile_photo_url: None,
                };

                *self.current_user.write().await = Some(current_user);

                // Save session - propagate errors to ensure session integrity
                Self::save_session_to_file(client.session(), &session_file)
                    .map_err(|e| format!("Failed to save session after password check: {}", e))?;

                self.set_auth_state(AuthState::Ready).await;
                Ok(())
            }
            Err(e) => {
                Err(format!("Password check failed: {}", e))
            }
        }
    }

    /// Logout from Telegram
    pub async fn logout(&self) -> Result<(), String> {
        log::info!("Logging out");

        let session_file = self.config.read().unwrap().session_file.clone();

        let client_guard = self.client.read().await;
        if let Some(client) = client_guard.as_ref() {
            let _ = client.sign_out().await;
        }

        // Delete session file
        let _ = std::fs::remove_file(&session_file);

        // Clear chat cache to prevent data leaking between accounts
        *self.cache_loaded.write().await = false;
        self.chat_cache.write().await.clear();

        *self.current_user.write().await = None;
        self.set_auth_state(AuthState::WaitPhoneNumber).await;

        Ok(())
    }

    /// Ensure the chat cache is loaded (with semaphore to prevent concurrent loads)
    async fn ensure_cache_loaded(&self, limit: i32) -> Result<(), String> {
        // Check if already loaded
        if *self.cache_loaded.read().await {
            return Ok(());
        }

        // Acquire semaphore to prevent concurrent loads
        let _permit = self.dialog_semaphore.acquire().await
            .map_err(|e| format!("Failed to acquire semaphore: {}", e))?;

        // Double-check after acquiring lock
        if *self.cache_loaded.read().await {
            return Ok(());
        }

        log::info!("Loading chat cache...");

        let client_guard = self.client.read().await;
        let client = client_guard.as_ref().ok_or("Client not connected")?;

        let mut dialogs = client.iter_dialogs();
        let mut cache = self.chat_cache.write().await;
        let mut count = 0;

        while let Some(dialog) = dialogs.next().await.map_err(|e| format!("Failed to get dialogs: {}", e))? {
            if count >= limit {
                break;
            }

            let chat = dialog.chat;
            cache.insert(chat.id(), chat);
            count += 1;
        }

        *self.cache_loaded.write().await = true;
        log::info!("Chat cache loaded with {} chats", cache.len());

        Ok(())
    }

    /// Get a chat from cache by ID
    async fn get_cached_chat(&self, chat_id: i64) -> Option<grammers_client::types::Chat> {
        self.chat_cache.read().await.get(&chat_id).cloned()
    }

    /// Invalidate the chat cache (call when chats might have changed).
    /// TODO: Call this when receiving chat update events.
    #[allow(dead_code)]
    pub async fn invalidate_cache(&self) {
        *self.cache_loaded.write().await = false;
        self.chat_cache.write().await.clear();
    }

    /// Get a single chat by ID (optimized for fast lookups)
    /// Uses cache first, then loads cache if needed
    pub async fn get_chat(&self, chat_id: i64) -> Result<Option<Chat>, String> {
        log::info!("Getting chat {}", chat_id);

        // Try the operation, reconnect and retry once on connection error
        match self.get_chat_inner(chat_id).await {
            Ok(chat) => Ok(chat),
            Err(e) if Self::is_connection_error(&e) => {
                log::warn!("Connection error getting chat, attempting reconnect: {}", e);
                self.reconnect().await?;
                self.get_chat_inner(chat_id).await
            }
            Err(e) => Err(e),
        }
    }

    async fn get_chat_inner(&self, chat_id: i64) -> Result<Option<Chat>, String> {
        // 1. Try cache first (fast path)
        if let Some(chat) = self.get_cached_chat(chat_id).await {
            return Ok(Some(self.convert_cached_chat_to_chat(&chat)));
        }

        // 2. Cache miss - load cache if not loaded
        self.ensure_cache_loaded(200).await?;

        // 3. Try cache again
        if let Some(chat) = self.get_cached_chat(chat_id).await {
            return Ok(Some(self.convert_cached_chat_to_chat(&chat)));
        }

        // Chat not found
        Ok(None)
    }

    /// Convert a cached grammers chat to our Chat type
    fn convert_cached_chat_to_chat(&self, chat: &grammers_client::types::Chat) -> Chat {
        let (chat_type, is_bot, is_contact) = match chat {
            grammers_client::types::Chat::User(u) => {
                ("private", u.is_bot(), u.raw.contact)
            }
            grammers_client::types::Chat::Group(_) => ("group", false, false),
            grammers_client::types::Chat::Channel(_) => ("channel", false, false),
        };

        let title = match chat {
            grammers_client::types::Chat::User(u) => {
                format!("{} {}", u.first_name(), u.last_name().unwrap_or(""))
            }
            grammers_client::types::Chat::Group(g) => g.title().to_string(),
            grammers_client::types::Chat::Channel(c) => c.title().to_string(),
        };

        let member_count = match chat {
            grammers_client::types::Chat::User(_) => None,
            grammers_client::types::Chat::Group(g) => {
                match &g.raw {
                    tl::enums::Chat::Chat(c) => Some(c.participants_count),
                    _ => None,
                }
            }
            grammers_client::types::Chat::Channel(c) => c.raw.participants_count,
        };

        Chat {
            id: chat.id(),
            chat_type: chat_type.to_string(),
            title: title.trim().to_string(),
            unread_count: 0, // Not available from cached chat alone
            is_pinned: false, // Not available from cached chat alone
            order: 0,
            photo: None,
            last_message: None,
            member_count,
            is_muted: false,
            is_archived: false,
            is_bot,
            is_contact,
        }
    }

    /// Get chat list (dialogs) with optional filters (with auto-reconnect on connection failure)
    pub async fn get_chats(&self, limit: i32, filters: Option<ChatFilters>) -> Result<Vec<Chat>, String> {
        log::info!("Getting chats, limit: {}", limit);

        // Try the operation, reconnect and retry once on connection error
        match self.get_chats_inner(limit, filters.clone()).await {
            Ok(chats) => Ok(chats),
            Err(e) if Self::is_connection_error(&e) => {
                log::warn!("Connection error getting chats, attempting reconnect: {}", e);
                self.reconnect().await?;
                self.get_chats_inner(limit, filters).await
            }
            Err(e) => Err(e),
        }
    }

    async fn get_chats_inner(&self, limit: i32, filters: Option<ChatFilters>) -> Result<Vec<Chat>, String> {
        let client_guard = self.client.read().await;
        let client = client_guard.as_ref().ok_or("Client not connected")?;

        // Acquire semaphore to prevent concurrent dialog loads
        let _permit = self.dialog_semaphore.acquire().await
            .map_err(|e| format!("Failed to acquire semaphore: {}", e))?;

        let filters = filters.unwrap_or_default();
        let mut dialogs = client.iter_dialogs();
        let mut chats = Vec::new();
        let mut count = 0;
        let mut cache = self.chat_cache.write().await;

        while let Some(dialog) = dialogs.next().await.map_err(|e| format!("Failed to get dialogs: {}", e))? {
            if count >= limit {
                break;
            }

            // Check if this is an archived folder
            let is_archived = match &dialog.raw {
                tl::enums::Dialog::Dialog(d) => d.folder_id == Some(1),
                tl::enums::Dialog::Folder(_) => continue, // Skip folder entries themselves
            };

            // Skip archived chats if not included (unless in a selected folder - checked below)
            // Note: We check folder membership first to allow archived chats from selected folders

            let chat = dialog.chat();

            // EARLY EXIT: If chat is in selected folders, include it (bypass all other filters)
            // This implements OR logic: folder chats show regardless of type/muted/archived/size filters
            if !filters.folder_chat_ids.is_empty() && filters.folder_chat_ids.contains(&chat.id()) {
                // Chat is in a selected folder - extract info and add to results
                let (chat_type, is_bot, is_contact) = match chat {
                    grammers_client::types::Chat::User(u) => {
                        ("private", u.is_bot(), u.raw.contact)
                    }
                    grammers_client::types::Chat::Group(_) => ("group", false, false),
                    grammers_client::types::Chat::Channel(_) => ("channel", false, false),
                };

                let title = match chat {
                    grammers_client::types::Chat::User(u) => {
                        format!("{} {}", u.first_name(), u.last_name().unwrap_or(""))
                    }
                    grammers_client::types::Chat::Group(g) => g.title().to_string(),
                    grammers_client::types::Chat::Channel(c) => c.title().to_string(),
                };

                let last_message = dialog.last_message.as_ref().map(|msg| {
                    let text = msg.text();
                    let content = if !text.is_empty() {
                        MessageContent::Text { text: text.to_string() }
                    } else if msg.photo().is_some() {
                        MessageContent::Photo { caption: None }
                    } else {
                        MessageContent::Unknown
                    };

                    Message {
                        id: msg.id() as i64,
                        chat_id: chat.id(),
                        sender_id: msg.sender().map(|s| s.id()).unwrap_or(0),
                        sender_name: msg.sender().map(|s| s.name().to_string()).unwrap_or_default(),
                        content,
                        date: msg.date().timestamp(),
                        is_outgoing: msg.outgoing(),
                        is_read: true,
                    }
                });

                let unread_count = match &dialog.raw {
                    tl::enums::Dialog::Dialog(d) => d.unread_count,
                    tl::enums::Dialog::Folder(_) => 0,
                };

                let is_pinned = match &dialog.raw {
                    tl::enums::Dialog::Dialog(d) => d.pinned,
                    tl::enums::Dialog::Folder(_) => false,
                };

                let is_muted = match &dialog.raw {
                    tl::enums::Dialog::Dialog(d) => {
                        match &d.notify_settings {
                            tl::enums::PeerNotifySettings::Settings(settings) => {
                                settings.mute_until.map(|t| t > 0).unwrap_or(false) || settings.silent.unwrap_or(false)
                            }
                        }
                    }
                    tl::enums::Dialog::Folder(_) => false,
                };

                let member_count = match chat {
                    grammers_client::types::Chat::User(_) => None,
                    grammers_client::types::Chat::Group(g) => {
                        match &g.raw {
                            tl::enums::Chat::Chat(c) => Some(c.participants_count),
                            _ => None,
                        }
                    }
                    grammers_client::types::Chat::Channel(c) => {
                        c.raw.participants_count
                    }
                };

                // Cache and add to results
                cache.insert(chat.id(), dialog.chat.clone());

                chats.push(Chat {
                    id: chat.id(),
                    chat_type: chat_type.to_string(),
                    title: title.trim().to_string(),
                    unread_count,
                    is_pinned,
                    order: -(dialog.last_message.as_ref().map(|m| m.date().timestamp()).unwrap_or(0)),
                    photo: None,
                    last_message,
                    member_count,
                    is_muted,
                    is_archived,
                    is_bot,
                    is_contact,
                });

                count += 1;
                continue;
            }

            // Skip archived chats if not included
            if is_archived && !filters.include_archived {
                // Still cache for message retrieval
                cache.insert(dialog.chat.id(), dialog.chat.clone());
                continue;
            }

            // Determine chat type, check if it's a bot, and check contact status
            let (chat_type, is_bot, is_contact) = match chat {
                grammers_client::types::Chat::User(u) => {
                    let is_bot = u.is_bot();
                    // Check if user is a contact from the raw User data
                    let is_contact = u.raw.contact;
                    ("private", is_bot, is_contact)
                }
                grammers_client::types::Chat::Group(_) => ("group", false, false),
                grammers_client::types::Chat::Channel(_) => ("channel", false, false),
            };

            // Apply type filters
            match chat_type {
                "private" => {
                    if is_bot {
                        if !filters.include_bots {
                            cache.insert(chat.id(), dialog.chat.clone());
                            continue;
                        }
                    } else {
                        // Non-bot private chat - contacts and non-contacts are independent filters
                        if is_contact && !filters.include_private_chats {
                            // Contact but contacts filter is off
                            cache.insert(chat.id(), dialog.chat.clone());
                            continue;
                        }
                        if !is_contact && !filters.include_non_contacts {
                            // Non-contact but non-contacts filter is off
                            cache.insert(chat.id(), dialog.chat.clone());
                            continue;
                        }
                    }
                }
                "group" => {
                    if !filters.include_groups {
                        cache.insert(chat.id(), dialog.chat.clone());
                        continue;
                    }
                }
                "channel" => {
                    if !filters.include_channels {
                        cache.insert(chat.id(), dialog.chat.clone());
                        continue;
                    }
                }
                _ => {}
            }

            // Check muted status from notify settings
            let is_muted = match &dialog.raw {
                tl::enums::Dialog::Dialog(d) => {
                    match &d.notify_settings {
                        tl::enums::PeerNotifySettings::Settings(settings) => {
                            // mute_until > 0 or silent = true means muted
                            settings.mute_until.map(|t| t > 0).unwrap_or(false) || settings.silent.unwrap_or(false)
                        }
                    }
                }
                tl::enums::Dialog::Folder(_) => false,
            };

            // Skip muted chats if not included
            if is_muted && !filters.include_muted {
                cache.insert(chat.id(), dialog.chat.clone());
                continue;
            }

            let title = match chat {
                grammers_client::types::Chat::User(u) => {
                    format!("{} {}", u.first_name(), u.last_name().unwrap_or(""))
                }
                grammers_client::types::Chat::Group(g) => g.title().to_string(),
                grammers_client::types::Chat::Channel(c) => c.title().to_string(),
            };

            let last_message = dialog.last_message.as_ref().map(|msg| {
                let text = msg.text();
                let content = if !text.is_empty() {
                    MessageContent::Text { text: text.to_string() }
                } else if msg.photo().is_some() {
                    MessageContent::Photo { caption: None }
                } else {
                    MessageContent::Unknown
                };

                Message {
                    id: msg.id() as i64,
                    chat_id: chat.id(),
                    sender_id: msg.sender().map(|s| s.id()).unwrap_or(0),
                    sender_name: msg.sender().map(|s| s.name().to_string()).unwrap_or_default(),
                    content,
                    date: msg.date().timestamp(),
                    is_outgoing: msg.outgoing(),
                    is_read: true,
                }
            });

            // Get unread count from the raw dialog data
            let unread_count = match &dialog.raw {
                tl::enums::Dialog::Dialog(d) => d.unread_count,
                tl::enums::Dialog::Folder(_) => 0,
            };

            let is_pinned = match &dialog.raw {
                tl::enums::Dialog::Dialog(d) => d.pinned,
                tl::enums::Dialog::Folder(_) => false,
            };

            // Extract member count from chat type
            let member_count = match chat {
                grammers_client::types::Chat::User(_) => None,
                grammers_client::types::Chat::Group(g) => {
                    // Basic groups have participant count in raw data
                    match &g.raw {
                        tl::enums::Chat::Chat(c) => Some(c.participants_count),
                        _ => None,
                    }
                }
                grammers_client::types::Chat::Channel(c) => {
                    // Channels/supergroups: raw is directly a Channel struct
                    c.raw.participants_count
                }
            };

            // Check group size range filter (applies to groups and channels)
            if chat_type == "group" || chat_type == "channel" {
                if let Some(count) = member_count {
                    // Check minimum size
                    if let Some(min_size) = filters.group_size_min {
                        if count < min_size {
                            cache.insert(chat.id(), dialog.chat.clone());
                            continue;
                        }
                    }
                    // Check maximum size (1001+ means no limit)
                    if let Some(max_size) = filters.group_size_max {
                        if max_size <= 1000 && count > max_size {
                            cache.insert(chat.id(), dialog.chat.clone());
                            continue;
                        }
                    }
                }
                // Groups/channels without member_count pass through (shown)
            }

            // Check unread_only filter
            if filters.include_unread_only && unread_count == 0 {
                cache.insert(chat.id(), dialog.chat.clone());
                continue;
            }

            // Note: Folder filter is now applied at the top as early exit (OR logic)
            // Chats reaching this point either:
            // 1. Have no folder filter active (folder_chat_ids is empty)
            // 2. Are NOT in any selected folder but pass all type/muted/archived/size filters

            // Cache the chat object for later use
            cache.insert(chat.id(), dialog.chat.clone());

            chats.push(Chat {
                id: chat.id(),
                chat_type: chat_type.to_string(),
                title: title.trim().to_string(),
                unread_count,
                is_pinned,
                order: -(dialog.last_message.as_ref().map(|m| m.date().timestamp()).unwrap_or(0)),
                photo: None,
                last_message,
                member_count,
                is_muted,
                is_archived,
                is_bot,
                is_contact,
            });

            count += 1;
        }

        *self.cache_loaded.write().await = true;
        log::info!("Chat cache updated with {} chats", cache.len());

        Ok(chats)
    }

    /// Get messages from a chat (with auto-reconnect on connection failure)
    pub async fn get_chat_messages(
        &self,
        chat_id: i64,
        limit: i32,
        from_message_id: Option<i64>,
    ) -> Result<Vec<Message>, String> {
        log::info!("Getting messages for chat {}, limit: {}", chat_id, limit);

        // Try the operation, reconnect and retry once on connection error
        match self.get_chat_messages_inner(chat_id, limit, from_message_id).await {
            Ok(messages) => Ok(messages),
            Err(e) if Self::is_connection_error(&e) => {
                log::warn!("Connection error getting messages, attempting reconnect: {}", e);
                self.reconnect().await?;
                self.get_chat_messages_inner(chat_id, limit, from_message_id).await
            }
            Err(e) => Err(e),
        }
    }

    async fn get_chat_messages_inner(
        &self,
        chat_id: i64,
        limit: i32,
        _from_message_id: Option<i64>,
    ) -> Result<Vec<Message>, String> {
        // Try to get chat from cache first
        let chat = match self.get_cached_chat(chat_id).await {
            Some(c) => c,
            None => {
                // Cache miss - ensure cache is loaded
                self.ensure_cache_loaded(200).await?;
                self.get_cached_chat(chat_id).await
                    .ok_or_else(|| format!("Chat {} not found in cache", chat_id))?
            }
        };

        let client_guard = self.client.read().await;
        let client = client_guard.as_ref().ok_or("Client not connected")?;

        let mut messages = Vec::new();
        let mut history = client.iter_messages(&chat);
        let mut count = 0;

        while let Some(msg) = history.next().await.map_err(|e| e.to_string())? {
            if count >= limit {
                break;
            }

            let text = msg.text();
            let content = if !text.is_empty() {
                MessageContent::Text { text: text.to_string() }
            } else if msg.photo().is_some() {
                MessageContent::Photo { caption: None }
            } else {
                MessageContent::Unknown
            };

            messages.push(Message {
                id: msg.id() as i64,
                chat_id,
                sender_id: msg.sender().map(|s| s.id()).unwrap_or(0),
                sender_name: msg.sender().map(|s| s.name().to_string()).unwrap_or_default(),
                content,
                date: msg.date().timestamp(),
                is_outgoing: msg.outgoing(),
                is_read: true,
            });

            count += 1;
        }

        // Messages come newest first, reverse for chronological order
        messages.reverse();
        Ok(messages)
    }

    /// Send a text message (with auto-reconnect on connection failure)
    pub async fn send_message(&self, chat_id: i64, text: &str) -> Result<Message, String> {
        log::info!("Sending message to chat {}", chat_id);

        // Try the operation, reconnect and retry once on connection error
        match self.send_message_inner(chat_id, text).await {
            Ok(message) => Ok(message),
            Err(e) if Self::is_connection_error(&e) => {
                log::warn!("Connection error sending message, attempting reconnect: {}", e);
                self.reconnect().await?;
                self.send_message_inner(chat_id, text).await
            }
            Err(e) => Err(e),
        }
    }

    async fn send_message_inner(&self, chat_id: i64, text: &str) -> Result<Message, String> {
        // Get chat from cache
        let chat = match self.get_cached_chat(chat_id).await {
            Some(c) => c,
            None => {
                // Cache miss - ensure cache is loaded
                self.ensure_cache_loaded(200).await?;
                self.get_cached_chat(chat_id).await
                    .ok_or_else(|| format!("Chat {} not found in cache", chat_id))?
            }
        };

        let client_guard = self.client.read().await;
        let client = client_guard.as_ref().ok_or("Client not connected")?;

        let sent_msg = client
            .send_message(&chat, text)
            .await
            .map_err(|e| format!("Failed to send message: {}", e))?;

        let message = Message {
            id: sent_msg.id() as i64,
            chat_id,
            sender_id: self.current_user.read().await.as_ref().map(|u| u.id).unwrap_or(0),
            sender_name: "You".to_string(),
            content: MessageContent::Text { text: text.to_string() },
            date: sent_msg.date().timestamp(),
            is_outgoing: true,
            is_read: false,
        };

        self.emit_event(TelegramEvent::NewMessage(message.clone()));
        Ok(message)
    }

    /// Get contacts (with auto-reconnect on connection failure)
    pub async fn get_contacts(&self) -> Result<Vec<User>, String> {
        log::info!("Getting contacts");

        // Try the operation, reconnect and retry once on connection error
        match self.get_contacts_inner().await {
            Ok(users) => Ok(users),
            Err(e) if Self::is_connection_error(&e) => {
                log::warn!("Connection error getting contacts, attempting reconnect: {}", e);
                self.reconnect().await?;
                self.get_contacts_inner().await
            }
            Err(e) => Err(e),
        }
    }

    async fn get_contacts_inner(&self) -> Result<Vec<User>, String> {
        let client_guard = self.client.read().await;
        let client = client_guard.as_ref().ok_or("Client not connected")?;

        let contacts = client
            .invoke(&tl::functions::contacts::GetContacts { hash: 0 })
            .await
            .map_err(|e| format!("Failed to get contacts: {}", e))?;

        let mut users = Vec::new();

        if let tl::enums::contacts::Contacts::Contacts(contacts) = contacts {
            for user in contacts.users {
                if let tl::enums::User::User(u) = user {
                    users.push(User {
                        id: u.id,
                        first_name: u.first_name.unwrap_or_default(),
                        last_name: u.last_name.unwrap_or_default(),
                        username: u.username,
                        phone_number: u.phone,
                        profile_photo_url: None,
                    });
                }
            }
        }

        Ok(users)
    }

    /// Get contacts with their access hashes (needed for certain API calls, with auto-reconnect)
    pub async fn get_contacts_with_access_hash(&self) -> Result<Vec<(i64, i64)>, String> {
        log::info!("Getting contacts with access hashes");

        // Try the operation, reconnect and retry once on connection error
        match self.get_contacts_with_access_hash_inner().await {
            Ok(users) => Ok(users),
            Err(e) if Self::is_connection_error(&e) => {
                log::warn!("Connection error getting contacts with access hash, attempting reconnect: {}", e);
                self.reconnect().await?;
                self.get_contacts_with_access_hash_inner().await
            }
            Err(e) => Err(e),
        }
    }

    async fn get_contacts_with_access_hash_inner(&self) -> Result<Vec<(i64, i64)>, String> {
        let client_guard = self.client.read().await;
        let client = client_guard.as_ref().ok_or("Client not connected")?;

        let contacts = client
            .invoke(&tl::functions::contacts::GetContacts { hash: 0 })
            .await
            .map_err(|e| format!("Failed to get contacts: {}", e))?;

        let mut users = Vec::new();

        if let tl::enums::contacts::Contacts::Contacts(contacts) = contacts {
            for user in contacts.users {
                if let tl::enums::User::User(u) = user {
                    if let Some(access_hash) = u.access_hash {
                        users.push((u.id, access_hash));
                    }
                }
            }
        }

        Ok(users)
    }

    /// Get chat folders using MTProto GetDialogFilters (with auto-reconnect on connection failure)
    pub async fn get_folders(&self) -> Result<Vec<Folder>, String> {
        log::info!("Getting folders");

        // Try the operation, reconnect and retry once on connection error
        match self.get_folders_inner().await {
            Ok(folders) => Ok(folders),
            Err(e) if Self::is_connection_error(&e) => {
                log::warn!("Connection error getting folders, attempting reconnect: {}", e);
                self.reconnect().await?;
                self.get_folders_inner().await
            }
            Err(e) => Err(e),
        }
    }

    async fn get_folders_inner(&self) -> Result<Vec<Folder>, String> {
        let client_guard = self.client.read().await;
        let client = client_guard.as_ref().ok_or("Client not connected")?;

        let result = client
            .invoke(&tl::functions::messages::GetDialogFilters {})
            .await
            .map_err(|e| format!("Failed to get folders: {}", e))?;

        let mut folders = Vec::new();

        // Extract filters from the DialogFilters response
        let dialog_filters = match result {
            tl::enums::messages::DialogFilters::Filters(f) => f.filters,
        };

        // Parse the DialogFilters response
        for filter in dialog_filters {
            match filter {
                tl::enums::DialogFilter::Filter(f) => {
                    // Extract peer IDs from include_peers
                    let included_chat_ids: Vec<i64> = f.include_peers.iter().filter_map(|peer| {
                        match peer {
                            tl::enums::InputPeer::Chat(c) => Some(c.chat_id),
                            tl::enums::InputPeer::Channel(c) => Some(c.channel_id),
                            tl::enums::InputPeer::User(u) => Some(u.user_id),
                            _ => None,
                        }
                    }).collect();

                    // Extract peer IDs from exclude_peers
                    let excluded_chat_ids: Vec<i64> = f.exclude_peers.iter().filter_map(|peer| {
                        match peer {
                            tl::enums::InputPeer::Chat(c) => Some(c.chat_id),
                            tl::enums::InputPeer::Channel(c) => Some(c.channel_id),
                            tl::enums::InputPeer::User(u) => Some(u.user_id),
                            _ => None,
                        }
                    }).collect();

                    folders.push(Folder {
                        id: f.id,
                        title: f.title,
                        emoticon: f.emoticon,
                        included_chat_ids,
                        excluded_chat_ids,
                        include_contacts: f.contacts,
                        include_non_contacts: f.non_contacts,
                        include_groups: f.groups,
                        include_channels: f.broadcasts,
                        include_bots: f.bots,
                    });
                }
                tl::enums::DialogFilter::Default => {
                    // The default "All Chats" filter - skip it
                    continue;
                }
                tl::enums::DialogFilter::Chatlist(_) => {
                    // Shared folder / chatlist - skip for now
                    continue;
                }
            }
        }

        log::info!("Found {} folders", folders.len());
        Ok(folders)
    }

    /// Get common chats/groups with a specific user (with auto-reconnect on connection failure)
    pub async fn get_common_chats(&self, user_id: i64, access_hash: i64) -> Result<Vec<CommonChat>, String> {
        log::info!("Getting common chats for user {}", user_id);

        // Try the operation, reconnect and retry once on connection error
        match self.get_common_chats_inner(user_id, access_hash).await {
            Ok(chats) => Ok(chats),
            Err(e) if Self::is_connection_error(&e) => {
                log::warn!("Connection error getting common chats, attempting reconnect: {}", e);
                self.reconnect().await?;
                self.get_common_chats_inner(user_id, access_hash).await
            }
            Err(e) => Err(e),
        }
    }

    async fn get_common_chats_inner(&self, user_id: i64, access_hash: i64) -> Result<Vec<CommonChat>, String> {
        let client_guard = self.client.read().await;
        let client = client_guard.as_ref().ok_or("Client not connected")?;

        let input_user = tl::enums::InputUser::User(tl::types::InputUser {
            user_id,
            access_hash,
        });

        let result = client
            .invoke(&tl::functions::messages::GetCommonChats {
                user_id: input_user,
                max_id: 0,
                limit: 100,
            })
            .await
            .map_err(|e| format!("Failed to get common chats: {}", e))?;

        let chats = match result {
            tl::enums::messages::Chats::Chats(c) => c.chats,
            tl::enums::messages::Chats::Slice(s) => s.chats,
        };

        // Get current user to check admin rights (reserved for future use)
        let _me = client.get_me().await.map_err(|e| format!("Failed to get current user: {}", e))?;

        let mut common_chats = Vec::new();
        for chat in chats {
            let (id, title, member_count, can_remove) = match &chat {
                tl::enums::Chat::Chat(c) => {
                    // Basic group - check if we're an admin
                    let is_admin = c.admin_rights.is_some() || c.creator;
                    (
                        c.id,
                        c.title.clone(),
                        Some(c.participants_count),
                        is_admin,
                    )
                }
                tl::enums::Chat::Channel(c) => {
                    // Channel/supergroup - check admin rights
                    let is_admin = c.admin_rights.is_some() || c.creator;
                    (
                        c.id,
                        c.title.clone(),
                        c.participants_count,
                        is_admin,
                    )
                }
                tl::enums::Chat::Forbidden(c) => {
                    (c.id, c.title.clone(), None, false)
                }
                tl::enums::Chat::ChannelForbidden(c) => {
                    (c.id, c.title.clone(), None, false)
                }
                tl::enums::Chat::Empty(c) => {
                    (c.id, String::new(), None, false)
                }
            };

            common_chats.push(CommonChat {
                id,
                title,
                member_count,
                can_remove,
                raw_chat: chat,
            });
        }

        Ok(common_chats)
    }

    /// Remove (kick) a user from a chat (with auto-reconnect on connection failure)
    pub async fn kick_chat_member(&self, chat: &tl::enums::Chat, user_id: i64, access_hash: i64) -> Result<(), String> {
        log::info!("Kicking user {} from chat", user_id);

        // Try the operation, reconnect and retry once on connection error
        match self.kick_chat_member_inner(chat, user_id, access_hash).await {
            Ok(()) => Ok(()),
            Err(e) if Self::is_connection_error(&e) => {
                log::warn!("Connection error kicking chat member, attempting reconnect: {}", e);
                self.reconnect().await?;
                self.kick_chat_member_inner(chat, user_id, access_hash).await
            }
            Err(e) => Err(e),
        }
    }

    async fn kick_chat_member_inner(&self, chat: &tl::enums::Chat, user_id: i64, access_hash: i64) -> Result<(), String> {
        let client_guard = self.client.read().await;
        let client = client_guard.as_ref().ok_or("Client not connected")?;

        let input_user = tl::enums::InputUser::User(tl::types::InputUser {
            user_id,
            access_hash,
        });

        match chat {
            tl::enums::Chat::Chat(c) => {
                // Basic group - use DeleteChatUser
                client
                    .invoke(&tl::functions::messages::DeleteChatUser {
                        chat_id: c.id,
                        user_id: input_user,
                        revoke_history: false,
                    })
                    .await
                    .map_err(|e| format!("Failed to remove user from group: {}", e))?;
            }
            tl::enums::Chat::Channel(c) => {
                // Channel/supergroup - use EditBanned with ban rights
                let channel_access_hash = c.access_hash.ok_or_else(|| {
                    format!("Channel {} is missing access_hash, cannot remove user", c.title)
                })?;
                let input_channel = tl::enums::InputChannel::Channel(tl::types::InputChannel {
                    channel_id: c.id,
                    access_hash: channel_access_hash,
                });

                let input_peer = tl::enums::InputPeer::User(tl::types::InputPeerUser {
                    user_id,
                    access_hash,
                });

                // Ban with view_messages = true to effectively kick
                let banned_rights = tl::types::ChatBannedRights {
                    view_messages: true,
                    send_messages: true,
                    send_media: true,
                    send_stickers: true,
                    send_gifs: true,
                    send_games: true,
                    send_inline: true,
                    embed_links: true,
                    send_polls: true,
                    change_info: true,
                    invite_users: true,
                    pin_messages: true,
                    manage_topics: true,
                    send_photos: true,
                    send_videos: true,
                    send_roundvideos: true,
                    send_audios: true,
                    send_voices: true,
                    send_docs: true,
                    send_plain: true,
                    until_date: 0, // Permanent
                };

                client
                    .invoke(&tl::functions::channels::EditBanned {
                        channel: input_channel,
                        participant: input_peer,
                        banned_rights: tl::enums::ChatBannedRights::Rights(banned_rights),
                    })
                    .await
                    .map_err(|e| format!("Failed to ban user from channel: {}", e))?;
            }
            _ => {
                return Err("Cannot remove user from this type of chat".to_string());
            }
        }

        Ok(())
    }
}

impl Default for TelegramClient {
    fn default() -> Self {
        Self::new(TelegramConfig::default())
    }
}
