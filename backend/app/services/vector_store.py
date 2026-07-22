"""
ChromaDB vector store — one collection per user.
Uses chromadb 1.x API.
Metadata stored per chunk: filename, original_filename, course, page, chunk_index, doc_id.
"""
from typing import Optional

import chromadb

from app.core.config import get_settings

settings = get_settings()

_chroma_client = None


def get_chroma_client():
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(path=settings.chroma_persist_dir)
    return _chroma_client


def _collection_name(user_id: int) -> str:
    return f"user_{user_id}"


def get_or_create_collection(user_id: int):
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=_collection_name(user_id),
        metadata={"hnsw:space": "cosine"},
    )


def add_chunks(
    user_id: int,
    doc_id: int,
    filename: str,
    original_filename: str,
    course: str,
    course_code: str,
    chunks: list[dict],
    embeddings: list[list[float]],
) -> None:
    """Store chunks + embeddings in ChromaDB."""
    collection = get_or_create_collection(user_id)

    ids = [f"doc{doc_id}_chunk{c['chunk_index']}" for c in chunks]
    documents = [c["text"] for c in chunks]
    metadatas = [
        {
            "doc_id": doc_id,
            "filename": filename,
            "original_filename": original_filename,
            "course": course,
            "course_code": course_code,
            "page": c["page"],
            "chunk_index": c["chunk_index"],
            "token_count": c["token_count"],
        }
        for c in chunks
    ]

    collection.add(
        ids=ids,
        embeddings=embeddings,
        documents=documents,
        metadatas=metadatas,
    )


def query_chunks(
    user_id: int,
    query_embedding: list[float],
    top_k: int = None,
    course_code: Optional[str] = None,
) -> list[dict]:
    """
    Retrieve top-k most similar chunks for a user.
    Optionally filter by course code.
    """
    top_k = top_k or settings.top_k_results
    collection = get_or_create_collection(user_id)

    count = collection.count()
    if count == 0:
        return []

    actual_k = min(top_k, count)

    where = {"course_code": {"$eq": course_code}} if course_code else None

    kwargs: dict = dict(
        query_embeddings=[query_embedding],
        n_results=actual_k,
        include=["documents", "metadatas", "distances"],
    )
    if where:
        kwargs["where"] = where

    results = collection.query(**kwargs)

    chunks = []
    if results["ids"] and results["ids"][0]:
        for i, chunk_id in enumerate(results["ids"][0]):
            chunks.append(
                {
                    "id": chunk_id,
                    "text": results["documents"][0][i],
                    "metadata": results["metadatas"][0][i],
                    "distance": results["distances"][0][i],
                }
            )
    return chunks


def delete_document_chunks(user_id: int, doc_id: int) -> None:
    """Remove all chunks belonging to a document."""
    collection = get_or_create_collection(user_id)
    results = collection.get(where={"doc_id": {"$eq": doc_id}})
    if results["ids"]:
        collection.delete(ids=results["ids"])
