use grammers_client::{Client, Config, InitParams, SignInError};
use grammers_client::types::PasswordToken;
use grammers_session::Session;
use grammers_tl_types as tl;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
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
    config: TelegramConfig,
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
            config,
            login_token: Arc::new(Mutex::new(None)),
            password_token: Arc::new(Mutex::new(None)),
            phone_number: Arc::new(RwLock::new(None)),
            chat_cache: Arc::new(RwLock::new(HashMap::new())),
            cache_loaded: Arc::new(RwLock::new(false)),
            dialog_semaphore: Arc::new(Semaphore::new(1)), // Only one dialog load at a time
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

    /// Connect to Telegram and check if already authorized
    pub async fn connect(&self) -> Result<bool, String> {
        log::info!("Connecting to Telegram...");

        let session = Session::load_file_or_create(&self.config.session_file)
            .map_err(|e| format!("Failed to load session: {}", e))?;

        let client = Client::connect(Config {
            session,
            api_id: self.config.api_id,
            api_hash: self.config.api_hash.clone(),
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
        client.session().save_to_file(&self.config.session_file)
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
                client.session().save_to_file(&self.config.session_file)
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
                client.session().save_to_file(&self.config.session_file)
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

        let client_guard = self.client.read().await;
        if let Some(client) = client_guard.as_ref() {
            let _ = client.sign_out().await;
        }

        // Delete session file
        let _ = std::fs::remove_file(&self.config.session_file);

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

    /// Get chat list (dialogs)
    pub async fn get_chats(&self, limit: i32) -> Result<Vec<Chat>, String> {
        log::info!("Getting chats, limit: {}", limit);

        let client_guard = self.client.read().await;
        let client = client_guard.as_ref().ok_or("Client not connected")?;

        // Acquire semaphore to prevent concurrent dialog loads
        let _permit = self.dialog_semaphore.acquire().await
            .map_err(|e| format!("Failed to acquire semaphore: {}", e))?;

        let mut dialogs = client.iter_dialogs();
        let mut chats = Vec::new();
        let mut count = 0;
        let mut cache = self.chat_cache.write().await;

        while let Some(dialog) = dialogs.next().await.map_err(|e| format!("Failed to get dialogs: {}", e))? {
            if count >= limit {
                break;
            }

            let chat = dialog.chat();
            let chat_type = match chat {
                grammers_client::types::Chat::User(_) => "private",
                grammers_client::types::Chat::Group(_) => "group",
                grammers_client::types::Chat::Channel(_) => "channel",
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
            });

            count += 1;
        }

        *self.cache_loaded.write().await = true;
        log::info!("Chat cache updated with {} chats", cache.len());

        Ok(chats)
    }

    /// Get messages from a chat
    pub async fn get_chat_messages(
        &self,
        chat_id: i64,
        limit: i32,
        _from_message_id: Option<i64>,
    ) -> Result<Vec<Message>, String> {
        log::info!("Getting messages for chat {}, limit: {}", chat_id, limit);

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

    /// Send a text message
    pub async fn send_message(&self, chat_id: i64, text: &str) -> Result<Message, String> {
        log::info!("Sending message to chat {}", chat_id);

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

    /// Get contacts
    pub async fn get_contacts(&self) -> Result<Vec<User>, String> {
        log::info!("Getting contacts");

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

    /// Get contacts with their access hashes (needed for certain API calls)
    pub async fn get_contacts_with_access_hash(&self) -> Result<Vec<(i64, i64)>, String> {
        log::info!("Getting contacts with access hashes");

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

    /// Get chat folders
    ///
    /// TODO: Implement folder support once grammers API is verified.
    /// The grammers library's folder API may vary by version.
    /// See: https://core.telegram.org/api/folders
    pub async fn get_folders(&self) -> Result<Vec<Folder>, String> {
        log::info!("Getting folders (not implemented)");

        let client_guard = self.client.read().await;
        let _client = client_guard.as_ref().ok_or("Client not connected")?;

        // Returns empty - folder enumeration requires raw MTProto calls
        // that aren't directly exposed in the current grammers version
        Ok(Vec::new())
    }

    /// Get common chats/groups with a specific user
    pub async fn get_common_chats(&self, user_id: i64, access_hash: i64) -> Result<Vec<CommonChat>, String> {
        log::info!("Getting common chats for user {}", user_id);

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

    /// Remove (kick) a user from a chat
    pub async fn kick_chat_member(&self, chat: &tl::enums::Chat, user_id: i64, access_hash: i64) -> Result<(), String> {
        log::info!("Kicking user {} from chat", user_id);

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
