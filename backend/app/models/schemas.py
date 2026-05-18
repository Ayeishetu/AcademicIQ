from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator


# ── Auth ───────────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    email: EmailStr
    full_name: str
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
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
    file_type: str
    chunk_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Chat / RAG ────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class QueryRequest(BaseModel):
    question: str
    course: Optional[str] = None
    conversation_history: Optional[list[ChatMessage]] = None


class SourceReference(BaseModel):
    filename: str
    course: str
    page: int
    doc_id: int


class QueryResponse(BaseModel):
    answer: str
    sources: list[SourceReference]
    chunks_used: int
