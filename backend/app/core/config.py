from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # API Keys
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    # Auth
    secret_key: str = "dev-secret-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080  # 7 days

    # Database
    database_url: str = "sqlite+aiosqlite:///./academic_rag.db"

    # Storage
    chroma_persist_dir: str = "./chroma_db"
    upload_dir: str = "./uploads"

    # RAG settings
    chunk_size: int = 500          # tokens per chunk
    chunk_overlap: int = 50        # token overlap between chunks
    top_k_results: int = 5         # number of chunks to retrieve
    embedding_model: str = "text-embedding-3-small"
    llm_model: str = "claude-sonnet-4-20250514"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
