from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

settings = get_settings()

# asyncpg (PostgreSQL) doesn't support check_same_thread; aiosqlite needs no extra args
connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_async_engine(
    settings.database_url,
    echo=False,
    connect_args=connect_args,
)
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
        # Only run SQLite-specific migrations for local dev
        if settings.database_url.startswith("sqlite"):
            await conn.run_sync(_apply_sqlite_migrations)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
