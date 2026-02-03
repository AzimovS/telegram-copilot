from openai import AsyncOpenAI, RateLimitError, APIError
from typing import Optional
import json
import asyncio
import logging
import re

from ..config import get_settings
from ..schemas.briefing import (
    ChatContext,
    ChatBriefing,
    MessageCategory,
    ChatSummaryContext,
    ChatSummaryResult,
)

logger = logging.getLogger(__name__)

settings = get_settings()
client: Optional[AsyncOpenAI] = None

# Retry configuration for rate limits
MAX_RETRIES = 3
INITIAL_RETRY_DELAY = 1.0  # seconds


def get_openai_client() -> AsyncOpenAI:
    global client
    if client is None:
        client = AsyncOpenAI(api_key=settings.openai_api_key)
    return client


def safe_json_parse(content: str, default: dict) -> dict:
    """Safely parse JSON from OpenAI response with fallback."""
    if not content:
        logger.warning("Empty content received from OpenAI, using default")
        return default
    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON from OpenAI response: {e}")
        logger.debug(f"Raw content: {content[:500]}")
        return default


def sanitize_user_content(text: str) -> str:
    """Sanitize user-provided content to prevent prompt injection.

    This escapes special patterns that could be used to manipulate the prompt.
    """
    if not text:
        return ""
    # Escape common prompt injection patterns
    sanitized = text
    # Remove or escape instruction-like patterns
    sanitized = re.sub(r"(?i)(ignore|disregard|forget)\s+(previous|above|all)", "[filtered]", sanitized)
    # Escape triple backticks that could break out of code blocks
    sanitized = sanitized.replace("```", "'''")
    # Limit length to prevent context overflow attacks
    max_len = 10000
    if len(sanitized) > max_len:
        sanitized = sanitized[:max_len] + "...[truncated]"
    return sanitized


async def call_openai_with_retry(
    openai_client: AsyncOpenAI,
    messages: list,
    model: str,
    temperature: float,
    max_tokens: int,
    response_format: Optional[dict] = None,
) -> str:
    """Call OpenAI API with retry logic for rate limits."""
    last_error = None
    delay = INITIAL_RETRY_DELAY

    for attempt in range(MAX_RETRIES):
        try:
            kwargs = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            if response_format:
                kwargs["response_format"] = response_format

            response = await openai_client.chat.completions.create(**kwargs)
            return response.choices[0].message.content or ""
        except RateLimitError as e:
            last_error = e
            if attempt < MAX_RETRIES - 1:
                logger.warning(f"Rate limited by OpenAI, retrying in {delay}s (attempt {attempt + 1}/{MAX_RETRIES})")
                await asyncio.sleep(delay)
                delay *= 2  # Exponential backoff
            else:
                logger.error(f"Rate limit exceeded after {MAX_RETRIES} retries")
        except APIError as e:
            last_error = e
            if e.status_code and e.status_code >= 500 and attempt < MAX_RETRIES - 1:
                logger.warning(f"OpenAI server error, retrying in {delay}s (attempt {attempt + 1}/{MAX_RETRIES})")
                await asyncio.sleep(delay)
                delay *= 2
            else:
                raise

    raise last_error or Exception("OpenAI API call failed after retries")


BRIEFING_SYSTEM_PROMPT = """You are an AI assistant that analyzes Telegram chat messages and provides smart briefings.

For each chat, you must:
1. Categorize it as one of: "urgent" (requires immediate attention), "needs_reply" (waiting for your response), or "fyi" (informational only)
2. Provide a concise summary (1-2 sentences)
3. Extract 1-3 key points
4. Suggest an action if needed

Respond in JSON format matching this schema:
{
  "category": "urgent" | "needs_reply" | "fyi",
  "summary": "string",
  "key_points": ["string"],
  "suggested_action": "string or null"
}

Consider these factors for categorization:
- URGENT: Time-sensitive requests, emergencies, important deadlines mentioned
- NEEDS_REPLY: Questions asked to you, requests waiting for your response
- FYI: News, updates, broadcasts, messages that don't require action"""


