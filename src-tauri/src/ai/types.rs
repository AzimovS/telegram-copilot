use serde::{Deserialize, Serialize};

/// Message in a chat context for AI processing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: i64,
    pub sender_name: String,
    pub text: String,
    pub date: i64,
    pub is_outgoing: bool,
}

/// Chat context for briefing generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatContext {
    pub chat_id: i64,
    pub chat_title: String,
    pub chat_type: String,
    pub messages: Vec<ChatMessage>,
    #[serde(default)]
    pub unread_count: i32,
    #[serde(default)]
    pub last_message_is_outgoing: bool,
    #[serde(default)]
    pub has_unanswered_question: bool,
    #[serde(default)]
    pub hours_since_last_activity: f64,
    #[serde(default)]
    pub is_private_chat: bool,
}

/// Chat context for summary generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSummaryContext {
    pub chat_id: i64,
    pub chat_title: String,
    pub chat_type: String,
    pub messages: Vec<ChatMessage>,
    #[serde(default)]
    pub unread_count: i32,
}

/// Message format for draft generation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DraftMessage {
    pub sender_name: String,
    pub text: String,
    pub is_outgoing: bool,
}

/// Priority classification for briefing items (kept as strings in responses for simplicity)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[allow(dead_code)]
pub enum Priority {
    Urgent,
    NeedsReply,
    Fyi,
}

/// Sentiment classification for summaries (kept as strings in responses for simplicity)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
#[allow(dead_code)]
pub enum Sentiment {
    Positive,
    Neutral,
    Negative,
}

impl Default for Sentiment {
    fn default() -> Self {
        Sentiment::Neutral
    }
}

/// Chat type classification
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChatType {
    Dm,
    Group,
    Channel,
}

impl ChatType {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "private" | "dm" | "user" => ChatType::Dm,
            "group" | "supergroup" | "megagroup" => ChatType::Group,
            "channel" | "broadcast" => ChatType::Channel,
            _ => ChatType::Dm,
        }
    }
}

impl ToString for ChatType {
    fn to_string(&self) -> String {
        match self {
            ChatType::Dm => "dm".to_string(),
            ChatType::Group => "group".to_string(),
            ChatType::Channel => "channel".to_string(),
        }
    }
}

// ============================================================================
// Briefing V2 Response Types
// ============================================================================

/// Item requiring response in briefing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResponseItem {
    pub id: i32,
    pub chat_id: i64,
    pub chat_name: String,
    pub chat_type: String,
    pub unread_count: i32,
    pub last_message: Option<String>,
    pub last_message_date: Option<String>,
    pub priority: String,
    pub summary: String,
    pub suggested_reply: Option<String>,
}

/// FYI item in briefing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FYIItem {
    pub id: i32,
    pub chat_id: i64,
    pub chat_name: String,
    pub chat_type: String,
    pub unread_count: i32,
    pub last_message: Option<String>,
    pub last_message_date: Option<String>,
    pub priority: String,
    pub summary: String,
}

/// Statistics for briefing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BriefingStats {
    pub needs_response_count: i32,
    pub fyi_count: i32,
    pub total_unread: i32,
}

/// Complete briefing V2 response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BriefingV2Response {
    pub needs_response: Vec<ResponseItem>,
    pub fyi_summaries: Vec<FYIItem>,
    pub stats: BriefingStats,
    pub generated_at: String,
    pub cached: bool,
    pub cache_age: Option<String>,
}

// ============================================================================
// Summary Response Types
// ============================================================================

/// Individual chat summary result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSummaryResult {
    pub chat_id: i64,
    pub chat_title: String,
    pub chat_type: String,
    pub summary: String,
    pub key_points: Vec<String>,
    pub action_items: Vec<String>,
    pub sentiment: String,
    pub needs_response: bool,
    pub message_count: i32,
    pub last_message_date: i64,
}

/// Batch summary response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchSummaryResponse {
    pub summaries: Vec<ChatSummaryResult>,
    pub total_count: i32,
    pub generated_at: i64,
    pub cached: bool,
}

// ============================================================================
// Draft Response Types
// ============================================================================

/// Draft generation response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DraftResponse {
    pub draft: String,
    pub chat_id: i64,
}

// ============================================================================
// OpenAI API Types
// ============================================================================

/// OpenAI chat completion message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIMessage {
    pub role: String,
    pub content: String,
}

/// OpenAI chat completion request
#[derive(Debug, Clone, Serialize)]
pub struct OpenAIRequest {
    pub model: String,
    pub messages: Vec<OpenAIMessage>,
    pub temperature: f32,
    pub max_tokens: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_format: Option<ResponseFormat>,
}

/// Response format for JSON mode
#[derive(Debug, Clone, Serialize)]
pub struct ResponseFormat {
    #[serde(rename = "type")]
    pub format_type: String,
}

/// OpenAI chat completion response
#[derive(Debug, Clone, Deserialize)]
pub struct OpenAIResponse {
    pub choices: Vec<OpenAIChoice>,
}

/// Choice in OpenAI response
#[derive(Debug, Clone, Deserialize)]
pub struct OpenAIChoice {
    pub message: OpenAIResponseMessage,
}

/// Message in OpenAI response
#[derive(Debug, Clone, Deserialize)]
pub struct OpenAIResponseMessage {
    pub content: String,
}

// ============================================================================
// Internal AI Response Types (for JSON parsing)
// ============================================================================

/// Internal briefing response from AI
#[derive(Debug, Clone, Deserialize)]
pub struct AIBriefingResponse {
    pub priority: String,
    pub summary: String,
    #[serde(default)]
    pub suggested_reply: Option<String>,
}

/// Internal summary response from AI
#[derive(Debug, Clone, Deserialize)]
pub struct AISummaryResponse {
    pub summary: String,
    #[serde(default)]
    pub key_points: Vec<String>,
    #[serde(default)]
    pub action_items: Vec<String>,
    #[serde(default = "default_sentiment")]
    pub sentiment: String,
    #[serde(default)]
    pub needs_response: bool,
}

fn default_sentiment() -> String {
    "neutral".to_string()
}
