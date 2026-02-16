use crate::ai::{
    client::{safe_json_parse, list_ollama_models, LLMClient, LLMConfig, OllamaModel},
    prompts::{
        format_briefing_v2_user_prompt, format_draft_user_prompt, format_summary_user_prompt,
        BRIEFING_V2_SYSTEM_PROMPT, DETAILED_SUMMARY_PROMPT, DRAFT_SYSTEM_PROMPT,
    },
    sanitize::{sanitize_chat_title, sanitize_message_text, sanitize_sender_name},
    types::{
        AIBriefingResponse, AISummaryResponse, BatchSummaryResponse, BriefingStats,
        BriefingV2Response, ChatContext, ChatSummaryContext, ChatSummaryResult, ChatType,
        DraftMessage, DraftResponse, FYIItem, OpenAIMessage, ResponseItem,
    },
};
use crate::cache::{format_cache_age, generate_chat_ids_key, BriefingCache, SummaryCache};
use chrono::Utc;
use std::sync::Arc;
use tauri::State;

/// Generate briefing V2 with priority classification
#[tauri::command]
pub async fn generate_briefing_v2(
    client: State<'_, Arc<LLMClient>>,
    cache: State<'_, Arc<BriefingCache>>,
    chats: Vec<ChatContext>,
    force_refresh: bool,
    ttl_minutes: i64,
) -> Result<BriefingV2Response, String> {
    log::info!(
        "Generating briefing V2 for {} chats (force_refresh: {}, ttl: {}m)",
        chats.len(),
        force_refresh,
        ttl_minutes
    );

    if chats.is_empty() {
        return Ok(BriefingV2Response {
            needs_response: vec![],
            fyi_summaries: vec![],
            stats: BriefingStats {
                needs_response_count: 0,
                fyi_count: 0,
                total_unread: 0,
            },
            generated_at: Utc::now().to_rfc3339(),
            cached: false,
            cache_age: None,
        });
    }

    // Generate cache key from chat IDs
    let chat_ids: Vec<i64> = chats.iter().map(|c| c.chat_id).collect();
    let cache_key = generate_chat_ids_key(&chat_ids);
    let ttl_secs = (ttl_minutes * 60) as u64;

    // Check cache unless force refresh
    if !force_refresh {
        if let Some((cached_response, age_secs)) = cache.0.get(&cache_key, ttl_secs).await {
            log::info!("Returning cached briefing (age: {}s)", age_secs);
            return Ok(BriefingV2Response {
                cached: true,
                cache_age: Some(format_cache_age(age_secs)),
                ..cached_response
            });
        }
    }

    // Process chats in parallel
    let client = client.inner().clone();
    let mut handles = vec![];

    for (idx, chat) in chats.iter().enumerate() {
        let client = client.clone();
        let chat = chat.clone();
        let handle = tokio::spawn(async move {
            process_chat_for_briefing(&client, chat, idx as i32 + 1).await
        });
        handles.push(handle);
    }

    // Collect results
    let mut needs_response = vec![];
    let mut fyi_summaries = vec![];
    let mut total_unread = 0;

    for handle in handles {
        match handle.await {
            Ok(Ok(result)) => {
                total_unread += result.unread_count;
                match result.priority.as_str() {
                    "urgent" | "needs_reply" => needs_response.push(result.into_response_item()),
                    _ => fyi_summaries.push(result.into_fyi_item()),
                }
            }
            Ok(Err(e)) => {
                log::error!("Failed to process chat: {}", e);
            }
            Err(e) => {
                log::error!("Task panicked: {}", e);
            }
        }
    }

    // Sort: urgent first, then needs_reply
    needs_response.sort_by(|a, b| {
        let priority_order = |p: &str| match p {
            "urgent" => 0,
            "needs_reply" => 1,
            _ => 2,
        };
        priority_order(&a.priority).cmp(&priority_order(&b.priority))
    });

    let response = BriefingV2Response {
        needs_response: needs_response.clone(),
        fyi_summaries: fyi_summaries.clone(),
        stats: BriefingStats {
            needs_response_count: needs_response.len() as i32,
            fyi_count: fyi_summaries.len() as i32,
            total_unread,
        },
        generated_at: Utc::now().to_rfc3339(),
        cached: false,
        cache_age: None,
    };

    // Store in cache
    cache.0.set(&cache_key, response.clone()).await;

    Ok(response)
}

