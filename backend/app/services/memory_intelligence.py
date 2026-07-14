
"""
Memory Intelligence Layer
This layer sits between RAG and Gemini,
Orchestrates memory graph, vector search, and long-term memory.
"""
import os
from typing import Optional, List, Dict, Any
from app.services.memory_store import get_relevant_memories
from app.services.vector_store import search as vector_search
from app.services.embeddings import embed_query
from app.services.memory_graph_builder import get_graph_service

def get_personalized_context(
    question: str,
    chat_id: Optional[str] = None,
    user_id: str = "default"
) -> Dict[str, Any]:
    """
    Get all personalized context for a question including:
    1. Long-term memories
    2. Knowledge graph
    3. Vector search results
    """
    # 1. Retrieve relevant long-term memories
    memories = get_relevant_memories(
        query_text=question,
        chat_id=chat_id,
        limit=15,
        min_importance=0.3
    )
    
    # 2. Retrieve related graph nodes
    graph_service = get_graph_service()
    related_nodes = graph_service.search_nodes(question)
    
    # 3. Retrieve vector search results
    query_embedding = embed_query(question)
    search_results = vector_search(
        query_embedding=query_embedding,
        top_k=8
    )
    
    return {
        "memories": memories,
        "related_graph_nodes": related_nodes,
        "search_results": search_results
    }


def build_memory_intelligence_prompt(
    context: Dict[str, Any]
) -> str:
    """
    Build prompt string from memory intelligence context
    """
    parts = []
    
    # Add memories
    if context.get("memories"):
        parts.append("=== LONG-TERM MEMORIES ===")
        for mem in context["memories"]:
            parts.append(f"- [{mem['type'].upper()}] {mem['memory']} (Imp: {mem['importance']:.1f}, Access: {mem['access_count']})")
    
    # Add related graph nodes
    if context.get("related_graph_nodes"):
        parts.append("\n=== KNOWLEDGE GRAPH ===")
        for node in context["related_graph_nodes"]:
            parts.append(f"- [{node['type']}] {node['name']}")
            if node.get("description"):
                parts.append(f"  Description: {node['description']}")
    
    # Add search results
    if context.get("search_results"):
        parts.append("\n=== DOCUMENT CONTEXT ===")
        for i, result in enumerate(context["search_results"]):
            page_info = ""
            if result["metadata"].get("page_number"):
                page_info = f" (Page {result['metadata']['page_number']})"
            doc_name = result["metadata"].get("document_name", "Document")
            parts.append(
                f"--- Chunk {i+1}{page_info} from '{doc_name}' [Rel: {result['relevance_score']:.0%} ---\n{result['content']}"
            )
    
    return "\n".join(parts)
