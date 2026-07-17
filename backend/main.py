import os
import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure all ORM models are registered on Base.metadata before init_db runs
import app.db.models  # noqa: F401

from app.db.database import init_db
from app.api import auth, documents, chat, share
from app.core.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("🚀 Starting up...")
    try:
        os.makedirs(settings.upload_dir, exist_ok=True)
        os.makedirs(settings.chroma_persist_dir, exist_ok=True)
        print(f"📁 Directories ready: {settings.upload_dir}, {settings.chroma_persist_dir}")
    except Exception as e:
        print(f"⚠️  Directory creation warning: {e}")

    # Database initialisation
    try:
        await init_db()
        print("✅ Database initialized")
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        traceback.print_exc()
        raise

    # NOTE: embedding model loads lazily on first use to stay within
    # the 512 MB RAM limit on Render's free tier.
    print("✅ Startup complete")

    yield
    # Shutdown (nothing to clean up)


app = FastAPI(
    title="Academic RAG API",
    description="AI-powered Academic Resource Sharing & Intelligent QA System",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow the Vercel frontend origin (set via FRONTEND_URL env var)
# plus localhost origins for local development.
_frontend_url = settings.frontend_url.rstrip("/")  # strip accidental trailing slash
_allowed_origins = list({
    _frontend_url,
    "http://localhost:5173",
    "http://localhost:3000",
})

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(share.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    import os
    port_str = os.environ.get("PORT", "8000")
    try:
        port = int(port_str)
    except (ValueError, TypeError):
        port = 8000
    print(f"Starting server on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