async def generate_chat_briefing(chat: ChatContext) -> ChatBriefing:
    """Generate a briefing for a single chat."""
    openai_client = get_openai_client()

    # Format messages for the prompt with sanitization
    messages_text = "\n".join(
        [
            f"{'You' if msg.is_outgoing else sanitize_user_content(msg.sender_name)}: {sanitize_user_content(msg.text)}"
            for msg in chat.messages[-20:]  # Last 20 messages
        ]
    )

    user_prompt = f"""Analyze this Telegram chat and provide a briefing:

Chat: {sanitize_user_content(chat.chat_title)} ({chat.chat_type})

Recent messages:
{messages_text}

Provide your analysis in JSON format."""

    content = await call_openai_with_retry(
        openai_client,
        messages=[
            {"role": "system", "content": BRIEFING_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        model=settings.openai_model,
        temperature=0.3,
        max_tokens=500,
        response_format={"type": "json_object"},
    )

    default_result = {
        "category": "fyi",
        "summary": "Unable to analyze chat",
        "key_points": [],
        "suggested_action": None,
    }
    result = safe_json_parse(content, default_result)

    # Count unread (non-outgoing messages at the end)
    unread_count = 0
    for msg in reversed(chat.messages):
        if not msg.is_outgoing:
            unread_count += 1
        else:
            break

    return ChatBriefing(
        chat_id=chat.chat_id,
        chat_title=chat.chat_title,
        category=MessageCategory(result["category"]),
        summary=result["summary"],
        key_points=result["key_points"],
        suggested_action=result.get("suggested_action"),
        unread_count=unread_count,
        last_message_date=chat.messages[-1].date if chat.messages else 0,
    )


BRIEFING_V2_SYSTEM_PROMPT = """You analyze Telegram chats and classify their priority.

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
}"""


async def generate_briefing_v2(chat: ChatContext) -> dict:
    """Generate a V2 briefing for a single chat with priority and suggested reply."""
    openai_client = get_openai_client()

    # Build signals section
    signals = f"""SIGNALS:
- unread_count: {chat.unread_count}
- last_message_is_outgoing: {chat.last_message_is_outgoing}
- has_unanswered_question: {chat.has_unanswered_question}
- hours_since_last_activity: {chat.hours_since_last_activity:.1f}
- is_private_chat: {chat.is_private_chat}
"""

    # Format messages for the prompt (last 10 for context) with sanitization
    messages_text = "\n".join(
        [
            f"[{'You' if msg.is_outgoing else sanitize_user_content(msg.sender_name)}]: {sanitize_user_content(msg.text)}"
            for msg in chat.messages[-10:]
        ]
    )

    user_prompt = f"""Chat: {sanitize_user_content(chat.chat_title)} ({chat.chat_type})

{signals}
MESSAGES:
{messages_text}"""

    content = await call_openai_with_retry(
        openai_client,
        messages=[
            {"role": "system", "content": BRIEFING_V2_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        model=settings.openai_model,
        temperature=0.3,
        max_tokens=500,
        response_format={"type": "json_object"},
    )

    default_result = {
        "priority": "fyi",
        "summary": "Unable to analyze chat",
        "suggested_reply": None,
    }
    result = safe_json_parse(content, default_result)
    return result


SUMMARY_SYSTEM_PROMPT = """You are an AI assistant that summarizes Telegram chat conversations.
Provide a concise, informative summary that captures the key points of the conversation.
Focus on:
- Main topics discussed
- Any decisions made
- Action items or requests
- Important information shared

Keep the summary brief and to the point."""


async def generate_chat_summary(
    chat_id: int, messages: list, max_length: int = 200
) -> str:
    """Generate a summary for a chat."""
    openai_client = get_openai_client()

    messages_text = "\n".join(
        [
            f"{'You' if msg.is_outgoing else sanitize_user_content(msg.sender_name)}: {sanitize_user_content(msg.text)}"
            for msg in messages[-50:]  # Last 50 messages
        ]
    )

    user_prompt = f"""Summarize this conversation in {max_length} characters or less:

{messages_text}"""

    content = await call_openai_with_retry(
        openai_client,
        messages=[
            {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        model=settings.openai_model,
        temperature=0.3,
        max_tokens=200,
    )

    return content.strip() if content else "Unable to generate summary"


DETAILED_SUMMARY_PROMPT = """You are an AI assistant that provides detailed summaries of Telegram conversations.

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
}"""


async def generate_detailed_summary(chat: ChatSummaryContext) -> ChatSummaryResult:
    """Generate a detailed summary for a chat."""
    openai_client = get_openai_client()

    messages_text = "\n".join(
        [
            f"{'You' if msg.is_outgoing else sanitize_user_content(msg.sender_name)}: {sanitize_user_content(msg.text)}"
            for msg in chat.messages[-30:]  # Last 30 messages
        ]
    )

    user_prompt = f"""Analyze this conversation and provide a detailed summary:

Chat: {sanitize_user_content(chat.chat_title)} ({chat.chat_type})

Messages:
{messages_text}

Provide your analysis in JSON format."""

    content = await call_openai_with_retry(
        openai_client,
        messages=[
            {"role": "system", "content": DETAILED_SUMMARY_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        model=settings.openai_model,
        temperature=0.3,
        max_tokens=600,
        response_format={"type": "json_object"},
    )

    default_result = {
        "summary": "Unable to analyze conversation",
        "key_points": [],
        "action_items": [],
        "sentiment": "neutral",
        "needs_response": False,
    }
    result = safe_json_parse(content, default_result)

    return ChatSummaryResult(
        chat_id=chat.chat_id,
        chat_title=chat.chat_title,
        chat_type=chat.chat_type,
        summary=result["summary"],
        key_points=result.get("key_points", []),
        action_items=result.get("action_items", []),
        sentiment=result.get("sentiment", "neutral"),
        needs_response=result.get("needs_response", False),
        message_count=len(chat.messages),
        last_message_date=chat.messages[-1].date if chat.messages else 0,
    )


DRAFT_SYSTEM_PROMPT = """You are an AI assistant helping a user draft a message in Telegram.

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

Output ONLY the draft message text, nothing else."""


async def generate_reply_draft(
    chat_title: str,
    messages: list,
) -> str:
    """Generate a draft reply for a chat conversation."""
    openai_client = get_openai_client()

    # Determine who the other person is (for context)
    other_names = set()
    for msg in messages:
        if not msg.get('is_outgoing'):
            name = msg.get('sender_name', '')
            if name and name != 'You':
                other_names.add(name)
    other_person = ', '.join(other_names) if other_names else 'the other person'

    # Sanitize all user-provided content to prevent prompt injection
    messages_text = "\n".join(
        [
            f"{'You' if msg.get('is_outgoing') else sanitize_user_content(msg.get('sender_name', 'Them'))}: {sanitize_user_content(msg.get('text', ''))}"
            for msg in messages[-15:]  # Last 15 messages for context
        ]
    )

    sanitized_title = sanitize_user_content(chat_title)

    # Determine context for the draft
    last_msg = messages[-1] if messages else None
    if last_msg and last_msg.get('is_outgoing'):
        context_hint = "The last message was from You. Write a follow-up or continue the conversation."
    else:
        context_hint = f"The last message was from {sanitize_user_content(other_person)}. Write a reply to them."

    user_prompt = f"""Generate a draft message for this conversation:

Chat with: {sanitized_title}

Recent messages:
{messages_text}

{context_hint}

Write the draft message that "You" will send:"""

    content = await call_openai_with_retry(
        openai_client,
        messages=[
            {"role": "system", "content": DRAFT_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        model=settings.openai_model,
        temperature=0.7,
        max_tokens=300,
    )

    return content.strip() if content else ""
