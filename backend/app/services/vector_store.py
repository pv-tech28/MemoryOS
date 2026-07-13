"""
Vector Store Service
Manages FAISS for storing and retrieving document embeddings (production‑grade, Python 3.13‑compatible).
"""

import os
import pickle
import logging
from dotenv import load_dotenv
from typing import List, Dict, Any, Optional

# Import FAISS
try:
    import faiss
    import numpy as np
except ImportError as e:
    raise ImportError(
        "FAISS not installed. Please install faiss-cpu with: pip install faiss-cpu"
    ) from e

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

load_dotenv()

# Singleton index and metadata storage
_index: Optional[faiss.IndexFlatIP] = None
_chunk_id_order: List[str] = []  # Maps FAISS index position to chunk_id
_metadata_store: Dict[str, Dict[str, Any]] = {}  # key: chunk_id → {'text': str, 'metadata': dict, 'embedding': list[float]}
_doc_id_to_chunk_ids: Dict[str, List[str]] = {}  # key: doc_id → list of chunk_ids
COLLECTION_NAME = "evolve_documents"
VECTOR_STORE_PATH = os.getenv("VECTOR_STORE_PATH", "./faiss_store")


def _get_vector_store_path() -> str:
    """Get path for saving/loading FAISS index and metadata."""
    return VECTOR_STORE_PATH


def _ensure_dir() -> None:
    """Ensure the vector store directory exists."""
    os.makedirs(_get_vector_store_path(), exist_ok=True)


def _save_data() -> None:
    """Save FAISS index and all metadata to disk."""
    _ensure_dir()
    index_path = os.path.join(_get_vector_store_path(), f"{COLLECTION_NAME}.index")
    metadata_path = os.path.join(_get_vector_store_path(), f"{COLLECTION_NAME}_metadata.pkl")

    try:
        if _index is not None:
            faiss.write_index(_index, index_path)
        with open(metadata_path, "wb") as f:
            pickle.dump(
                (_metadata_store, _doc_id_to_chunk_ids, _chunk_id_order),
                f
            )
        logger.info(f"[VectorStore] Saved FAISS index and metadata to {_get_vector_store_path()}")
    except Exception as e:
        logger.error(f"[VectorStore] Error saving vector store: {str(e)}")
        raise


def _load_data() -> None:
    """Load FAISS index and metadata from disk (initialize new if not exists)."""
    global _index, _metadata_store, _doc_id_to_chunk_ids, _chunk_id_order
    index_path = os.path.join(_get_vector_store_path(), f"{COLLECTION_NAME}.index")
    metadata_path = os.path.join(_get_vector_store_path(), f"{COLLECTION_NAME}_metadata.pkl")

    if os.path.exists(index_path) and os.path.exists(metadata_path):
        try:
            _index = faiss.read_index(index_path)
            with open(metadata_path, "rb") as f:
                (_metadata_store, _doc_id_to_chunk_ids, _chunk_id_order) = pickle.load(f)
            logger.info(f"[VectorStore] Loaded FAISS index and metadata from {_get_vector_store_path()}")
        except Exception as e:
            logger.error(f"[VectorStore] Error loading vector store: {str(e)}. Initializing new store.")
            _initialize_index()
    else:
        _initialize_index()


def _initialize_index() -> None:
    """Initialize a new FAISS index and metadata stores."""
    global _index, _metadata_store, _doc_id_to_chunk_ids, _chunk_id_order
    from app.services.embeddings import get_embedding_dimension
    dim = get_embedding_dimension()

    _index = faiss.IndexFlatIP(dim)  # IP = Inner Product (perfect for cosine similarity with normalized vectors)
    _metadata_store = {}
    _doc_id_to_chunk_ids = {}
    _chunk_id_order = []
    logger.info(f"[VectorStore] Initialized new FAISS index with dimension {dim}")


def _get_index() -> faiss.IndexFlatIP:
    """Lazy‑initialize the FAISS index and metadata stores."""
    global _index
    if _index is None:
        _load_data()
    return _index  # type: ignore


def add_document(
    doc_id: str,
    chunks: List[str],
    embeddings: List[List[float]],
    metadatas: List[Dict[str, Any]],
) -> int:
    """
    Store document chunks with their embeddings in FAISS.

    Args:
        doc_id: Unique document identifier.
        chunks: List of text chunks.
        embeddings: Corresponding embedding vectors (should be normalized).
        metadatas: Metadata for each chunk (page_number, chunk_index, etc).

    Returns:
        Number of chunks stored.
    """
    index = _get_index()

    # Validate inputs
    if len(chunks) != len(embeddings) or len(chunks) != len(metadatas):
        raise ValueError(
            f"Input lengths must match: chunks={len(chunks)}, "
            f"embeddings={len(embeddings)}, metadatas={len(metadatas)}"
        )

    # Create unique IDs for each chunk
    ids = [f"{doc_id}__chunk_{i}" for i in range(len(chunks))]

    # Add data to our metadata stores
    for i, (chunk, embedding, meta) in enumerate(zip(chunks, embeddings, metadatas)):
        chunk_id = ids[i]
        meta["doc_id"] = doc_id  # Ensure doc_id is always present in metadata
        _metadata_store[chunk_id] = {
            "text": chunk,
            "metadata": meta,
            "embedding": embedding
        }
        _chunk_id_order.append(chunk_id)

    # Track which chunks belong to this document
    if doc_id not in _doc_id_to_chunk_ids:
        _doc_id_to_chunk_ids[doc_id] = []
    _doc_id_to_chunk_ids[doc_id].extend(ids)

    # Add embeddings to FAISS (convert to float32 numpy array)
    embeddings_np = np.array(embeddings, dtype=np.float32)
    index.add(embeddings_np)

    logger.info(f"[VectorStore] Stored {len(chunks)} chunks for document '{doc_id}'")
    _save_data()

    return len(chunks)


