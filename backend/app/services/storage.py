"""
File storage abstraction.

- Local dev  (SUPABASE_URL not set): read/write files from local disk (upload_dir)
- Production (SUPABASE_URL set):     read/write files via Supabase Storage
"""
import os
import tempfile
from pathlib import Path

from app.core.config import get_settings

settings = get_settings()


def _use_supabase() -> bool:
    return bool(settings.supabase_url and settings.supabase_service_key)


def _get_client():
    from supabase import create_client
    return create_client(settings.supabase_url, settings.supabase_service_key)


# ── Upload ─────────────────────────────────────────────────────────────────────

def upload_file(content: bytes, filename: str, mime_type: str = "application/octet-stream") -> str:
    """
    Save file bytes and return the storage path/key (same as filename).
    Local: writes to upload_dir/{filename}
    Supabase: uploads to bucket/{filename}
    """
    if _use_supabase():
        client = _get_client()
        client.storage.from_(settings.supabase_bucket).upload(
            path=filename,
            file=content,
            file_options={"content-type": mime_type, "upsert": "true"},
        )
    else:
        os.makedirs(settings.upload_dir, exist_ok=True)
        file_path = os.path.join(settings.upload_dir, filename)
        with open(file_path, "wb") as f:
            f.write(content)

    return filename  # key stored in DB


# ── Download to temp file ──────────────────────────────────────────────────────

def download_to_temp(filename: str, suffix: str = "") -> str:
    """
    Download the file to a local temp path and return that path.
    Caller is responsible for deleting the temp file.
    """
    if _use_supabase():
        client = _get_client()
        data: bytes = client.storage.from_(settings.supabase_bucket).download(filename)
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        tmp.write(data)
        tmp.flush()
        tmp.close()
        return tmp.name
    else:
        return os.path.join(settings.upload_dir, filename)


# ── Read bytes (for serving downloads) ────────────────────────────────────────

def read_file_bytes(filename: str) -> bytes:
    """Return raw bytes for a stored file."""
    if _use_supabase():
        client = _get_client()
        return client.storage.from_(settings.supabase_bucket).download(filename)
    else:
        file_path = os.path.join(settings.upload_dir, filename)
        with open(file_path, "rb") as f:
            return f.read()


def file_exists(filename: str) -> bool:
    """Check whether a file exists in storage."""
    if _use_supabase():
        try:
            # list() with search prefix; if result is non-empty the file exists
            client = _get_client()
            results = client.storage.from_(settings.supabase_bucket).list(
                path="", options={"search": filename, "limit": 1}
            )
            return any(r.get("name") == filename for r in (results or []))
        except Exception:
            return False
    else:
        return os.path.exists(os.path.join(settings.upload_dir, filename))


# ── Delete ─────────────────────────────────────────────────────────────────────

def delete_file(filename: str) -> None:
    """Delete a file from storage. Silently ignores missing files."""
    if _use_supabase():
        try:
            client = _get_client()
            client.storage.from_(settings.supabase_bucket).remove([filename])
        except Exception:
            pass
    else:
        file_path = os.path.join(settings.upload_dir, filename)
        try:
            os.remove(file_path)
        except OSError:
            pass
