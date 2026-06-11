from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.models import User, Document, SharedChat
from app.core.security import hash_password


# ── User CRUD ──────────────────────────────────────────────────────────────────

async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: int) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, email: str, full_name: str, password: str) -> User:
    user = User(
        email=email,
        full_name=full_name,
        hashed_password=hash_password(password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


# ── Document CRUD ──────────────────────────────────────────────────────────────

async def create_document(
    db: AsyncSession,
    filename: str,
    original_filename: str,
    course: str,
    file_type: str,
    chunk_count: int,
    user_id: int,
) -> Document:
    doc = Document(
        filename=filename,
        original_filename=original_filename,
        course=course,
        file_type=file_type,
        chunk_count=chunk_count,
        user_id=user_id,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc


async def get_documents_by_user(
    db: AsyncSession, user_id: int, course: Optional[str] = None
) -> list[Document]:
    query = select(Document).where(Document.user_id == user_id)
    if course:
        query = query.where(Document.course == course)
    query = query.order_by(Document.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_document_by_id(db: AsyncSession, doc_id: int, user_id: int) -> Optional[Document]:
    result = await db.execute(
        select(Document).where(Document.id == doc_id, Document.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def delete_document(db: AsyncSession, doc_id: int, user_id: int) -> bool:
    doc = await get_document_by_id(db, doc_id, user_id)
    if not doc:
        return False
    await db.delete(doc)
    await db.commit()
    return True


async def get_courses_by_user(db: AsyncSession, user_id: int) -> list[str]:
    result = await db.execute(
        select(Document.course).where(Document.user_id == user_id).distinct()
    )
    return [row[0] for row in result.all()]


# ── Shared Chat CRUD ───────────────────────────────────────────────────────────

async def create_shared_chat(
    db: AsyncSession, title: str, messages_json: str, user_id: int
) -> SharedChat:
    chat = SharedChat(
        title=title,
        messages_json=messages_json,
        user_id=user_id,
    )
    db.add(chat)
    await db.commit()
    await db.refresh(chat)
    return chat


async def get_shared_chat_by_token(db: AsyncSession, token: str) -> Optional[SharedChat]:
    result = await db.execute(
        select(SharedChat).where(SharedChat.token == token)
    )
    return result.scalar_one_or_none()
