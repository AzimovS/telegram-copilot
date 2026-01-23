import time
import asyncio
from fastapi import APIRouter, HTTPException

from ..schemas.briefing import (
    BriefingRequest,
    BriefingResponse,
    ChatBriefing,
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
            return BriefingResponse(**cached, cached=True)

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


@router.delete("/cache")
async def clear_briefing_cache():
    """Clear the briefing cache."""
    count = await cache.invalidate_cache("briefing:*")
    return {"cleared": count}
