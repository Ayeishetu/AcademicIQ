import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.db import crud
from app.db.models import User
from app.models.schemas import DocumentOut
from app.services.rag_pipeline import ingest_document, remove_document

settings = get_settings()
router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500 MB


@router.post("/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    course: str = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Validate extension
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext}'. Allowed: PDF, DOCX, TXT",
        )

    # Read file content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 50 MB limit",
        )

    # Save to disk
    os.makedirs(settings.upload_dir, exist_ok=True)
    safe_filename = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(settings.upload_dir, safe_filename)
    with open(file_path, "wb") as f:
        f.write(content)

    # Create DB record (chunk_count=0 initially, updated after ingestion)
    doc = await crud.create_document(
        db=db,
        filename=safe_filename,
        original_filename=file.filename,
        course=course.strip(),
        file_type=ext.lstrip("."),
        chunk_count=0,
        user_id=current_user.id,
    )

    # Run ingestion in background
    background_tasks.add_task(
        _run_ingestion,
        file_path=file_path,
        doc_id=doc.id,
        filename=safe_filename,
        original_filename=file.filename,
        course=course.strip(),
        user_id=current_user.id,
        db_url=settings.database_url,
    )

    return doc


async def _run_ingestion(
    file_path: str,
    doc_id: int,
    filename: str,
    original_filename: str,
    course: str,
    user_id: int,
    db_url: str,
):
    """Background task: ingest document and update chunk count."""
    from app.db.database import AsyncSessionLocal
    from app.db.models import Document
    from sqlalchemy import update

    try:
        chunk_count = await ingest_document(
            file_path=file_path,
            doc_id=doc_id,
            filename=filename,
            original_filename=original_filename,
            course=course,
            user_id=user_id,
        )
        # Update chunk count in DB
        async with AsyncSessionLocal() as session:
            await session.execute(
                update(Document)
                .where(Document.id == doc_id)
                .values(chunk_count=chunk_count)
            )
            await session.commit()
    except Exception as e:
        print(f"[Ingestion Error] doc_id={doc_id}: {e}")
    finally:
        # Clean up temp file
        try:
            os.remove(file_path)
        except OSError:
            pass


@router.get("/", response_model=list[DocumentOut])
async def list_documents(
    course: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    docs = await crud.get_documents_by_user(db, current_user.id, course=course)
    return docs


@router.get("/courses", response_model=list[str])
async def list_courses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await crud.get_courses_by_user(db, current_user.id)


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = await crud.get_document_by_id(db, doc_id, current_user.id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Remove from vector store
    await remove_document(user_id=current_user.id, doc_id=doc_id)

    # Remove from DB
    await crud.delete_document(db, doc_id, current_user.id)
