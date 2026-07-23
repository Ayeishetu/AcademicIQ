"""
RAG Pipeline orchestrator.
Ties together: parse → chunk → embed → store  (ingestion)
               embed query → retrieve → generate  (query)
"""
import os
import re

from app.core.config import get_settings
from app.services.document_parser import parse_document
from app.services.chunker import chunk_pages
from app.services.embeddings import embed_texts, embed_query
from app.services.vector_store import add_chunks, query_chunks, delete_document_chunks
from app.services.llm import generate_answer

settings = get_settings()

# Keywords that suggest a broad, multi-document summary request
_SUMMARY_PATTERN = re.compile(
    r"\b(summar\w+|overview|all lectures?|lectures? \d|outline|recap|review all|"
    r"cover|everything|all topics|whole course|entire course|notes)\b",
    re.IGNORECASE,
)


def _is_summary_query(question: str) -> bool:
    return bool(_SUMMARY_PATTERN.search(question))


async def ingest_document(
    file_path: str,
    doc_id: int,
    filename: str,
    original_filename: str,
    course: str,
    course_code: str,
    user_id: int,
) -> int:
    """
    Full ingestion pipeline for a single document.
    Returns the number of chunks created.
    """
    # 1. Parse document into pages
    pages = parse_document(file_path)

    # 2. Chunk pages into token-sized pieces
    chunks = chunk_pages(pages)

    if not chunks:
        return 0

    # 3. Embed all chunks
    texts = [c["text"] for c in chunks]
    embeddings = await embed_texts(texts)

    # 4. Store in ChromaDB
    add_chunks(
        user_id=user_id,
        doc_id=doc_id,
        filename=filename,
        original_filename=original_filename,
        course=course,
        course_code=course_code,
        chunks=chunks,
        embeddings=embeddings,
    )

    return len(chunks)


async def query_rag(
    question: str,
    user_id: int,
    course_code: str | None = None,
    conversation_history: list[dict] | None = None,
    top_k: int | None = None,
) -> dict:
    """
    Full RAG query pipeline.
    Returns {"answer": str, "sources": [...], "chunks_used": int}
    """
    # 1. Embed the question
    query_embedding = await embed_query(question)

    # 2. Decide how many chunks to fetch
    #    For summary/overview queries, fetch more to get broad coverage
    is_summary = _is_summary_query(question)
    k = top_k or (settings.top_k_summary if is_summary else settings.top_k_results)

    # 3. Retrieve top-k relevant chunks
    chunks = query_chunks(
        user_id=user_id,
        query_embedding=query_embedding,
        top_k=k,
        course_code=course_code,
    )

    # 4. For summary queries, ensure we have representation from each document.
    #    If all retrieved chunks are from the same doc, do a per-doc retrieval pass.
    if is_summary and chunks:
        doc_ids_retrieved = {c["metadata"]["doc_id"] for c in chunks}
        all_doc_chunks = query_chunks(
            user_id=user_id,
            query_embedding=query_embedding,
            top_k=settings.top_k_summary,
            course_code=course_code,
        )
        # Group by doc_id and take up to 3 chunks per doc
        by_doc: dict[int, list] = {}
        for c in all_doc_chunks:
            did = c["metadata"]["doc_id"]
            if len(by_doc.get(did, [])) < 3:
                by_doc.setdefault(did, []).append(c)

        # Flatten: sort docs by doc_id (i.e. lecture order) and interleave chunks
        diverse_chunks = []
        for did in sorted(by_doc.keys()):
            diverse_chunks.extend(by_doc[did])

        if len(diverse_chunks) > len(chunks):
            chunks = diverse_chunks

    if not chunks:
        return {
            "answer": "I couldn't find any relevant information in your uploaded documents. "
                      "Please make sure you've uploaded course materials related to your question.",
            "sources": [],
            "chunks_used": 0,
        }

    # 5. Generate answer with LLM
    result = await generate_answer(
        question=question,
        chunks=chunks,
        conversation_history=conversation_history,
    )

    result["chunks_used"] = len(chunks)
    return result


async def remove_document(user_id: int, doc_id: int) -> None:
    """Remove all vector data for a document."""
    delete_document_chunks(user_id=user_id, doc_id=doc_id)
