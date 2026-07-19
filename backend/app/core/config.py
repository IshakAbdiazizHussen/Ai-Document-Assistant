from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "AI Document Assistant"
    environment: str = "development"

    database_url: str = Field(
        default="postgresql+psycopg://postgres:postgres@localhost:5432/Ai Document Assistant"
    )

    openai_api_key: str = Field(default="")
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
    cors_allowed_origins: str = "http://localhost:3000"

    @property
    def cors_allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
