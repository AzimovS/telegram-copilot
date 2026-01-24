from pydantic import BaseModel
from enum import Enum
from typing import Optional


class MessageCategory(str, Enum):
    URGENT = "urgent"
    NEEDS_REPLY = "needs_reply"
    FYI = "fyi"


class ChatMessage(BaseModel):
    id: int
    sender_name: str
    text: str
    date: int
    is_outgoing: bool


class ChatContext(BaseModel):
    chat_id: int
    chat_title: str
    chat_type: str
    messages: list[ChatMessage]


class BriefingRequest(BaseModel):
    chats: list[ChatContext]
    regenerate: bool = False


class ChatBriefing(BaseModel):
    chat_id: int
    chat_title: str
    category: MessageCategory
    summary: str
    key_points: list[str]
    suggested_action: Optional[str] = None
    unread_count: int
    last_message_date: int


class BriefingResponse(BaseModel):
    briefings: list[ChatBriefing]
    generated_at: int
    cached: bool = False


class SummaryRequest(BaseModel):
    chat_id: int
    messages: list[ChatMessage]
    max_length: int = 200


class SummaryResponse(BaseModel):
    chat_id: int
    summary: str
    generated_at: int
    cached: bool = False


# Batch summary schemas
class ChatSummaryContext(BaseModel):
    chat_id: int
    chat_title: str
    chat_type: str
    messages: list[ChatMessage]
    unread_count: int = 0


class ChatSummaryResult(BaseModel):
    chat_id: int
    chat_title: str
    chat_type: str
    summary: str
    key_points: list[str]
    action_items: list[str]
    sentiment: str  # "positive", "neutral", "negative"
    needs_response: bool
    message_count: int
    last_message_date: int


class BatchSummaryRequest(BaseModel):
    chats: list[ChatSummaryContext]
    regenerate: bool = False


class BatchSummaryResponse(BaseModel):
    summaries: list[ChatSummaryResult]
    total_count: int
    generated_at: int
    cached: bool = False
