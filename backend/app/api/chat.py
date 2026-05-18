from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.db.models import User
from app.models.schemas import QueryRequest, QueryResponse, SourceReference
from app.services.rag_pipeline import query_rag

router = APIRouter(prefix="/chat", tags=["chat"])


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

    # Convert conversation history to dict format for LLM
    history = None
    if payload.conversation_history:
        history = [
            {"role": msg.role, "content": msg.content}
            for msg in payload.conversation_history
        ]

    result = await query_rag(
        question=payload.question,
        user_id=current_user.id,
        course=payload.course,
        conversation_history=history,
    )

    sources = [SourceReference(**s) for s in result["sources"]]

    return QueryResponse(
        answer=result["answer"],
        sources=sources,
        chunks_used=result["chunks_used"],
    )
