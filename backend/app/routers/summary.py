import time
import asyncio
from fastapi import APIRouter, HTTPException

from ..schemas.briefing import (
    SummaryRequest,
    SummaryResponse,
    BatchSummaryRequest,
    BatchSummaryResponse,
    ChatSummaryResult,
)
from ..services import ai, cache

router = APIRouter()


@router.post("/generate", response_model=SummaryResponse)
async def generate_summary(request: SummaryRequest):
    """Generate a summary for the provided messages."""
    if not request.messages:
        raise HTTPException(status_code=400, detail="No messages provided")

    # Check cache first
    cache_key = cache.generate_cache_key(
        "summary",
        {
            "chat_id": request.chat_id,
            "message_ids": [m.id for m in request.messages],
        },
    )

    cached = await cache.get_cached(cache_key)
    if cached:
        return SummaryResponse(**cached, cached=True)

    # Generate summary
    try:
        summary = await ai.generate_chat_summary(
            request.chat_id,
            request.messages,
            request.max_length,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate summary: {e}")

    response = SummaryResponse(
        chat_id=request.chat_id,
        summary=summary,
        generated_at=int(time.time()),
        cached=False,
    )

    # Cache the result
    await cache.set_cached(cache_key, response.model_dump())

    return response


@router.post("/batch", response_model=BatchSummaryResponse)
async def generate_batch_summaries(request: BatchSummaryRequest):
    """Generate detailed summaries for multiple chats."""
    if not request.chats:
        raise HTTPException(status_code=400, detail="No chats provided")

    # Check cache first (unless regenerate is requested)
    cache_key = cache.generate_cache_key(
        "batch_summary",
        {"chat_ids": [c.chat_id for c in request.chats]},
    )

    if not request.regenerate:
        cached_data = await cache.get_cached(cache_key)
        if cached_data:
            cached_data["cached"] = True
            return BatchSummaryResponse(**cached_data)

    # Generate summaries for each chat in parallel
    async def process_chat(chat_context):
        try:
            return await ai.generate_detailed_summary(chat_context)
        except Exception as e:
            print(f"Error processing chat {chat_context.chat_id}: {e}")
            # Return a basic summary on error
            return ChatSummaryResult(
                chat_id=chat_context.chat_id,
                chat_title=chat_context.chat_title,
                chat_type=chat_context.chat_type,
                summary="Unable to generate summary",
                key_points=[],
                action_items=[],
                sentiment="neutral",
                needs_response=False,
                message_count=len(chat_context.messages),
                last_message_date=chat_context.messages[-1].date
                if chat_context.messages
                else 0,
            )

    summaries = await asyncio.gather(
        *[process_chat(chat) for chat in request.chats]
    )

    response = BatchSummaryResponse(
        summaries=list(summaries),
        total_count=len(summaries),
        generated_at=int(time.time()),
        cached=False,
    )

    # Cache the result
    await cache.set_cached(cache_key, response.model_dump())

    return response


@router.delete("/cache")
async def clear_summary_cache():
    """Clear the summary cache."""
    count = await cache.invalidate_cache("summary:*")
    count += await cache.invalidate_cache("batch_summary:*")
    return {"cleared": count}