/// Internal result from processing a chat
struct BriefingResult {
    id: i32,
    chat_id: i64,
    chat_name: String,
    chat_type: String,
    unread_count: i32,
    last_message: Option<String>,
    last_message_date: Option<String>,
    priority: String,
    summary: String,
    suggested_reply: Option<String>,
}

impl BriefingResult {
    fn into_response_item(self) -> ResponseItem {
        ResponseItem {
            id: self.id,
            chat_id: self.chat_id,
            chat_name: self.chat_name,
            chat_type: self.chat_type,
            unread_count: self.unread_count,
            last_message: self.last_message,
            last_message_date: self.last_message_date,
            priority: self.priority,
            summary: self.summary,
            suggested_reply: self.suggested_reply,
        }
    }

    fn into_fyi_item(self) -> FYIItem {
        FYIItem {
            id: self.id,
            chat_id: self.chat_id,
            chat_name: self.chat_name,
            chat_type: self.chat_type,
            unread_count: self.unread_count,
            last_message: self.last_message,
            last_message_date: self.last_message_date,
            priority: "fyi".to_string(),
            summary: self.summary,
        }
    }
}

/// Process a single chat for briefing
async fn process_chat_for_briefing(
    client: &LLMClient,
    chat: ChatContext,
    id: i32,
) -> Result<BriefingResult, String> {
    let chat_title = sanitize_chat_title(&chat.chat_title);
    let chat_type = ChatType::from_str(&chat.chat_type).to_string();

    // Take last 30 messages (increased from 10 for better context)
    let messages: Vec<(String, String)> = chat
        .messages
        .iter()
        .rev()
        .take(30)
        .rev()
        .map(|m| {
            (
                sanitize_sender_name(&m.sender_name),
                sanitize_message_text(&m.text),
            )
        })
        .collect();

    // Get last message info
    let last_message = chat.messages.last().map(|m| {
        let text = sanitize_message_text(&m.text);
        if text.len() > 300 {
            format!("{}...", &text[..text.floor_char_boundary(300)])
        } else {
            text
        }
    });

    let last_message_date = chat.messages.last().map(|m| {
        chrono::DateTime::from_timestamp(m.date, 0)
            .map(|dt| dt.to_rfc3339())
            .unwrap_or_default()
    });

    // Build user prompt
    let user_prompt = format_briefing_v2_user_prompt(
        &chat_title,
        &chat_type,
        chat.unread_count,
        chat.last_message_is_outgoing,
        chat.has_unanswered_question,
        chat.hours_since_last_activity,
        chat.is_private_chat,
        &messages,
    );

    // Call LLM
    let llm_messages = vec![
        OpenAIMessage {
            role: "system".to_string(),
            content: BRIEFING_V2_SYSTEM_PROMPT.to_string(),
        },
        OpenAIMessage {
            role: "user".to_string(),
            content: user_prompt,
        },
    ];

    match client.chat_completion(llm_messages, 0.3, 500, true).await {
        Ok(response) => {
            match safe_json_parse::<AIBriefingResponse>(&response, "briefing") {
                Ok(parsed) => Ok(BriefingResult {
                    id,
                    chat_id: chat.chat_id,
                    chat_name: chat.chat_title,
                    chat_type,
                    unread_count: chat.unread_count,
                    last_message,
                    last_message_date,
                    priority: parsed.priority.to_lowercase(),
                    summary: parsed.summary,
                    suggested_reply: parsed.suggested_reply,
                }),
                Err(_) => {
                    // Fallback on parse error
                    Ok(BriefingResult {
                        id,
                        chat_id: chat.chat_id,
                        chat_name: chat.chat_title,
                        chat_type,
                        unread_count: chat.unread_count,
                        last_message,
                        last_message_date,
                        priority: "fyi".to_string(),
                        summary: "Unable to analyze this chat".to_string(),
                        suggested_reply: None,
                    })
                }
            }
        }
        Err(e) => {
            log::error!("LLM call failed for chat {}: {}", chat.chat_id, e);
            // Return FYI on error
            Ok(BriefingResult {
                id,
                chat_id: chat.chat_id,
                chat_name: chat.chat_title,
                chat_type,
                unread_count: chat.unread_count,
                last_message,
                last_message_date,
                priority: "fyi".to_string(),
                summary: "Unable to analyze this chat".to_string(),
                suggested_reply: None,
            })
        }
    }
}

