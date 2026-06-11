"""
Generate embeddings using a local HuggingFace sentence-transformers model.
Model: all-MiniLM-L6-v2 (384-dimensional, free, no API key required)
"""
import asyncio
from functools import lru_cache

from sentence_transformers import SentenceTransformer


@lru_cache(maxsize=1)
def _get_model() -> SentenceTransformer:
    """Load the model once and cache it for the lifetime of the process."""
    return SentenceTransformer("all-MiniLM-L6-v2")


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts. Returns list of embedding vectors."""
    loop = asyncio.get_event_loop()
    model = _get_model()

    def _encode():
        return model.encode(texts, batch_size=64, show_progress_bar=False).tolist()

    return await loop.run_in_executor(None, _encode)


async def embed_query(text: str) -> list[float]:
    """Embed a single query string."""
    embeddings = await embed_texts([text])
    return embeddings[0]
