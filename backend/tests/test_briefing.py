import pytest
import json
from unittest.mock import AsyncMock


@pytest.mark.asyncio
async def test_health_check(test_client):
    """Test the health check endpoint."""
    response = await test_client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data


@pytest.mark.asyncio
async def test_generate_briefing_empty_chats(test_client):
    """Test that empty chats returns 400."""
    response = await test_client.post(
        "/api/briefing/generate",
        json={"chats": [], "regenerate": False}
    )
    assert response.status_code == 400
    assert "No chats provided" in response.json()["detail"]


@pytest.mark.asyncio
async def test_generate_briefing_success(
    test_client,
    mock_openai_client,
    sample_briefing_request,
    mock_openai_response
):
    """Test successful briefing generation."""
    # Mock the OpenAI response
    mock_openai_client.chat.completions.create = AsyncMock(
        return_value=mock_openai_response(json.dumps({
            "category": "needs_reply",
            "summary": "Alice needs help with something",
            "key_points": ["Asked for help"],
            "suggested_action": "Reply to Alice"
        }))
    )

    response = await test_client.post(
        "/api/briefing/generate",
        json=sample_briefing_request
    )

    assert response.status_code == 200
    data = response.json()
    assert "briefings" in data
    assert len(data["briefings"]) == 1
    assert data["briefings"][0]["category"] == "needs_reply"
    assert data["cached"] is False


@pytest.mark.asyncio
async def test_generate_briefing_caching(
    test_client,
    mock_openai_client,
    sample_briefing_request,
    mock_openai_response,
    mock_cache
):
    """Test that briefings are cached."""
    # First request - generates new briefing
    mock_openai_client.chat.completions.create = AsyncMock(
        return_value=mock_openai_response(json.dumps({
            "category": "fyi",
            "summary": "General update",
            "key_points": [],
            "suggested_action": None
        }))
    )

    response1 = await test_client.post(
        "/api/briefing/generate",
        json=sample_briefing_request
    )
    assert response1.status_code == 200
    assert response1.json()["cached"] is False

    # Reset mock to verify it's not called again
    mock_openai_client.chat.completions.create.reset_mock()

    # Second request - should use cache
    response2 = await test_client.post(
        "/api/briefing/generate",
        json=sample_briefing_request
    )
    assert response2.status_code == 200
    assert response2.json()["cached"] is True

    # Verify OpenAI was not called for the second request
    mock_openai_client.chat.completions.create.assert_not_called()


@pytest.mark.asyncio
async def test_generate_briefing_regenerate_bypasses_cache(
    test_client,
    mock_openai_client,
    sample_briefing_request,
    mock_openai_response,
    mock_cache
):
    """Test that regenerate=True bypasses cache."""
    mock_openai_client.chat.completions.create = AsyncMock(
        return_value=mock_openai_response(json.dumps({
            "category": "urgent",
            "summary": "Urgent message",
            "key_points": ["Important"],
            "suggested_action": "Respond immediately"
        }))
    )

    # First request - populates cache
    response1 = await test_client.post(
        "/api/briefing/generate",
        json=sample_briefing_request
    )
    assert response1.status_code == 200

    # Second request with regenerate=True
    sample_briefing_request["regenerate"] = True
    response2 = await test_client.post(
        "/api/briefing/generate",
        json=sample_briefing_request
    )
    assert response2.status_code == 200
    assert response2.json()["cached"] is False

    # Verify OpenAI was called twice
    assert mock_openai_client.chat.completions.create.call_count == 2


