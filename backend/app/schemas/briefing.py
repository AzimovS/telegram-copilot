from pydantic import BaseModel
from enum import Enum
from typing import Optional, List


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

    # Pre-computed signals (optional for backwards compat)
    unread_count: int = 0
    last_message_is_outgoing: bool = False
    has_unanswered_question: bool = False
    hours_since_last_activity: float = 0
    is_private_chat: bool = False


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


# New Briefing V2 schemas (matching specification)
class Priority(str, Enum):
    URGENT = "urgent"
    NEEDS_REPLY = "needs_reply"
    FYI = "fyi"


class ResponseItem(BaseModel):
    id: int
    chat_id: int
    chat_name: str
    chat_type: str  # 'dm' | 'group' | 'channel'
    unread_count: int
    last_message: Optional[str] = None
    last_message_date: Optional[str] = None  # ISO datetime
    priority: Priority
    summary: str
    suggested_reply: Optional[str] = None


class FYIItem(BaseModel):
    id: int
    chat_id: int
    chat_name: str
    chat_type: str
    unread_count: int
    last_message: Optional[str] = None
    last_message_date: Optional[str] = None
    priority: Priority = Priority.FYI
    summary: str


class BriefingStats(BaseModel):
    needs_response_count: int
    fyi_count: int
    total_unread: int


class BriefingV2Response(BaseModel):
    needs_response: List[ResponseItem]
    fyi_summaries: List[FYIItem]
    stats: BriefingStats
    generated_at: str  # ISO datetime
    cached: bool = False
    cache_age: Optional[str] = None  # "1h ago", "2d ago", etc.


class BriefingV2Request(BaseModel):
    chats: List[ChatContext]
    force_refresh: bool = False
