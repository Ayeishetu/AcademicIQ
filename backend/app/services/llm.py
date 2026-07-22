"""
LLM service — uses the Anthropic Messages API (Claude) to generate grounded answers.

Previous provider: Ollama/gemma3 at http://localhost:11434 (local, non-streaming).
To roll back, see git history or the commented-out config in app/core/config.py.
"""
import anthropic

from app.core.config import get_settings

settings = get_settings()

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


def _build_user_message(
    question: str,
    context_block: str,
    conversation_history: list[dict] | None,
) -> str:
    """
    Build the user-turn content: prior conversation turns (plain text) +
    retrieved context + question.
    The system instructions are passed separately to client.messages.create().
    """
    parts = []

    # Append prior conversation turns as plain text (last 3 turns = 6 messages)
    if conversation_history:
        for msg in conversation_history[-6:]:
            role = "User" if msg["role"] == "user" else "Assistant"
            parts.append(f"{role}: {msg['content']}")
        parts.append("")

    parts.append("Here are relevant excerpts from the course materials:")
    parts.append("")
    parts.append(context_block)
    parts.append("")
    parts.append("Based on the above context, please answer this question:")
    parts.append(question)

    return "\n".join(parts)


async def generate_answer(
    question: str,
    chunks: list[dict],
    conversation_history: list[dict] | None = None,
) -> dict:
    """
    Generate an answer using the Anthropic Messages API with RAG context.

    Returns:
        {
            "answer": str,
            "sources": [{"filename": str, "course": str, "page": int, "doc_id": int}]
        }
    """
    context_block = _build_context_block(chunks)
    user_content = _build_user_message(question, context_block, conversation_history)

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    response = await client.messages.create(
        model=settings.anthropic_model,
        max_tokens=settings.anthropic_max_tokens,
        system=SYSTEM_PROMPT,
        messages=[
            {"role": "user", "content": user_content},
        ],
    )

    answer_text = response.content[0].text

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
                    "course": meta.get("course", ""),
                    "course_code": meta.get("course_code", ""),
                    "page": meta["page"],
                    "doc_id": meta["doc_id"],
                }
            )

    return {"answer": answer_text, "sources": sources}
