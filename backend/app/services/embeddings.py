"""
Generate embeddings using chromadb's built-in default embedding function.

Uses ONNXMiniLM_L6_V2 — the all-MiniLM-L6-v2 model (384-dim) via onnxruntime
instead of PyTorch. Avoids loading the full sentence-transformers / torch stack,
keeping memory well within Render's 512 MB free-tier limit.

The model files are downloaded on first use and cached by chromadb automatically.
"""
import asyncio
from functools import lru_cache

from chromadb.utils.embedding_functions import DefaultEmbeddingFunction


@lru_cache(maxsize=1)
def _get_model() -> DefaultEmbeddingFunction:
    """Load the ONNX embedding function once and cache it for the process lifetime."""
    return DefaultEmbeddingFunction()


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts. Returns a list of 384-dim float vectors."""
    loop = asyncio.get_event_loop()
    fn = _get_model()

    def _encode():
        # DefaultEmbeddingFunction returns a list of lists
        return fn(texts)

    return await loop.run_in_executor(None, _encode)


async def embed_query(text: str) -> list[float]:
    """Embed a single query string."""
    embeddings = await embed_texts([text])
    return embeddings[0]
