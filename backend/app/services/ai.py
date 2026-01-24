from openai import AsyncOpenAI
from typing import Optional
import json

from ..config import get_settings
from ..schemas.briefing import (
    ChatContext,
    ChatBriefing,
    MessageCategory,
    ChatSummaryContext,
    ChatSummaryResult,
)

settings = get_settings()
client: Optional[AsyncOpenAI] = None


def get_openai_client() -> AsyncOpenAI:
    global client
    if client is None:
        client = AsyncOpenAI(api_key=settings.openai_api_key)
    return client


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

    # Format messages for the prompt
    messages_text = "\n".join(
        [
            f"{'You' if msg.is_outgoing else msg.sender_name}: {msg.text}"
            for msg in chat.messages[-20:]  # Last 20 messages
        ]
    )

    user_prompt = f"""Analyze this Telegram chat and provide a briefing:

Chat: {chat.chat_title} ({chat.chat_type})

Recent messages:
{messages_text}

Provide your analysis in JSON format."""

    response = await openai_client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": BRIEFING_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
        max_tokens=500,
    )

    result = json.loads(response.choices[0].message.content)

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
            f"{'You' if msg.is_outgoing else msg.sender_name}: {msg.text}"
            for msg in messages[-50:]  # Last 50 messages
        ]
    )

    user_prompt = f"""Summarize this conversation in {max_length} characters or less:

{messages_text}"""

    response = await openai_client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
        max_tokens=200,
    )

    return response.choices[0].message.content.strip()


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
            f"{'You' if msg.is_outgoing else msg.sender_name}: {msg.text}"
            for msg in chat.messages[-30:]  # Last 30 messages
        ]
    )

    user_prompt = f"""Analyze this conversation and provide a detailed summary:

Chat: {chat.chat_title} ({chat.chat_type})

Messages:
{messages_text}

Provide your analysis in JSON format."""

    response = await openai_client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": DETAILED_SUMMARY_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
        max_tokens=600,
    )

    result = json.loads(response.choices[0].message.content)

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


DRAFT_SYSTEM_PROMPT = """You are an AI assistant that generates helpful draft replies for Telegram conversations.

Based on the conversation context, generate a friendly, appropriate reply that:
- Matches the tone and style of the conversation
- Addresses any questions or requests from the other person
- Is concise and to the point
- Sounds natural and human-like

Do NOT:
- Be overly formal unless the conversation is formal
- Include placeholders like [name] or [topic]
- Be robotic or generic
- Make up information you don't know

Just output the draft message text, nothing else."""


async def generate_reply_draft(
    chat_title: str,
    messages: list,
) -> str:
    """Generate a draft reply for a chat conversation."""
    openai_client = get_openai_client()

    messages_text = "\n".join(
        [
            f"{'You' if msg.get('is_outgoing') else msg.get('sender_name', 'Them')}: {msg.get('text', '')}"
            for msg in messages[-15:]  # Last 15 messages for context
        ]
    )

    user_prompt = f"""Generate a draft reply for this conversation:

Chat: {chat_title}

Recent messages:
{messages_text}

Write a natural, helpful reply to continue this conversation."""

    response = await openai_client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": DRAFT_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.7,
        max_tokens=300,
    )

    return response.choices[0].message.content.strip()
