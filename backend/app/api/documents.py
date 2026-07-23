import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status, BackgroundTasks
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.db import crud
from app.db.models import User
from app.models.schemas import DocumentOut, DocumentBrowseOut
from app.services.rag_pipeline import ingest_document, remove_document
from app.services import storage

settings = get_settings()
router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".ppt", ".pptx"}
MAX_FILE_SIZE = 500 * 1024 * 1024  # 500 MB

MIME_TYPES = {
    "pdf":  "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "doc":  "application/msword",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "ppt":  "application/vnd.ms-powerpoint",
    "txt":  "text/plain",
}


@router.post("/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    course: str = Form(...),
    course_code: str = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext}'. Allowed: PDF, DOCX, TXT, PPT, PPTX",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds 500 MB limit",
        )

    safe_filename = f"{uuid.uuid4().hex}{ext}"
    mime = MIME_TYPES.get(ext.lstrip("."), "application/octet-stream")

    # Save to storage (local disk or Supabase)
    storage.upload_file(content, safe_filename, mime)

    # Create DB record
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
        filename=safe_filename,
        doc_id=doc.id,
        original_filename=file.filename,
        course=course.strip(),
        course_code=course_code.strip(),
        user_id=current_user.id,
        ext=ext,
    )

    return doc


async def _run_ingestion(
    filename: str,
    doc_id: int,
    original_filename: str,
    course: str,
    course_code: str,
    user_id: int,
    ext: str,
):
    """Background task: download file to temp, ingest, update chunk count."""
    from app.db.database import AsyncSessionLocal
    from app.db.models import Document
    from sqlalchemy import update

    tmp_path = None
    try:
        # Get local path for ingestion (downloads from Supabase if needed)
        tmp_path = storage.download_to_temp(filename, suffix=ext)

        chunk_count = await ingest_document(
            file_path=tmp_path,
            doc_id=doc_id,
            filename=filename,
            original_filename=original_filename,
            course=course,
            course_code=course_code,
            user_id=user_id,
        )

        async with AsyncSessionLocal() as session:
            await session.execute(
                update(Document)
                .where(Document.id == doc_id)
                .values(chunk_count=chunk_count)
            )
            await session.commit()

    except Exception as e:
        print(f"[Ingestion Error] doc_id={doc_id}: {e}")
        # On failure, remove the stored file
        storage.delete_file(filename)

    finally:
        # Clean up temp file only if it was created by download_to_temp
        # (i.e. Supabase mode — local mode returns the real path, don't delete it)
        if tmp_path and settings.supabase_url and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass


@router.get("/", response_model=list[DocumentOut])
async def list_documents(
    course_code: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List documents owned by the current user."""
    return await crud.get_documents_by_user(
        db, user_id=current_user.id, course_code=course_code
    )


@router.get("/browse", response_model=list[DocumentBrowseOut])
async def browse_documents(
    course_code: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Browse all public documents across all users."""
    return await crud.get_documents_with_uploader(db, course_code=course_code)


@router.get("/courses", response_model=list[str])
async def list_courses(
    shared: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if shared:
        return await crud.get_course_codes(db, user_id=None)
    return await crud.get_course_codes(db, user_id=current_user.id)


@router.get("/{doc_id}/download")
async def download_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = await crud.get_public_document_by_id(db, doc_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if not storage.file_exists(doc.filename):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on server")

    try:
        file_bytes = storage.read_file_bytes(doc.filename)
    except Exception:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Could not retrieve file")

    mime = MIME_TYPES.get(doc.file_type.lower(), "application/octet-stream")
    return Response(
        content=file_bytes,
        media_type=mime,
        headers={"Content-Disposition": f'inline; filename="{doc.original_filename}"'},
    )


@router.post("/{doc_id}/save-to-library", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def save_to_library(
    doc_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Copy a public document into the current user's library and re-ingest it."""
    # Get the source document
    source = await crud.get_public_document_by_id(db, doc_id)
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Don't copy your own document
    if source.user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You already own this document")

    # Check user doesn't already have a copy (same original_filename + course_code)
    existing = await crud.get_documents_by_user(db, user_id=current_user.id, course_code=source.course_code)
    if any(d.original_filename == source.original_filename for d in existing):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You already have this document in your library")

    if not storage.file_exists(source.filename):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source file not found on server")

    # Read source file bytes and store under a new filename for this user
    try:
        file_bytes = storage.read_file_bytes(source.filename)
    except Exception:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not read source file")

    ext = f".{source.file_type}"
    new_filename = f"{uuid.uuid4().hex}{ext}"
    mime = MIME_TYPES.get(source.file_type.lower(), "application/octet-stream")
    storage.upload_file(file_bytes, new_filename, mime)

    # Create DB record for the current user
    doc = await crud.create_document(
        db=db,
        filename=new_filename,
        original_filename=source.original_filename,
        course=source.course,
        course_code=source.course_code,
        file_type=source.file_type,
        chunk_count=0,
        user_id=current_user.id,
    )

    # Re-ingest for the current user's vector store
    background_tasks.add_task(
        _run_ingestion,
        filename=new_filename,
        doc_id=doc.id,
        original_filename=source.original_filename,
        course=source.course,
        course_code=source.course_code,
        user_id=current_user.id,
        ext=ext,
    )

    return doc


@router.delete("/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    doc_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = await crud.get_document_by_id(db, doc_id, current_user.id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    await remove_document(user_id=current_user.id, doc_id=doc_id)
    storage.delete_file(doc.filename)
    await crud.delete_document(db, doc_id, current_user.id)
