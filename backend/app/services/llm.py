"""
LLM service — uses a local Ollama model to generate grounded answers.
Calls http://localhost:11434/api/generate (non-streaming) via httpx.
"""
import httpx

from app.core.config import get_settings

settings = get_settings()

OLLAMA_URL = "http://localhost:11434/api/generate"

SYSTEM_PROMPT = """You are an intelligent academic assistant helping students understand their course materials.
You answer questions based ONLY on the provided context excerpts from the student's uploaded documents.

Guidelines:
- Answer clearly and concisely based on the provided context
- If the context doesn't contain enough information to answer, say so honestly
- Always cite which document and page number your answer comes from
- Use bullet points or numbered lists when explaining multi-step concepts
- Do not make up information not present in the context
- If asked about something outside the provided context, acknowledge the limitation"""


def _build_context_block(chunks: list[dict]) -> str:
    """Format retrieved chunks into a readable context block."""
    lines = []
    for i, chunk in enumerate(chunks, start=1):
        meta = chunk["metadata"]
        lines.append(
            f"[Source {i}] Document: \"{meta['original_filename']}\" | "
            f"Course: {meta['course']} | Page: {meta['page']}"
        )
        lines.append(chunk["text"])
        lines.append("")
    return "\n".join(lines)


def _build_prompt(
    question: str,
    context_block: str,
    conversation_history: list[dict] | None,
) -> str:
    """Build the full prompt string including system instructions, history, and user question."""
    parts = [SYSTEM_PROMPT, ""]

    # Append prior conversation turns as plain text
    if conversation_history:
        for msg in conversation_history[-6:]:  # last 3 turns
            role = "User" if msg["role"] == "user" else "Assistant"
            parts.append(f"{role}: {msg['content']}")
        parts.append("")

    parts.append("Here are relevant excerpts from the course materials:")
    parts.append("")
    parts.append(context_block)
    parts.append("")
    parts.append(f"Based on the above context, please answer this question:")
    parts.append(question)

    return "\n".join(parts)


async def generate_answer(
    question: str,
    chunks: list[dict],
    conversation_history: list[dict] | None = None,
) -> dict:
    """
    Generate an answer using a local Ollama model with RAG context.

    Returns:
        {
            "answer": str,
            "sources": [{"filename": str, "course": str, "page": int, "doc_id": int}]
        }
    """
    context_block = _build_context_block(chunks)
    prompt = _build_prompt(question, context_block, conversation_history)

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            OLLAMA_URL,
            json={
                "model": settings.llm_model,
                "prompt": prompt,
                "stream": False,
            },
        )
        response.raise_for_status()
        answer_text = response.json()["response"]

    # Deduplicate sources
    seen = set()
    sources = []
    for chunk in chunks:
        meta = chunk["metadata"]
        key = (meta["original_filename"], meta["page"])
        if key not in seen:
            seen.add(key)
            sources.append(
                {
                    "filename": meta["original_filename"],
                    "course": meta["course"],
                    "page": meta["page"],
                    "doc_id": meta["doc_id"],
                }
            )

    return {"answer": answer_text, "sources": sources}
