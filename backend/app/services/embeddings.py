"""
Generate embeddings using chromadb's ONNX-based embedding function.

ONNXMiniLM_L6_V2 runs the all-MiniLM-L6-v2 model (384-dim) via onnxruntime
instead of PyTorch / sentence-transformers. This keeps peak RAM well under
the 512 MB free-tier limit on Render.

The ONNX model file is downloaded on first use and cached automatically.
"""
import asyncio
from functools import lru_cache


@lru_cache(maxsize=1)
def _get_model():
    """
    Load the ONNX embedding function once and cache it for the process lifetime.
    Tries the dedicated ONNX module first; falls back to DefaultEmbeddingFunction.
    """
    try:
        from chromadb.utils.embedding_functions.onnx_mini_lm_l6_v2 import ONNXMiniLM_L6_V2
        return ONNXMiniLM_L6_V2()
    except ImportError:
        from chromadb.utils.embedding_functions import DefaultEmbeddingFunction
        return DefaultEmbeddingFunction()


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts. Returns a list of 384-dim float vectors."""
    loop = asyncio.get_event_loop()
    fn = _get_model()

    def _encode():
        result = fn(texts)
        # Ensure plain Python lists (chromadb may return numpy arrays)
        return [list(map(float, v)) for v in result]

    return await loop.run_in_executor(None, _encode)


async def embed_query(text: str) -> list[float]:
    """Embed a single query string."""
    embeddings = await embed_texts([text])
    return embeddings[0]
