# Academic Resource Sharing & Intelligent QA System

A full-stack AI-powered platform for students to upload lecture notes and past exam questions, then ask intelligent questions answered via RAG (Retrieval-Augmented Generation).

## Tech Stack

- **Frontend**: React + Tailwind CSS + Vite
- **Backend**: Python FastAPI
- **Vector DB**: ChromaDB (local)
- **Embeddings**: OpenAI `text-embedding-3-small`
- **LLM**: Claude `claude-sonnet-4-20250514`
- **File Parsing**: PyMuPDF (PDF), python-docx (DOCX)
- **Auth**: JWT-based simple auth

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
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
SECRET_KEY=your_jwt_secret
```

## Features

- Upload PDF, DOCX, TXT files tagged by course
- Semantic search over uploaded documents
- Chat-style Q&A with source citations (document + page)
- Per-student document isolation via JWT auth
- Course-based filtering for queries
