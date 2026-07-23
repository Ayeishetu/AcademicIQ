import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.db import crud
from app.db.models import User
from app.models.schemas import DocumentOut, DocumentBrowseOut
from app.services.rag_pipeline import ingest_document, remove_document

settings = get_settings()
router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".ppt", ".pptx"}
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500 MB


@router.post("/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    course: str = Form(...),
    course_code: str = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Validate extension
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext}'. Allowed: PDF, DOCX, TXT, PPT, PPTX",
        )

    # Read file content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 500 MB limit",
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
        course_code=course_code.strip(),
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
        course_code=course_code.strip(),
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
    course_code: str,
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
            course_code=course_code,
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
        # On ingestion failure, clean up the file since it won't be accessible
        try:
            os.remove(file_path)
        except OSError:
            pass


@router.get("/", response_model=list[DocumentOut])
async def list_documents(
    course_code: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List documents owned by the current user."""
    docs = await crud.get_documents_by_user(
        db, user_id=current_user.id, course_code=course_code
    )
    return docs


@router.get("/browse", response_model=list[DocumentBrowseOut])
async def browse_documents(
    course_code: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),  # auth required but not user-scoped
):
    """Browse all public documents across all users, optionally filtered by course_code."""
    return await crud.get_documents_with_uploader(db, course_code=course_code)


@router.get("/courses", response_model=list[str])
async def list_courses(
    shared: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List course codes.
    - shared=false (default): only the current user's courses (for the personal documents tab)
    - shared=true: all public courses across all users (for the browse tab)
    """
    if shared:
        return await crud.get_course_codes(db, user_id=None)
    return await crud.get_course_codes(db, user_id=current_user.id)


MIME_TYPES = {
    "pdf":  "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "doc":  "application/msword",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "ppt":  "application/vnd.ms-powerpoint",
    "txt":  "text/plain",
}

@router.get("/{doc_id}/download")
async def download_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = await crud.get_public_document_by_id(db, doc_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    file_path = os.path.join(settings.upload_dir, doc.filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on server")

    mime = MIME_TYPES.get(doc.file_type.lower(), "application/octet-stream")
    return FileResponse(file_path, filename=doc.original_filename, media_type=mime)


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

    # Remove file from disk
    file_path = os.path.join(settings.upload_dir, doc.filename)
    try:
        os.remove(file_path)
    except OSError:
        pass

    # Remove from DB
    await crud.delete_document(db, doc_id, current_user.id)
