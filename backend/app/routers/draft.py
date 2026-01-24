from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from ..services import ai

router = APIRouter()


class DraftMessage(BaseModel):
    sender_name: str
    text: str
    is_outgoing: bool


class DraftRequest(BaseModel):
    chat_id: int
    chat_title: str
    messages: List[DraftMessage]


class DraftResponse(BaseModel):
    draft: str
    chat_id: int


@router.post("/generate", response_model=DraftResponse)
async def generate_draft(request: DraftRequest):
    """Generate an AI draft reply for a chat conversation."""
    if not request.messages:
        raise HTTPException(status_code=400, detail="No messages provided")

    try:
        # Convert messages to dict format for the AI service
        messages_dict = [
            {
                "sender_name": msg.sender_name,
                "text": msg.text,
                "is_outgoing": msg.is_outgoing,
            }
            for msg in request.messages
        ]

        draft = await ai.generate_reply_draft(
            chat_title=request.chat_title,
            messages=messages_dict,
        )

        return DraftResponse(
            draft=draft,
            chat_id=request.chat_id,
        )
    except Exception as e:
        print(f"Error generating draft: {e}")
        raise HTTPException(status_code=500, detail=str(e))
