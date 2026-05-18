"""
Split document pages into overlapping token-based chunks.
"""
import tiktoken

from app.core.config import get_settings

settings = get_settings()

# Use cl100k_base tokenizer (works for both OpenAI and Anthropic models)
_tokenizer = tiktoken.get_encoding("cl100k_base")


def chunk_pages(
    pages: list[dict],
    chunk_size: int = None,
    chunk_overlap: int = None,
) -> list[dict]:
    """
    Takes parsed pages [{"page": int, "text": str}] and returns chunks:
    [{"chunk_index": int, "page": int, "text": str, "token_count": int}]
    """
    chunk_size = chunk_size or settings.chunk_size
    chunk_overlap = chunk_overlap or settings.chunk_overlap

    chunks = []
    chunk_index = 0

    for page_data in pages:
        page_num = page_data["page"]
        text = page_data["text"]

        tokens = _tokenizer.encode(text)
        start = 0

        while start < len(tokens):
            end = min(start + chunk_size, len(tokens))
            chunk_tokens = tokens[start:end]
            chunk_text = _tokenizer.decode(chunk_tokens).strip()

            if chunk_text:
                chunks.append(
                    {
                        "chunk_index": chunk_index,
                        "page": page_num,
                        "text": chunk_text,
                        "token_count": len(chunk_tokens),
                    }
                )
                chunk_index += 1

            if end == len(tokens):
                break
            start += chunk_size - chunk_overlap

    return chunks