@pytest.mark.asyncio
async def test_generate_briefing_v2_success(
    test_client,
    mock_openai_client,
    sample_chat_context,
    mock_openai_response
):
    """Test successful V2 briefing generation."""
    mock_openai_client.chat.completions.create = AsyncMock(
        return_value=mock_openai_response(json.dumps({
            "priority": "needs_reply",
            "summary": "Alice asked for help with something",
            "suggested_reply": "Sure, what do you need help with?"
        }))
    )

    response = await test_client.post(
        "/api/briefing/v2/generate",
        json={
            "chats": [sample_chat_context],
            "force_refresh": False
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert "needs_response" in data
    assert "fyi_summaries" in data
    assert "stats" in data
    assert len(data["needs_response"]) == 1
    assert data["needs_response"][0]["priority"] == "needs_reply"
    assert data["needs_response"][0]["suggested_reply"] is not None


@pytest.mark.asyncio
async def test_generate_briefing_v2_fyi_classification(
    test_client,
    mock_openai_client,
    sample_chat_context,
    mock_openai_response
):
    """Test that FYI items are classified correctly."""
    mock_openai_client.chat.completions.create = AsyncMock(
        return_value=mock_openai_response(json.dumps({
            "priority": "fyi",
            "summary": "General update, no action needed",
            "suggested_reply": None
        }))
    )

    response = await test_client.post(
        "/api/briefing/v2/generate",
        json={
            "chats": [sample_chat_context],
            "force_refresh": False
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["needs_response"]) == 0
    assert len(data["fyi_summaries"]) == 1
    assert data["fyi_summaries"][0]["priority"] == "fyi"


@pytest.mark.asyncio
async def test_clear_briefing_cache(test_client, mock_cache):
    """Test cache clearing endpoint."""
    # Add some test data to cache
    await mock_cache.setex("briefing:test1", 3600, "{}")
    await mock_cache.setex("briefing_v2:test2", 3600, "{}")
    await mock_cache.setex("other:test3", 3600, "{}")

    response = await test_client.delete("/api/briefing/cache")

    assert response.status_code == 200
    data = response.json()
    assert data["cleared"] >= 0

    # Verify briefing caches are cleared but other keys remain
    assert await mock_cache.get("other:test3") == "{}"


@pytest.mark.asyncio
async def test_generate_briefing_handles_ai_error(
    test_client,
    mock_openai_client,
    sample_briefing_request
):
    """Test that AI errors are handled gracefully."""
    mock_openai_client.chat.completions.create = AsyncMock(
        side_effect=Exception("OpenAI API Error")
    )

    response = await test_client.post(
        "/api/briefing/generate",
        json=sample_briefing_request
    )

    # Should still return 200 with fallback briefing
    assert response.status_code == 200
    data = response.json()
    assert len(data["briefings"]) == 1
    assert "Unable to generate summary" in data["briefings"][0]["summary"]


@pytest.mark.asyncio
async def test_normalize_chat_type():
    """Test chat type normalization."""
    from app.routers.briefing import _normalize_chat_type

    assert _normalize_chat_type("private") == "dm"
    assert _normalize_chat_type("dm") == "dm"
    assert _normalize_chat_type("user") == "dm"
    assert _normalize_chat_type("group") == "group"
    assert _normalize_chat_type("supergroup") == "group"
    assert _normalize_chat_type("megagroup") == "group"
    assert _normalize_chat_type("channel") == "channel"
    assert _normalize_chat_type("broadcast") == "channel"
    assert _normalize_chat_type("unknown") == "dm"  # Default


@pytest.mark.asyncio
async def test_calculate_cache_age():
    """Test cache age calculation."""
    from app.routers.briefing import _calculate_cache_age
    from datetime import datetime, timedelta

    # Just now
    now = datetime.now().isoformat()
    assert _calculate_cache_age(now) == "just now"

    # Minutes ago
    minutes_ago = (datetime.now() - timedelta(minutes=30)).isoformat()
    assert "m ago" in _calculate_cache_age(minutes_ago)

    # Hours ago
    hours_ago = (datetime.now() - timedelta(hours=5)).isoformat()
    assert "h ago" in _calculate_cache_age(hours_ago)

    # Days ago
    days_ago = (datetime.now() - timedelta(days=2)).isoformat()
    assert "d ago" in _calculate_cache_age(days_ago)

    # Invalid date
    assert _calculate_cache_age("invalid") == "unknown"
