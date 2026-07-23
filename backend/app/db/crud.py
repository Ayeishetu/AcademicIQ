from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.db.models import User, Document, SharedChat, ChatSession, ChatMessage
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
    course_code: str,
    file_type: str,
    chunk_count: int,
    user_id: int,
    visibility: str = "public",
) -> Document:
    doc = Document(
        filename=filename,
        original_filename=original_filename,
        course=course,
        course_code=course_code,
        file_type=file_type,
        visibility=visibility,
        chunk_count=chunk_count,
        user_id=user_id,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc


async def get_documents_by_user(
    db: AsyncSession,
    user_id: int,
    course: Optional[str] = None,
    course_code: Optional[str] = None,
) -> list[Document]:
    query = select(Document).where(Document.user_id == user_id)
    if course:
        query = query.where(Document.course == course)
    if course_code:
        course_code = course_code.strip()
        if course_code:
            query = query.where(Document.course_code == course_code)
    query = query.order_by(Document.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_documents(
    db: AsyncSession, course_code: Optional[str] = None
) -> list[Document]:
    query = select(Document).where(Document.visibility == "public")
    if course_code:
        query = query.where(Document.course_code == course_code)
    query = query.order_by(Document.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def document_exists_in_course(
    db: AsyncSession, original_filename: str, course_code: str
) -> bool:
    """Check if a public document with the same filename + course_code already exists from any user."""
    result = await db.execute(
        select(Document).where(
            Document.original_filename == original_filename,
            Document.course_code == course_code.strip(),
            Document.visibility == "public",
        )
    )
    return result.scalar_one_or_none() is not None


async def get_documents_with_uploader(
    db: AsyncSession, course_code: Optional[str] = None
) -> list[dict]:
    """Return all public documents joined with the uploader's full_name."""
    query = (
        select(
            Document.id,
            Document.original_filename,
            Document.course,
            Document.course_code,
            Document.file_type,
            Document.chunk_count,
            Document.user_id,
            Document.created_at,
            User.full_name.label("uploaded_by"),
        )
        .join(User, Document.user_id == User.id)
        .where(Document.visibility == "public")
    )
    if course_code:
        query = query.where(Document.course_code == course_code.strip())
    query = query.order_by(Document.course_code.asc(), Document.created_at.desc())
    result = await db.execute(query)
    return [row._asdict() for row in result.all()]


async def get_public_document_by_id(db: AsyncSession, doc_id: int) -> Optional[Document]:
    result = await db.execute(
        select(Document).where(Document.id == doc_id, Document.visibility == "public")
    )
    return result.scalar_one_or_none()


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


async def delete_any_document(db: AsyncSession, doc_id: int) -> bool:
    """Admin: delete a document regardless of owner."""
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(Document).where(Document.id == doc_id))
    doc = result.scalar_one_or_none()
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


async def get_course_codes(db: AsyncSession, user_id: Optional[int] = None) -> list[str]:
    query = select(Document.course_code).distinct()
    if user_id is not None:
        query = query.where(Document.user_id == user_id)
    else:
        query = query.where(Document.visibility == "public")
    query = query.where(Document.course_code != "")
    result = await db.execute(query)
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


# ── Chat Session CRUD ─────────────────────────────────────────────────────────

async def create_chat_session(db: AsyncSession, user_id: int, title: str = "New Chat") -> ChatSession:
    session = ChatSession(user_id=user_id, title=title)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def get_chat_sessions_by_user(db: AsyncSession, user_id: int) -> list[ChatSession]:
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == user_id)
        .order_by(ChatSession.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_chat_session_by_id(
    db: AsyncSession, session_id: int, user_id: int
) -> Optional[ChatSession]:
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id,
            ChatSession.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def update_chat_session_title(
    db: AsyncSession, session_id: int, title: str
) -> None:
    from datetime import datetime, timezone
    await db.execute(
        update(ChatSession)
        .where(ChatSession.id == session_id)
        .values(title=title, updated_at=datetime.now(timezone.utc))
    )
    await db.commit()


async def touch_chat_session(db: AsyncSession, session_id: int) -> None:
    """Bump updated_at so the session floats to the top of the list."""
    from datetime import datetime, timezone
    await db.execute(
        update(ChatSession)
        .where(ChatSession.id == session_id)
        .values(updated_at=datetime.now(timezone.utc))
    )
    await db.commit()


async def delete_chat_session(db: AsyncSession, session_id: int, user_id: int) -> bool:
    session = await get_chat_session_by_id(db, session_id, user_id)
    if not session:
        return False
    await db.delete(session)
    await db.commit()
    return True


# ── Chat Message CRUD ─────────────────────────────────────────────────────────

async def add_chat_message(
    db: AsyncSession,
    session_id: int,
    role: str,
    content: str,
    sources: str = "[]",
) -> ChatMessage:
    msg = ChatMessage(session_id=session_id, role=role, content=content, sources=sources)
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


async def get_messages_by_session(
    db: AsyncSession, session_id: int
) -> list[ChatMessage]:
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    )
    return list(result.scalars().all())
