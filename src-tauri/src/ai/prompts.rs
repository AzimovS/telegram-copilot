/// System prompt for Briefing V2 - classifies chats by priority
pub const BRIEFING_V2_SYSTEM_PROMPT: &str = r#"You analyze Telegram chats and classify their priority.

You will receive:
- Chat messages (with sender, text, date, is_outgoing flag)
- Pre-computed signals about the conversation

CLASSIFICATION RULES:

**URGENT** - Requires immediate action:
- Contains: "urgent", "asap", "deadline", "emergency", "critical", "important"
- Mentions specific dates/times for something due soon
- Multiple rapid messages showing frustration or urgency

**NEEDS_REPLY** - Someone is waiting for your response:
- last_message_is_outgoing=false AND is_private_chat=true (they messaged you in DM)
- has_unanswered_question=true (they asked a question you haven't answered)
- Clear requests: "can you", "please", "let me know", "waiting for", "need your"
- You're directly addressed or asked for input

**FYI** - No action needed:
- last_message_is_outgoing=true (you already replied)
- Channel broadcasts or announcements
- Group discussions where you're not addressed
- Automated messages or notifications
- General news/updates

IMPORTANT: If last_message_is_outgoing=true, it's almost always FYI (you already responded).
If is_private_chat=true AND last_message_is_outgoing=false, it's almost always NEEDS_REPLY.

Respond in JSON:
{
  "priority": "urgent" | "needs_reply" | "fyi",
  "summary": "1-2 sentence summary",
  "suggested_reply": "natural reply text or null if fyi"
}"#;

/// System prompt for detailed summary generation
pub const DETAILED_SUMMARY_PROMPT: &str = r#"You are an AI assistant that provides detailed summaries of Telegram conversations.

Analyze the conversation and provide:
1. A concise summary (2-3 sentences)
2. Key points discussed (up to 3)
3. Action items mentioned (up to 3)
4. Overall sentiment: "positive", "neutral", or "negative"
5. Whether the conversation needs a response from the user (true/false)

Respond in JSON format:
{
  "summary": "string",
  "key_points": ["string"],
  "action_items": ["string"],
  "sentiment": "positive" | "neutral" | "negative",
  "needs_response": boolean
}"#;

/// System prompt for draft generation
pub const DRAFT_SYSTEM_PROMPT: &str = r#"You are an AI assistant helping a user draft a message in Telegram.

IMPORTANT: You are writing a message on behalf of "You" (the user). The conversation shows messages between "You" and other participants.

Your task:
- Write a draft message that "You" will send
- If the last message is from someone else, respond to their message
- If the last message is from "You", help continue or follow up naturally
- Match the tone and style of the conversation
- Address any questions or requests from the other person
- Be concise and natural

Do NOT:
- Respond as if you are the other person
- Be overly formal unless the conversation is formal
- Include placeholders like [name] or [topic]
- Be robotic or generic
- Make up information

Output ONLY the draft message text, nothing else."#;

/// Format messages for briefing V2 user prompt
pub fn format_briefing_v2_user_prompt(
    chat_title: &str,
    chat_type: &str,
    unread_count: i32,
    last_message_is_outgoing: bool,
    has_unanswered_question: bool,
    hours_since_last_activity: f64,
    is_private_chat: bool,
    messages: &[(String, String)], // (sender_name, text)
) -> String {
    let messages_text: String = messages
        .iter()
        .map(|(sender, text)| format!("[{}]: {}", sender, text))
        .collect::<Vec<_>>()
        .join("\n");

    format!(
        r#"Chat: {} ({})

SIGNALS:
- unread_count: {}
- last_message_is_outgoing: {}
- has_unanswered_question: {}
- hours_since_last_activity: {:.1}
- is_private_chat: {}

MESSAGES:
{}"#,
        chat_title,
        chat_type,
        unread_count,
        last_message_is_outgoing,
        has_unanswered_question,
        hours_since_last_activity,
        is_private_chat,
        messages_text
    )
}

/// Format messages for summary user prompt
pub fn format_summary_user_prompt(
    chat_title: &str,
    chat_type: &str,
    messages: &[(String, String)], // (sender_name, text)
) -> String {
    let messages_text: String = messages
        .iter()
        .map(|(sender, text)| format!("{}: {}", sender, text))
        .collect::<Vec<_>>()
        .join("\n");

    format!(
        r#"Analyze this conversation and provide a detailed summary:

Chat: {} ({})

Messages:
{}

Provide your analysis in JSON format."#,
        chat_title, chat_type, messages_text
    )
}

/// Format messages for draft user prompt
pub fn format_draft_user_prompt(
    chat_title: &str,
    messages: &[(String, String, bool)], // (sender_name, text, is_outgoing)
) -> String {
    let messages_text: String = messages
        .iter()
        .map(|(sender, text, _)| format!("{}: {}", sender, text))
        .collect::<Vec<_>>()
        .join("\n");

    // Determine context hint based on last message
    let context_hint = if let Some((sender, _, is_outgoing)) = messages.last() {
        if *is_outgoing {
            "The last message was from You. Write a follow-up or continue the conversation.".to_string()
        } else {
            format!(
                "The last message was from {}. Write a reply to them.",
                sender
            )
        }
    } else {
        "Start the conversation naturally.".to_string()
    };

    format!(
        r#"Generate a draft message for this conversation:

Chat with: {}

Recent messages:
{}

{}

Write the draft message that "You" will send:"#,
        chat_title, messages_text, context_hint
    )
}
