from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "AI Document Assistant"
    environment: str = "development"

    # No defaults: both are required so the app fails fast at startup
    # (before uvicorn binds a port) if either is missing, rather than
    # booting with an empty API key or a placeholder database.
    database_url: str
    openai_api_key: str

    openai_chat_model: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-3-small"

    chroma_persist_dir: str = "storage/chroma"
    upload_dir: str = "storage/uploads"
    max_upload_size_bytes: int = 20 * 1024 * 1024  # 20 MB

    chunk_size_tokens: int = 800
    chunk_overlap_tokens: int = 100
    retrieval_top_k: int = 5

    chat_message_max_length: int = 4000

    # Comma-separated list of origins allowed to call this API from a
    # browser (frontend/.env.local's NEXT_PUBLIC_API_URL points here, but
    # CORS is governed by the frontend's own origin, not that URL).
    # Includes 3001 as a fallback: Next.js auto-bumps to the next free port
    # whenever something else is already holding 3000 in local dev.
    cors_allowed_origins: str = "http://localhost:3000,http://localhost:3001"

    @property
    def cors_allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
