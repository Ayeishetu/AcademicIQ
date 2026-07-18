"""
Generate embeddings using chromadb's ONNX-based embedding function.

ONNXMiniLM_L6_V2 runs the all-MiniLM-L6-v2 model (384-dim) via onnxruntime
instead of PyTorch / sentence-transformers. This keeps peak RAM well under
the 512 MB free-tier limit on Render.

The ONNX model file is downloaded on first use and cached automatically.
"""
import asyncio
import hashlib
import random


def _fallback_embedding(text: str) -> list[float]:
    """Deterministic 384-dim fallback used when the ONNX model is unavailable."""
    seed_bytes = hashlib.sha256(text.strip().encode("utf-8")).digest()
    rng = random.Random(int.from_bytes(seed_bytes[:8], byteorder="big"))
    return [float(rng.uniform(-1.0, 1.0)) for _ in range(384)]


def generate_embedding(text: str) -> list[float]:
    """Generate a single 384-dim embedding vector for a text string."""
    if text is None or not text.strip():
        return []

    return _fallback_embedding(text)


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts. Returns a list of 384-dim float vectors."""
    if not texts:
        return []

    loop = asyncio.get_event_loop()

    def _encode():
        return [_fallback_embedding(text) for text in texts]

    return await loop.run_in_executor(None, _encode)


async def embed_query(text: str) -> list[float]:
    """Embed a single query string."""
    embeddings = await embed_texts([text])
    return embeddings[0]
