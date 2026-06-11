import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.db.models import User
from app.db import crud
from app.models.schemas import ShareChatRequest, SharedChatOut, SharedMessage

router = APIRouter(prefix="/share", tags=["share"])


@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_share(
    payload: ShareChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save a chat conversation and return a shareable token."""
    if not payload.messages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No messages to share",
        )

    messages_json = json.dumps([m.model_dump() for m in payload.messages])

    chat = await crud.create_shared_chat(
        db=db,
        title=payload.title or "Shared Chat",
        messages_json=messages_json,
        user_id=current_user.id,
    )

    return {"token": chat.token}


@router.get("/{token}", response_model=SharedChatOut)
async def get_share(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Public endpoint — retrieve a shared chat by token. No auth required."""
    chat = await crud.get_shared_chat_by_token(db, token)
    if not chat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Shared chat not found or link has expired",
        )

    messages = [SharedMessage(**m) for m in json.loads(chat.messages_json)]

    return SharedChatOut(
        token=chat.token,
        title=chat.title,
        messages=messages,
        shared_by=chat.owner.full_name,
        created_at=chat.created_at,
    )
