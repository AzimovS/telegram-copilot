import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport

import fakeredis.aioredis


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def fake_redis():
    """Create a fake Redis instance for testing."""
    server = fakeredis.aioredis.FakeRedis(decode_responses=True)
    yield server
    await server.aclose()


@pytest.fixture
def mock_openai_response():
    """Factory fixture for creating mock OpenAI responses."""
    def _create_response(content: str):
        mock_response = AsyncMock()
        mock_response.choices = [
            AsyncMock(message=AsyncMock(content=content))
        ]
        return mock_response
    return _create_response


@pytest.fixture
async def mock_openai_client(mock_openai_response):
    """Mock the OpenAI client."""
    with patch("app.services.ai.get_openai_client") as mock_get_client:
        mock_client = AsyncMock()
        mock_get_client.return_value = mock_client
        yield mock_client


@pytest.fixture
def mock_cache(fake_redis):
    """Mock the cache module to use fake Redis."""
    with patch("app.services.cache.get_redis") as mock_get_redis:
        async def _get_redis():
            return fake_redis
        mock_get_redis.side_effect = _get_redis
        yield fake_redis


@pytest.fixture
def sample_chat_context():
    """Sample chat context for testing."""
    return {
        "chat_id": 123,
        "chat_title": "Test Chat",
        "chat_type": "private",
        "messages": [
            {
                "id": 1,
                "sender_name": "Alice",
                "text": "Hey, how are you?",
                "date": 1700000000,
                "is_outgoing": False
            },
            {
                "id": 2,
                "sender_name": "You",
                "text": "I'm good, thanks!",
                "date": 1700000060,
                "is_outgoing": True
            },
            {
                "id": 3,
                "sender_name": "Alice",
                "text": "Can you help me with something?",
                "date": 1700000120,
                "is_outgoing": False
            }
        ],
        "unread_count": 1,
        "last_message_is_outgoing": False,
        "has_unanswered_question": True,
        "hours_since_last_activity": 1.0,
        "is_private_chat": True
    }


@pytest.fixture
def sample_briefing_request(sample_chat_context):
    """Sample briefing request."""
    return {
        "chats": [sample_chat_context],
        "regenerate": False
    }


@pytest.fixture
async def test_client(mock_cache, mock_openai_client):
    """Create a test client with mocked dependencies."""
    # Import app after patching dependencies
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