/// Generate batch summaries for multiple chats
#[tauri::command]
pub async fn generate_batch_summaries(
    client: State<'_, Arc<LLMClient>>,
    cache: State<'_, Arc<SummaryCache>>,
    chats: Vec<ChatSummaryContext>,
    regenerate: bool,
    ttl_minutes: i64,
) -> Result<BatchSummaryResponse, String> {
    log::info!(
        "Generating batch summaries for {} chats (regenerate: {}, ttl: {}m)",
        chats.len(),
        regenerate,
        ttl_minutes
    );

    if chats.is_empty() {
        return Ok(BatchSummaryResponse {
            summaries: vec![],
            total_count: 0,
            generated_at: Utc::now().timestamp(),
            cached: false,
        });
    }

    // Generate cache key from chat IDs
    let chat_ids: Vec<i64> = chats.iter().map(|c| c.chat_id).collect();
    let cache_key = generate_chat_ids_key(&chat_ids);
    let ttl_secs = (ttl_minutes * 60) as u64;

    // Check cache unless regenerate
    if !regenerate {
        if let Some((cached_response, age_secs)) = cache.0.get(&cache_key, ttl_secs).await {
            log::info!("Returning cached summaries (age: {}s)", age_secs);
            return Ok(BatchSummaryResponse {
                cached: true,
                ..cached_response
            });
        }
    }

    // Process chats in parallel
    let client = client.inner().clone();
    let mut handles = vec![];

    for chat in chats.iter() {
        let client = client.clone();
        let chat = chat.clone();
        let handle = tokio::spawn(async move { process_chat_for_summary(&client, chat).await });
        handles.push(handle);
    }

    // Collect results preserving order
    let mut summaries = vec![];

    for handle in handles {
        match handle.await {
            Ok(result) => summaries.push(result),
            Err(e) => {
                log::error!("Task panicked: {}", e);
            }
        }
    }

    let response = BatchSummaryResponse {
        summaries: summaries.clone(),
        total_count: summaries.len() as i32,
        generated_at: Utc::now().timestamp(),
        cached: false,
    };

    // Store in cache
    cache.0.set(&cache_key, response.clone()).await;

    Ok(response)
}

/// Process a single chat for summary
async fn process_chat_for_summary(
    client: &LLMClient,
    chat: ChatSummaryContext,
) -> ChatSummaryResult {
    let chat_title = sanitize_chat_title(&chat.chat_title);
    let chat_type = ChatType::from_str(&chat.chat_type).to_string();

    // Take last 50 messages (matches frontend MESSAGES_PER_CHAT constant)
    let messages: Vec<(String, String)> = chat
        .messages
        .iter()
        .rev()
        .take(50)
        .rev()
        .map(|m| {
            (
                sanitize_sender_name(&m.sender_name),
                sanitize_message_text(&m.text),
            )
        })
        .collect();

    let message_count = chat.messages.len() as i32;
    let last_message_date = chat
        .messages
        .last()
        .map(|m| m.date)
        .unwrap_or_else(|| Utc::now().timestamp());

    // Build user prompt
    let user_prompt = format_summary_user_prompt(&chat_title, &chat_type, &messages);

    // Call LLM
    let llm_messages = vec![
        OpenAIMessage {
            role: "system".to_string(),
            content: DETAILED_SUMMARY_PROMPT.to_string(),
        },
        OpenAIMessage {
            role: "user".to_string(),
            content: user_prompt,
        },
    ];

    match client.chat_completion(llm_messages, 0.3, 600, true).await {
        Ok(response) => match safe_json_parse::<AISummaryResponse>(&response, "summary") {
            Ok(parsed) => ChatSummaryResult {
                chat_id: chat.chat_id,
                chat_title: chat.chat_title,
                chat_type,
                summary: parsed.summary,
                key_points: parsed.key_points,
                action_items: parsed.action_items,
                sentiment: parsed.sentiment,
                needs_response: parsed.needs_response,
                message_count,
                last_message_date,
            },
            Err(_) => create_fallback_summary(chat, chat_type, message_count, last_message_date),
        },
        Err(e) => {
            log::error!("LLM call failed for chat {}: {}", chat.chat_id, e);
            create_fallback_summary(chat, chat_type, message_count, last_message_date)
        }
    }
}

/// Create a fallback summary on error
fn create_fallback_summary(
    chat: ChatSummaryContext,
    chat_type: String,
    message_count: i32,
    last_message_date: i64,
) -> ChatSummaryResult {
    ChatSummaryResult {
        chat_id: chat.chat_id,
        chat_title: chat.chat_title,
        chat_type,
        summary: "Unable to generate summary".to_string(),
        key_points: vec![],
        action_items: vec![],
        sentiment: "neutral".to_string(),
        needs_response: false,
        message_count,
        last_message_date,
    }
}

