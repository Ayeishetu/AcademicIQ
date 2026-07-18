# AcademicIQ — AI Study Assistant

A full-stack AI-powered platform for students to upload lecture notes and past exam questions, then ask intelligent questions answered via RAG (Retrieval-Augmented Generation).

> **Note:** Answer generation uses the Anthropic API (Claude Sonnet). An internet connection and a valid `ANTHROPIC_API_KEY` are required for chat. Embeddings and vector search remain fully local.

## Tech Stack

- **Frontend**: React 18 + Tailwind CSS + Vite
- **Backend**: Python FastAPI (async)
- **Vector DB**: ChromaDB (local)
- **Embeddings**: `all-MiniLM-L6-v2` via sentence-transformers (local, no API key)
- **LLM**: Anthropic API — `claude-sonnet-4-5` (requires `ANTHROPIC_API_KEY`)
- **File Parsing**: PyMuPDF (PDF), python-docx (DOCX), plain text (TXT)
- **Auth**: JWT-based auth (HS256, 7-day tokens)
- **Password policy**: account passwords are limited to 8 characters

## Project Structure

```
academic-rag/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI route handlers
│   │   ├── core/         # Config, security, dependencies
│   │   ├── models/       # Pydantic models
│   │   ├── services/     # RAG pipeline, document processing
│   │   └── db/           # Database (SQLite for users)
│   ├── chroma_db/        # ChromaDB persistent storage
│   ├── uploads/          # Temporary file uploads
│   ├── requirements.txt
│   └── main.py
└── frontend/
    ├── src/
    │   ├── components/
    │   ├── pages/
    │   ├── hooks/
    │   ├── services/
    │   └── store/
    ├── package.json
    └── vite.config.js
```

## Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Copy and fill in your API keys
cp .env.example .env

python main.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Environment Variables

```
SECRET_KEY=your_jwt_secret
ACCESS_TOKEN_EXPIRE_MINUTES=10080
PASSWORD_MAX_LENGTH=8
DATABASE_URL=sqlite+aiosqlite:///./academic_rag.db
CHROMA_PERSIST_DIR=./chroma_db
UPLOAD_DIR=./uploads
ANTHROPIC_API_KEY=your_anthropic_api_key
```

## Features

- Upload PDF, DOCX, TXT files tagged by course
- Semantic search over uploaded documents
- Chat-style Q&A with source citations (document + page)
- Per-student document isolation via JWT auth
- Course-based filtering for queries
