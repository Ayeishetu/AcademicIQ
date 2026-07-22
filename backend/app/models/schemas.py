from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator

from app.core.config import get_settings


# ── Auth ───────────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    email: EmailStr
    full_name: str
    password: str

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str) -> str:
        max_length = get_settings().password_max_length
        if len(v) > max_length:
            raise ValueError(f"Password must be up to {max_length} characters")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ── Documents ─────────────────────────────────────────────────────────────────

class DocumentOut(BaseModel):
    id: int
    original_filename: str
    course: str
    course_code: str
    file_type: str
    chunk_count: int
    user_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Chat / RAG ────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class QueryRequest(BaseModel):
    question: str
    course_code: Optional[str] = None
    conversation_history: Optional[list[ChatMessage]] = None
    session_id: Optional[int] = None


class SourceReference(BaseModel):
    filename: str
    course: str
    course_code: str
    page: int
    doc_id: int


class QueryResponse(BaseModel):
    answer: str
    sources: list[SourceReference]
    chunks_used: int
    session_id: int


# ── Chat Sessions ─────────────────────────────────────────────────────────────

class ChatSessionOut(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChatMessageOut(BaseModel):
    id: int
    role: str
    content: str
    sources: list[SourceReference]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Shared Chat ───────────────────────────────────────────────────────────────

class SharedMessageSource(BaseModel):
    filename: str
    course: str
    course_code: str
    page: int
    doc_id: int


class SharedMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str
    sources: list[SharedMessageSource] = []


class ShareChatRequest(BaseModel):
    title: str
    messages: list[SharedMessage]


class SharedChatOut(BaseModel):
    token: str
    title: str
    messages: list[SharedMessage]
    shared_by: str  # full_name of owner
    created_at: datetime
