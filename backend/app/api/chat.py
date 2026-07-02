import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.db.models import User
from app.db import crud
from app.models.schemas import (
    QueryRequest,
    QueryResponse,
    SourceReference,
    ChatSessionOut,
    ChatMessageOut,
)
from app.services.rag_pipeline import query_rag

router = APIRouter(prefix="/chat", tags=["chat"])


# ── Sessions ──────────────────────────────────────────────────────────────────

@router.get("/sessions", response_model=list[ChatSessionOut])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all chat sessions for the current user, newest first."""
    return await crud.get_chat_sessions_by_user(db, current_user.id)


@router.get("/sessions/{session_id}", response_model=list[ChatMessageOut])
async def get_session_messages(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all messages for a session (must belong to current user)."""
    session = await crud.get_chat_session_by_id(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    messages = await crud.get_messages_by_session(db, session_id)

    # Deserialize sources JSON for each message
    result = []
    for msg in messages:
        sources_raw = json.loads(msg.sources) if msg.sources else []
        sources = [SourceReference(**s) for s in sources_raw]
        result.append(
            ChatMessageOut(
                id=msg.id,
                role=msg.role,
                content=msg.content,
                sources=sources,
                created_at=msg.created_at,
            )
        )
    return result


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a session and all its messages."""
    deleted = await crud.delete_chat_session(db, session_id, current_user.id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")


# ── Query ─────────────────────────────────────────────────────────────────────

@router.post("/query", response_model=QueryResponse)
async def query(
    payload: QueryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not payload.question.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty",
        )

    # Resolve or create session
    if payload.session_id:
        session = await crud.get_chat_session_by_id(db, payload.session_id, current_user.id)
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
        session_id = session.id
    else:
        # Auto-create a new session titled from the first question
        title = (
            payload.question[:80] + "…"
            if len(payload.question) > 80
            else payload.question
        )
        new_session = await crud.create_chat_session(db, current_user.id, title=title)
        session_id = new_session.id

    # Save the user message
    await crud.add_chat_message(
        db, session_id=session_id, role="user", content=payload.question
    )

    # Build conversation history for LLM
    history = None
    if payload.conversation_history:
        history = [
            {"role": msg.role, "content": msg.content}
            for msg in payload.conversation_history
        ]

    # Run RAG pipeline
    result = await query_rag(
        question=payload.question,
        user_id=current_user.id,
        course=payload.course,
        conversation_history=history,
    )

    sources = [SourceReference(**s) for s in result["sources"]]

    # Save the assistant message (sources as JSON)
    await crud.add_chat_message(
        db,
        session_id=session_id,
        role="assistant",
        content=result["answer"],
        sources=json.dumps([s.model_dump() for s in sources]),
    )

    # Bump updated_at so session floats to top of list
    await crud.touch_chat_session(db, session_id)

    return QueryResponse(
        answer=result["answer"],
        sources=sources,
        chunks_used=result["chunks_used"],
        session_id=session_id,
    )
