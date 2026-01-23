import json
import hashlib
from typing import Optional, Any
import redis.asyncio as redis

from ..config import get_settings

settings = get_settings()

_redis_client: Optional[redis.Redis] = None


async def get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis_client


def generate_cache_key(prefix: str, data: Any) -> str:
    """Generate a cache key from prefix and data."""
    data_str = json.dumps(data, sort_keys=True)
    hash_val = hashlib.sha256(data_str.encode()).hexdigest()[:16]
    return f"{prefix}:{hash_val}"


async def get_cached(key: str) -> Optional[dict]:
    """Get a cached value."""
    try:
        client = await get_redis()
        value = await client.get(key)
        if value:
            return json.loads(value)
    except Exception as e:
        print(f"Cache get error: {e}")
    return None


async def set_cached(key: str, value: dict, ttl: Optional[int] = None) -> bool:
    """Set a cached value."""
    try:
        client = await get_redis()
        ttl = ttl or settings.cache_ttl_seconds
        await client.setex(key, ttl, json.dumps(value))
        return True
    except Exception as e:
        print(f"Cache set error: {e}")
    return False


async def invalidate_cache(pattern: str) -> int:
    """Invalidate cached values matching pattern."""
    try:
        client = await get_redis()
        keys = await client.keys(pattern)
        if keys:
            return await client.delete(*keys)
    except Exception as e:
        print(f"Cache invalidate error: {e}")
    return 0
