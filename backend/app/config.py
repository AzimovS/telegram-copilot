from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # API settings
    api_title: str = "Telegram Copilot AI Backend"
    api_version: str = "0.1.0"
    debug: bool = False

    # OpenAI settings
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    # Redis settings
    redis_url: str = "redis://localhost:6379"
    cache_ttl_seconds: int = 3600  # 1 hour

    # CORS settings
    cors_origins: list[str] = ["http://localhost:1420", "tauri://localhost"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
