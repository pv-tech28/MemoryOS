"""
Vector Store Service
Manages ChromaDB for storing and retrieving document embeddings.
"""

import os
import chromadb
from dotenv import load_dotenv

load_dotenv()

# Singleton ChromaDB client
_client = None
COLLECTION_NAME = "evolve_documents"


def _get_client():
    """Lazy-initialize the ChromaDB persistent client."""
    global _client
    if _client is None:
        db_path = os.getenv("CHROMA_DB_PATH", "./chroma_db")
        os.makedirs(db_path, exist_ok=True)
        print(f"[VectorStore] Initializing ChromaDB at: {db_path}")
        _client = chromadb.PersistentClient(path=db_path)
    return _client


def _get_collection() -> chromadb.Collection:
    """Get or create the documents collection."""
    client = _get_client()
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )


def add_document(
    doc_id: str,
    chunks: list[str],
    embeddings: list[list[float]],
    metadatas: list[dict],
) -> int:
    """
    Store document chunks with their embeddings in ChromaDB.
    
    Args:
        doc_id: Unique document identifier.
        chunks: List of text chunks.
        embeddings: Corresponding embedding vectors.
        metadatas: Metadata for each chunk (page_number, chunk_index, etc).
        
    Returns:
        Number of chunks stored.
    """
    collection = _get_collection()

    # Create unique IDs for each chunk: "doc_id__chunk_0", "doc_id__chunk_1", etc.
    ids = [f"{doc_id}__chunk_{i}" for i in range(len(chunks))]

    # Add doc_id to each metadata so we can filter by document
    for meta in metadatas:
        meta["doc_id"] = doc_id

    collection.add(
        ids=ids,
        documents=chunks,
        embeddings=embeddings,
        metadatas=metadatas,
    )

    print(f"[VectorStore] Stored {len(chunks)} chunks for document '{doc_id}'")
    return len(chunks)


def search(
    query_embedding: list[float],
    doc_id: str | None = None,
    top_k: int = 5,
) -> list[dict]:
    """
    Search for the most relevant chunks given a query embedding.
    
    Args:
        query_embedding: The embedding vector of the query.
        doc_id: Optional document ID to filter results. None = search all.
        top_k: Number of results to return.
        
    Returns:
        List of dicts with keys: content, metadata, distance, relevance_score.
    """
    collection = _get_collection()

    where_filter = {"doc_id": doc_id} if doc_id else None

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=top_k,
        where=where_filter,
        include=["documents", "metadatas", "distances"],
    )

    # Format results
    search_results: list[dict] = []
    if results and results["documents"]:
        for i, doc_text in enumerate(results["documents"][0]):
            distance = results["distances"][0][i] if results["distances"] else 0
            # ChromaDB cosine distance: 0 = identical, 2 = opposite
            # Convert to relevance score: 1.0 = perfect match, 0.0 = no match
            relevance = max(0.0, 1.0 - (distance / 2.0))

            search_results.append({
                "content": doc_text,
                "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                "distance": distance,
                "relevance_score": round(relevance, 4),
            })

    return search_results


def delete_document(doc_id: str) -> int:
    """
    Remove all chunks for a given document from ChromaDB.
    
    Args:
        doc_id: The document ID to remove.
        
    Returns:
        Number of chunks deleted.
    """
    collection = _get_collection()

    # Get all chunk IDs for this document
    existing = collection.get(
        where={"doc_id": doc_id},
        include=[],
    )

    if existing and existing["ids"]:
        collection.delete(ids=existing["ids"])
        count = len(existing["ids"])
        print(f"[VectorStore] Deleted {count} chunks for document '{doc_id}'")
        return count

    return 0


def get_document_count() -> int:
    """Return total number of chunks in the collection."""
    collection = _get_collection()
    return collection.count()
