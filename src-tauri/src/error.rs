use serde::Serialize;
use thiserror::Error;

/// Application-level error type
#[derive(Debug, Error)]
pub enum AppError {
    #[error("Telegram error: {0}")]
    Telegram(#[from] TelegramError),

    #[error("Database error: {0}")]
    Database(#[from] DatabaseError),

    #[error("Configuration error: {0}")]
    Config(#[from] ConfigError),

    #[error("Outreach error: {0}")]
    Outreach(#[from] OutreachError),

    #[error("{0}")]
    Internal(String),
}

/// Telegram-specific errors
#[derive(Debug, Error)]
pub enum TelegramError {
    #[error("Not connected to Telegram")]
    NotConnected,

    #[error("Not authorized")]
    NotAuthorized,

    #[error("Session error: {0}")]
    Session(String),

    #[error("Connection failed: {0}")]
    Connection(String),

    #[error("Authentication failed: {0}")]
    Auth(String),

    #[error("2FA required. Hint: {hint}")]
    TwoFactorRequired { hint: String },

    #[error("Invalid code. Please try again.")]
    InvalidCode,

    #[error("API error: {0}")]
    Api(String),

    #[error("Chat not found: {0}")]
    ChatNotFound(i64),

    #[error("User not found: {0}")]
    UserNotFound(i64),

    #[error("Rate limited: {0}")]
    RateLimited(String),
}

/// Database-specific errors
#[derive(Debug, Error)]
pub enum DatabaseError {
    #[error("Database not initialized")]
    NotInitialized,

    #[error("Failed to open database: {0}")]
    Open(String),

    #[error("Query failed: {0}")]
    Query(String),

    #[error("Failed to lock database")]
    Lock,

    #[error("Record not found: {0}")]
    NotFound(String),
}

/// Configuration errors
#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("Missing environment variable: {0}")]
    MissingEnvVar(String),

    #[error("Invalid configuration: {0}")]
    Invalid(String),

    #[error("Missing Telegram credentials. Set TELEGRAM_API_ID and TELEGRAM_API_HASH")]
    MissingTelegramCredentials,
}

/// Outreach-specific errors
#[derive(Debug, Error)]
pub enum OutreachError {
    #[error("No recipients specified")]
    NoRecipients,

    #[error("Message template is empty")]
    EmptyTemplate,

    #[error("Queue not found: {0}")]
    QueueNotFound(String),

    #[error("Queue already cancelled")]
    AlreadyCancelled,

    #[error("Failed to send message to {user_id}: {reason}")]
    SendFailed { user_id: i64, reason: String },
}

/// Serializable error response for Tauri commands
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

impl From<AppError> for ErrorResponse {
    fn from(err: AppError) -> Self {
        match &err {
            AppError::Telegram(e) => ErrorResponse {
                code: telegram_error_code(e),
                message: e.to_string(),
                details: None,
            },
            AppError::Database(e) => ErrorResponse {
                code: "DATABASE_ERROR".to_string(),
                message: e.to_string(),
                details: None,
            },
            AppError::Config(e) => ErrorResponse {
                code: "CONFIG_ERROR".to_string(),
                message: e.to_string(),
                details: None,
            },
            AppError::Outreach(e) => ErrorResponse {
                code: outreach_error_code(e),
                message: e.to_string(),
                details: None,
            },
            AppError::Internal(msg) => ErrorResponse {
                code: "INTERNAL_ERROR".to_string(),
                message: msg.clone(),
                details: None,
            },
        }
    }
}

fn telegram_error_code(err: &TelegramError) -> String {
    match err {
        TelegramError::NotConnected => "NOT_CONNECTED",
        TelegramError::NotAuthorized => "NOT_AUTHORIZED",
        TelegramError::Session(_) => "SESSION_ERROR",
        TelegramError::Connection(_) => "CONNECTION_ERROR",
        TelegramError::Auth(_) => "AUTH_ERROR",
        TelegramError::TwoFactorRequired { .. } => "2FA_REQUIRED",
        TelegramError::InvalidCode => "INVALID_CODE",
        TelegramError::Api(_) => "API_ERROR",
        TelegramError::ChatNotFound(_) => "CHAT_NOT_FOUND",
        TelegramError::UserNotFound(_) => "USER_NOT_FOUND",
        TelegramError::RateLimited(_) => "RATE_LIMITED",
    }
    .to_string()
}

fn outreach_error_code(err: &OutreachError) -> String {
    match err {
        OutreachError::NoRecipients => "NO_RECIPIENTS",
        OutreachError::EmptyTemplate => "EMPTY_TEMPLATE",
        OutreachError::QueueNotFound(_) => "QUEUE_NOT_FOUND",
        OutreachError::AlreadyCancelled => "ALREADY_CANCELLED",
        OutreachError::SendFailed { .. } => "SEND_FAILED",
    }
    .to_string()
}

/// Convert AppError to String for Tauri command results
/// This allows gradual migration from Result<T, String> to Result<T, AppError>
impl From<AppError> for String {
    fn from(err: AppError) -> Self {
        err.to_string()
    }
}

/// Helper trait for converting rusqlite errors
impl From<rusqlite::Error> for DatabaseError {
    fn from(err: rusqlite::Error) -> Self {
        DatabaseError::Query(err.to_string())
    }
}

/// Result type alias for commands
pub type CommandResult<T> = Result<T, AppError>;

/// Macro to simplify error conversion in commands
#[macro_export]
macro_rules! map_err {
    ($expr:expr, $error_variant:expr) => {
        $expr.map_err(|e| $error_variant(e.to_string()))
    };
}
