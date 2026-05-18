"""
Generate embeddings using OpenAI text-embedding-3-small.
"""
from openai import AsyncOpenAI

from app.core.config import get_settings

settings = get_settings()

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts. Returns list of embedding vectors."""
    client = _get_client()
    # OpenAI allows up to 2048 inputs per request; batch if needed
    all_embeddings = []
    batch_size = 100

    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        response = await client.embeddings.create(
            model=settings.embedding_model,
            input=batch,
        )
        all_embeddings.extend([item.embedding for item in response.data])

    return all_embeddings


async def embed_query(text: str) -> list[float]:
    """Embed a single query string."""
    embeddings = await embed_texts([text])
    return embeddings[0]
