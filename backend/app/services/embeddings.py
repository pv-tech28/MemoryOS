
"""
Temporary dummy embeddings to get the app working without external models!
Replace with real embeddings later!
"""
import random
from dotenv import load_dotenv

load_dotenv()

# Seed for consistent dummy embeddings
random.seed(42)
EMBEDDING_DIM = 384


def _text_to_seed(text: str) -> int:
    """Convert text to a deterministic seed"""
    h = 0
    for ch in text:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return h


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Generate deterministic dummy embeddings"""
    result = []
    for text in texts:
        rng = random.Random(_text_to_seed(text))
        vec = [rng.random() * 2 - 1 for _ in range(EMBEDDING_DIM)]
        # Normalize to unit vector
        norm = sum(x**2 for x in vec) ** 0.5
        if norm > 0:
            vec = [x / norm for x in vec]
        result.append(vec)
    return result


def embed_query(query: str) -> list[float]:
    return embed_texts([query])[0]


def get_embedding_dimension() -> int:
    return EMBEDDING_DIM
