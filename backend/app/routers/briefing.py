import time
import asyncio
from datetime import datetime
from fastapi import APIRouter, HTTPException

from ..schemas.briefing import (
    BriefingRequest,
    BriefingResponse,
    ChatBriefing,
    BriefingV2Request,
    BriefingV2Response,
    ResponseItem,
    FYIItem,
    BriefingStats,
    Priority,
)
from ..services import ai, cache

router = APIRouter()


@router.post("/generate", response_model=BriefingResponse)
async def generate_briefing(request: BriefingRequest):
    """Generate smart briefings for the provided chats."""
    if not request.chats:
        raise HTTPException(status_code=400, detail="No chats provided")

    # Check cache first (unless regenerate is requested)
    cache_key = cache.generate_cache_key(
        "briefing",
        {"chat_ids": [c.chat_id for c in request.chats]},
    )

    if not request.regenerate:
        cached = await cache.get_cached(cache_key)
        if cached:
            cached["cached"] = True
            return BriefingResponse(**cached)

    # Generate briefings for each chat in parallel
    async def process_chat(chat_context):
        try:
            return await ai.generate_chat_briefing(chat_context)
        except Exception as e:
            print(f"Error processing chat {chat_context.chat_id}: {e}")
            # Return a basic briefing on error
            return ChatBriefing(
                chat_id=chat_context.chat_id,
                chat_title=chat_context.chat_title,
                category="fyi",
                summary="Unable to generate summary",
                key_points=[],
                suggested_action=None,
                unread_count=0,
                last_message_date=chat_context.messages[-1].date
                if chat_context.messages
                else 0,
            )

    briefings = await asyncio.gather(
        *[process_chat(chat) for chat in request.chats]
    )

    response = BriefingResponse(
        briefings=list(briefings),
        generated_at=int(time.time()),
        cached=False,
    )

    # Cache the result
    await cache.set_cached(cache_key, response.model_dump())

    return response


@router.post("/v2/generate", response_model=BriefingV2Response)
async def generate_briefing_v2(request: BriefingV2Request):
    """Generate smart briefings with the new V2 format matching specification."""
    if not request.chats:
        raise HTTPException(status_code=400, detail="No chats provided")

    # Check cache first (unless force_refresh is requested)
    cache_key = cache.generate_cache_key(
        "briefing_v2",
        {"chat_ids": [c.chat_id for c in request.chats]},
    )

    if not request.force_refresh:
        cached_data = await cache.get_cached(cache_key)
        if cached_data:
            # Calculate cache age
            cache_age = _calculate_cache_age(cached_data.get("generated_at"))
            cached_data["cached"] = True
            cached_data["cache_age"] = cache_age
            return BriefingV2Response(**cached_data)

    # Generate briefings for each chat in parallel
    async def process_chat(chat_context):
        try:
            return await ai.generate_briefing_v2(chat_context)
        except Exception as e:
            print(f"Error processing chat {chat_context.chat_id}: {e}")
            return None

    results = await asyncio.gather(
        *[process_chat(chat) for chat in request.chats]
    )

    # Separate into needs_response and fyi_summaries
    needs_response: list[ResponseItem] = []
    fyi_summaries: list[FYIItem] = []
    total_unread = 0
    item_id = 1

    for result, chat in zip(results, request.chats):
        if result is None:
            # Default to FYI on error
            fyi_summaries.append(FYIItem(
                id=item_id,
                chat_id=chat.chat_id,
                chat_name=chat.chat_title or "Unknown",
                chat_type=_normalize_chat_type(chat.chat_type),
                unread_count=len([m for m in chat.messages if not m.is_outgoing]),
                last_message=chat.messages[-1].text[:300] if chat.messages else None,
                last_message_date=_timestamp_to_iso(chat.messages[-1].date) if chat.messages else None,
                summary="Unable to analyze this chat",
            ))
        elif result["priority"] in ["urgent", "needs_reply"]:
            unread = len([m for m in chat.messages if not m.is_outgoing])
            needs_response.append(ResponseItem(
                id=item_id,
                chat_id=chat.chat_id,
                chat_name=chat.chat_title or "Unknown",
                chat_type=_normalize_chat_type(chat.chat_type),
                unread_count=unread,
                last_message=chat.messages[-1].text[:300] if chat.messages else None,
                last_message_date=_timestamp_to_iso(chat.messages[-1].date) if chat.messages else None,
                priority=Priority(result["priority"]),
                summary=result["summary"],
                suggested_reply=result.get("suggested_reply"),
            ))
            total_unread += unread
        else:
            unread = len([m for m in chat.messages if not m.is_outgoing])
            fyi_summaries.append(FYIItem(
                id=item_id,
                chat_id=chat.chat_id,
                chat_name=chat.chat_title or "Unknown",
                chat_type=_normalize_chat_type(chat.chat_type),
                unread_count=unread,
                last_message=chat.messages[-1].text[:300] if chat.messages else None,
                last_message_date=_timestamp_to_iso(chat.messages[-1].date) if chat.messages else None,
                summary=result["summary"],
            ))
            total_unread += unread

        item_id += 1

    # Sort needs_response: urgent first, then needs_reply
    needs_response.sort(key=lambda x: 0 if x.priority == Priority.URGENT else 1)

    generated_at = datetime.now().isoformat()

    response = BriefingV2Response(
        needs_response=needs_response,
        fyi_summaries=fyi_summaries,
        stats=BriefingStats(
            needs_response_count=len(needs_response),
            fyi_count=len(fyi_summaries),
            total_unread=total_unread,
        ),
        generated_at=generated_at,
        cached=False,
        cache_age=None,
    )

    # Cache the result
    await cache.set_cached(cache_key, response.model_dump())

    return response


def _normalize_chat_type(chat_type: str) -> str:
    """Normalize chat type to dm/group/channel."""
    chat_type = chat_type.lower()
    if chat_type in ["private", "dm", "user"]:
        return "dm"
    elif chat_type in ["group", "supergroup", "megagroup"]:
        return "group"
    elif chat_type in ["channel", "broadcast"]:
        return "channel"
    return "dm"


def _timestamp_to_iso(timestamp: int) -> str:
    """Convert Unix timestamp to ISO datetime string."""
    return datetime.fromtimestamp(timestamp).isoformat()


def _calculate_cache_age(generated_at: str) -> str:
    """Calculate human-readable cache age."""
    try:
        gen_time = datetime.fromisoformat(generated_at)
        now = datetime.now()
        diff = now - gen_time

        minutes = int(diff.total_seconds() / 60)
        hours = int(diff.total_seconds() / 3600)
        days = int(diff.total_seconds() / 86400)

        if minutes < 1:
            return "just now"
        elif minutes < 60:
            return f"{minutes}m ago"
        elif hours < 24:
            return f"{hours}h ago"
        else:
            return f"{days}d ago"
    except Exception:
        return "unknown"


@router.delete("/cache")
async def clear_briefing_cache():
    """Clear the briefing cache."""
    count = await cache.invalidate_cache("briefing:*")
    count += await cache.invalidate_cache("briefing_v2:*")
    return {"cleared": count}
