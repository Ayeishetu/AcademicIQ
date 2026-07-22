from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

settings = get_settings()

engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def _apply_document_migrations(sync_conn):
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
        await conn.run_sync(_apply_document_migrations)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
