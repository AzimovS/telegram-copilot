import time
from fastapi import APIRouter, HTTPException

from ..schemas.briefing import SummaryRequest, SummaryResponse
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