/// Generate a draft reply for a chat
#[tauri::command]
pub async fn generate_draft(
    client: State<'_, Arc<LLMClient>>,
    chat_id: i64,
    chat_title: String,
    messages: Vec<DraftMessage>,
) -> Result<DraftResponse, String> {
    log::info!("Generating draft for chat {} ({})", chat_id, chat_title);

    if messages.is_empty() {
        return Ok(DraftResponse {
            draft: String::new(),
            chat_id,
        });
    }

    let sanitized_title = sanitize_chat_title(&chat_title);

    // Take last 15 messages and format them
    let formatted_messages: Vec<(String, String, bool)> = messages
        .iter()
        .rev()
        .take(15)
        .rev()
        .map(|m| {
            let sender = if m.is_outgoing {
                "You".to_string()
            } else {
                sanitize_sender_name(&m.sender_name)
            };
            (sender, sanitize_message_text(&m.text), m.is_outgoing)
        })
        .collect();

    // Build user prompt
    let user_prompt = format_draft_user_prompt(&sanitized_title, &formatted_messages);

    // Call LLM
    let llm_messages = vec![
        OpenAIMessage {
            role: "system".to_string(),
            content: DRAFT_SYSTEM_PROMPT.to_string(),
        },
        OpenAIMessage {
            role: "user".to_string(),
            content: user_prompt,
        },
    ];

    match client
        .inner()
        .chat_completion(llm_messages, 0.7, 300, false)
        .await
    {
        Ok(draft) => Ok(DraftResponse {
            draft: draft.trim().to_string(),
            chat_id,
        }),
        Err(e) => {
            log::error!("Failed to generate draft: {}", e);
            Err(format!("Failed to generate draft: {}", e))
        }
    }
}

// ============================================================================
// LLM Config Commands
// ============================================================================

/// Get current LLM configuration
#[tauri::command]
pub async fn get_llm_config(
    client: State<'_, Arc<LLMClient>>,
) -> Result<LLMConfig, String> {
    let mut config = client.get_config().await;
    // Mask the API key for security - only send a flag indicating if it's set
    if let Some(ref key) = config.api_key {
        if !key.is_empty() {
            config.api_key = Some("••••••••".to_string());
        }
    }
    Ok(config)
}

/// Update LLM configuration, persist to SQLite, and invalidate caches
#[tauri::command]
pub async fn update_llm_config(
    client: State<'_, Arc<LLMClient>>,
    briefing_cache: State<'_, Arc<BriefingCache>>,
    summary_cache: State<'_, Arc<SummaryCache>>,
    config: LLMConfig,
) -> Result<(), String> {
    log::info!(
        "Updating LLM config: provider={}, model={}, base_url={}",
        config.provider,
        config.model,
        config.base_url
    );

    // If the API key is masked, preserve the existing one
    let mut final_config = config.clone();
    if final_config.api_key.as_deref() == Some("••••••••") {
        let current = client.get_config().await;
        final_config.api_key = current.api_key;
    }

    // Save to SQLite
    crate::db::settings::save_llm_config(&final_config)?;

    // Update runtime config
    client.update_config(final_config).await;

    // Invalidate caches so next AI request uses the new provider/model
    briefing_cache.0.invalidate_all().await;
    summary_cache.0.invalidate_all().await;

    log::info!("LLM config updated and caches invalidated");
    Ok(())
}

/// List available Ollama models
#[tauri::command]
pub async fn list_ollama_models_cmd(
    base_url: Option<String>,
) -> Result<Vec<OllamaModel>, String> {
    let url = base_url.unwrap_or_else(|| "http://localhost:11434".to_string());
    list_ollama_models(&url).await
}

/// Test LLM connection with the given config
#[tauri::command]
pub async fn test_llm_connection(config: LLMConfig) -> Result<String, String> {
    use crate::ai::types::OpenAIMessage;

    let test_client = LLMClient::new(config);

    let messages = vec![OpenAIMessage {
        role: "user".to_string(),
        content: "Say ok".to_string(),
    }];

    match test_client.chat_completion(messages, 0.0, 10, false).await {
        Ok(response) => Ok(format!("Connection successful: {}", response.trim())),
        Err(e) => Err(format!("Connection failed: {}", e)),
    }
}
