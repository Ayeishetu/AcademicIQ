from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

settings = get_settings()


def _get_db_url() -> str:
    """
    Normalise the DATABASE_URL to use the correct async driver:
    - sqlite            → sqlite+aiosqlite
    - postgresql (prod) → postgresql+asyncpg
    Keeps existing driver prefixes unchanged.
    """
    url = settings.database_url
    if url.startswith("postgresql://") or url.startswith("postgres://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1) \
                  .replace("postgres://", "postgresql+asyncpg://", 1)
    return url


_db_url = _get_db_url()

engine_kwargs: dict = {"echo": False}

if _db_url.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
elif "supabase" in _db_url:
    # Supabase pooler requires prepared statements disabled for asyncpg
    engine_kwargs["connect_args"] = {"prepared_statement_cache_size": 0}
    engine_kwargs["pool_pre_ping"] = True

engine = create_async_engine(_db_url, **engine_kwargs)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def _apply_sqlite_migrations(sync_conn):
    """Run SQLite-only schema migrations (not needed for PostgreSQL)."""
    result = sync_conn.execute(text("PRAGMA table_info(documents);"))
    columns = [row[1] for row in result.fetchall()]

    if "course_code" not in columns:
        sync_conn.execute(
            text(
                "ALTER TABLE documents ADD COLUMN course_code VARCHAR(255) NOT NULL DEFAULT ''"
            )
        )
        sync_conn.execute(
            text("UPDATE documents SET course_code = course WHERE course_code = ''")
        )

    if "visibility" not in columns:
        sync_conn.execute(
            text(
                "ALTER TABLE documents ADD COLUMN visibility VARCHAR(50) NOT NULL DEFAULT 'public'"
            )
        )


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if _db_url.startswith("sqlite"):
            await conn.run_sync(_apply_sqlite_migrations)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
