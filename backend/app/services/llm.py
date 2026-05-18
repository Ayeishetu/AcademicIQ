"""
LLM service — uses Anthropic Claude to generate grounded answers.
"""
import anthropic

from app.core.config import get_settings

settings = get_settings()

_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


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


async def generate_answer(
    question: str,
    chunks: list[dict],
    conversation_history: list[dict] | None = None,
) -> dict:
    """
    Generate an answer using Claude with RAG context.

    Returns:
        {
            "answer": str,
            "sources": [{"filename": str, "course": str, "page": int}]
        }
    """
    client = _get_client()
    context_block = _build_context_block(chunks)

    user_message = f"""Here are relevant excerpts from the course materials:

{context_block}

Based on the above context, please answer this question:
{question}"""

    messages = []
    # Include conversation history if provided (for multi-turn chat)
    if conversation_history:
        messages.extend(conversation_history[-6:])  # last 3 turns
    messages.append({"role": "user", "content": user_message})

    response = await client.messages.create(
        model=settings.llm_model,
        max_tokens=1500,
        system=SYSTEM_PROMPT,
        messages=messages,
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
                    "course": meta["course"],
                    "page": meta["page"],
                    "doc_id": meta["doc_id"],
                }
            )

    return {"answer": answer_text, "sources": sources}