def search(
    query_embedding: List[float],
    doc_id: Optional[str] = None,
    top_k: int = 5,
) -> List[Dict[str, Any]]:
    """
    Search for the most relevant chunks given a query embedding.

    Args:
        query_embedding: Embedding vector of the query (normalized).
        doc_id: Optional document ID to filter results (None = search all).
        top_k: Number of results to return.

    Returns:
        List of dicts with keys: 'content', 'metadata', 'distance', 'relevance_score'.
    """
    index = _get_index()
    if index.ntotal == 0:
        return []

    # Convert query to FAISS‑compatible numpy array
    query_np = np.array([query_embedding], dtype=np.float32)

    # Determine how many results to fetch initially
    fetch_k = top_k
    if doc_id is not None:
        # If filtering, fetch more results to ensure we get enough matches
        fetch_k = min(top_k * 10, index.ntotal)

    # Search FAISS index
    similarities_np, indices_np = index.search(query_np, fetch_k)

    # Process search results
    search_results: List[Dict[str, Any]] = []
    similarities = similarities_np[0].tolist()
    indices = indices_np[0].tolist()

    for i, idx in enumerate(indices):
        if idx == -1 or idx >= len(_chunk_id_order):
            continue  # Skip invalid indices

        chunk_id = _chunk_id_order[idx]
        chunk_data = _metadata_store.get(chunk_id)
        if not chunk_data:
            continue

        # Apply doc_id filter if specified
        if doc_id is not None and chunk_data["metadata"]["doc_id"] != doc_id:
            continue

        # FAISS IndexFlatIP (with normalized vectors) returns cosine similarity [0, 1]
        similarity = max(0.0, similarities[i])
        distance = 1.0 - similarity  # For consistency with old ChromaDB interface

        search_results.append({
            "content": chunk_data["text"],
            "metadata": chunk_data["metadata"],
            "distance": distance,
            "relevance_score": round(similarity, 4),
        })

        if len(search_results) >= top_k:
            break

    return search_results


def delete_document(doc_id: str) -> int:
    """
    Remove all chunks for a given document from FAISS (rebuilds index).

    Args:
        doc_id: The document ID to remove.

    Returns:
        Number of chunks deleted.
    """
    global _index, _chunk_id_order, _metadata_store, _doc_id_to_chunk_ids
    index = _get_index()

    if doc_id not in _doc_id_to_chunk_ids:
        return 0

    # Get chunks to delete
    chunk_ids_to_delete = _doc_id_to_chunk_ids[doc_id]
    count = len(chunk_ids_to_delete)
    logger.warning(f"[VectorStore] Rebuilding index to delete {count} chunks for document '{doc_id}'")

    # Collect remaining data
    remaining_chunk_ids: List[str] = []
    remaining_embeddings: List[List[float]] = []
    remaining_metadata_store: Dict[str, Dict[str, Any]] = {}
    remaining_doc_id_to_chunk_ids: Dict[str, List[str]] = {}

    # Iterate in index order to preserve order
    for chunk_id in _chunk_id_order:
        if chunk_id in chunk_ids_to_delete:
            continue  # Skip chunks marked for deletion

        # Keep this chunk
        chunk_data = _metadata_store[chunk_id]
        remaining_chunk_ids.append(chunk_id)
        remaining_embeddings.append(chunk_data["embedding"])
        remaining_metadata_store[chunk_id] = chunk_data

        # Update doc_id map
        current_doc_id = chunk_data["metadata"]["doc_id"]
        if current_doc_id not in remaining_doc_id_to_chunk_ids:
            remaining_doc_id_to_chunk_ids[current_doc_id] = []
        remaining_doc_id_to_chunk_ids[current_doc_id].append(chunk_id)

    # Rebuild index
    from app.services.embeddings import get_embedding_dimension
    dim = get_embedding_dimension()
    new_index = faiss.IndexFlatIP(dim)

    if remaining_embeddings:
        new_index.add(np.array(remaining_embeddings, dtype=np.float32))

    # Update global variables
    _index = new_index
    _chunk_id_order = remaining_chunk_ids
    _metadata_store = remaining_metadata_store
    _doc_id_to_chunk_ids = remaining_doc_id_to_chunk_ids

    logger.info(f"[VectorStore] Deleted {count} chunks, rebuilt index with {len(remaining_chunk_ids)} chunks")
    _save_data()

    return count


def get_document_count() -> int:
    """Return the total number of chunks in the vector store."""
    index = _get_index()
    return index.ntotal
