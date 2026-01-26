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
    cache_ttl_seconds: int = 21600  # 6 hours

    # CORS settings
    cors_origins: list[str] = [
        "http://localhost:1420",
        "http://localhost:5173",
        "http://127.0.0.1:1420",
        "http://127.0.0.1:5173",
        "tauri://localhost",
        "https://tauri.localhost",
    ]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
