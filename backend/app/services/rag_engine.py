

"""
RAG Engine Service
Retrieval-Augmented Generation pipeline using ChromaDB + LLM Provider + Memory Intelligence Layer.
"""

import os
import time
import traceback
from dotenv import load_dotenv
from app.services.embeddings import embed_query
from app.services.vector_store import search as vector_search
from app.services.memory_store import get_relevant_memories
from app.services.memory_intelligence import get_personalized_context, build_memory_intelligence_prompt
from app.services.llm import get_llm_provider

load_dotenv()

SYSTEM_PROMPT = """You are EVOLVE AI, an intelligent memory assistant. Use the provided memories, conversation history, and document context to answer questions.

RULES:
1. Answer using the memories, conversation history, and document context provided.
2. If you don't have enough information, say so honestly.
3. Be concise but thorough.
4. At the end, rate your confidence from 0.0 to 1.0: [CONFIDENCE: X.X]"""


def parse_confidence(answer: str) -> tuple[str, float]:
    """Extract confidence score from the LLM response."""
    import re
    confidence_match = re.search(r"\[CONFIDENCE:\s*([\d.]+)\]", answer)
    if confidence_match:
        confidence = min(1.0, max(0.0, float(confidence_match.group(1))))
        clean_answer = re.sub(r"\s*\[CONFIDENCE:\s*[\d.]+\]\s*", "", answer).strip()
        return clean_answer, confidence
    return answer, 0.7


def build_relevant_memories_prompt(relevant_memories: list[dict]) -> str:
    """Build a formatted prompt of relevant long-term memories."""
    if not relevant_memories:
        return ""
    parts = []
    for mem in relevant_memories:
        parts.append(f"- [{mem['type'].upper()}] {mem['memory']} (Importance: {mem['importance']:.1f})")
    return "RELEVANT LONG-TERM MEMORIES:\n" + "\n".join(parts)


def build_context_prompt(question: str, search_results: list[dict]) -> str:
    """Build the prompt with retrieved context chunks."""
    if not search_results:
        return f"USER'S QUESTION:\n{question}\n\nAnswer honestly if no context is available.\nEnd with [CONFIDENCE: X.X]"

    context_parts = []
    for i, result in enumerate(search_results):
        page_info = ""
        if result["metadata"].get("page_number"):
            page_info = f" (Page {result['metadata']['page_number']})"
        doc_name = result["metadata"].get("document_name", "Document")
        context_parts.append(
            f"--- Chunk {i+1}{page_info} from '{doc_name}' [Relevance: {result['relevance_score']:.0%}] ---\n"
            f"{result['content']}"
        )
    context = "\n\n".join(context_parts)
    return f"RETRIEVED DOCUMENT CONTEXT:\n{context}\n\nUSER'S QUESTION:\n{question}\n\nAnswer the question.\nEnd with [CONFIDENCE: X.X]"


def build_conversation_history_prompt(chat_history: list[dict]) -> str:
    """Build a formatted conversation history string from chat history."""
    if not chat_history:
        return ""

    history_parts = []
    for msg in chat_history:
        role = msg.get("role", "unknown")
        content = msg.get("content", "")
        if role == "user":
            history_parts.append(f"Previous User: {content}")
        elif role == "ai":
            history_parts.append(f"Previous Assistant: {content}")

    return "CONVERSATION HISTORY:\n" + "\n\n".join(history_parts)


def query(
    question: str,
    document_id: str | None = None,
    top_k: int = 5,
    chat_history: list[dict] | None = None,
    chat_id: str | None = None
) -> dict:
    """
    Full RAG pipeline with Memory Intelligence Layer,
    including long-term memories, knowledge graph, conversation history, and context.
    """
    start_time = time.time()
    if chat_history is None:
        chat_history = []

    # 1. Retrieve personalized context via Memory Intelligence Layer
    memory_context = get_personalized_context(
        question=question,
        chat_id=chat_id
    )

    # 2. If specific document ID provided, add those results too
    search_results = memory_context["search_results"]
    if document_id:
        query_embedding = embed_query(question)
        search_results = vector_search(
            query_embedding=query_embedding,
            doc_id=document_id,
            top_k=top_k,
        )

    # 3. Build full prompt
    memory_intel_prompt = build_memory_intelligence_prompt(memory_context)
    history_prompt = build_conversation_history_prompt(chat_history)
    context_prompt = build_context_prompt(question, search_results)

    final_prompt = ""
    if memory_intel_prompt:
        final_prompt += memory_intel_prompt + "\n\n"
    if history_prompt:
        final_prompt += history_prompt + "\n\n"
    final_prompt += f"USER'S QUESTION:\n{question}\n\nAnswer using all the context above. End with [CONFIDENCE: X.X]"

    # 4. Get LLM provider
    llm = get_llm_provider()

    # 5. Query LLM
    temperature = float(os.getenv("TEMPERATURE", "0.3"))
    max_tokens = int(os.getenv("MAX_OUTPUT_TOKENS", "1024"))
    
    try:
        llm_response = llm.generate(
            prompt=final_prompt,
            system_prompt=SYSTEM_PROMPT,
            temperature=temperature,
            max_tokens=max_tokens
        )
        raw_answer = llm_response["text"] or "I was unable to generate a response."
    except Exception as e:
        print(f"[RAG] Error querying LLM: {e}")
        print(f"[DEBUG] Full exception traceback:")
        traceback.print_exc()
        print("[DEBUG] Entering fallback mode due to API error")
        # Fallback response
        primary_chunks = search_results[:2]
        raw_answer = f"⚠️ LLM API Error: {e}\n\nHere is relevant text from your documents:\n"
        for chunk in primary_chunks:
            p_num = chunk["metadata"].get("page_number")
            raw_answer += f"\n- {'Page ' + str(p_num) if p_num else 'Document'}: {chunk['content'][:150]}..."
        raw_answer += "\n\n[CONFIDENCE: 0.5]"

    # 6. Parse confidence and return result
    answer, confidence = parse_confidence(raw_answer)

    # 7. Build source references
    sources = []
    for result in search_results:
        sources.append({
            "content": result["content"][:200] + "..." if len(result["content"]) > 200 else result["content"],
            "page_number": result["metadata"].get("page_number"),
            "chunk_index": result["metadata"].get("chunk_index", 0),
            "relevance_score": result["relevance_score"],
            "document_name": result["metadata"].get("document_name", "Unknown"),
        })

    # Get related entities and IDs
    related_entities = []
    graph_node_ids = []
    from app.services.memory_graph_builder import get_graph_service
    graph_service = get_graph_service()
    for node in memory_context.get("related_graph_nodes", []):
        related_entities.append({
            "name": node["name"],
            "type": node["type"]
        })
        graph_node_ids.append(node["id"])
        # Increment importance of related nodes
        graph_service.increment_node_importance(node["id"])
    
    memory_ids = [mem["id"] for mem in memory_context.get("memories", [])]

    # Load metadata to categorize sources
    import json
    UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
    METADATA_FILE = os.path.join(UPLOAD_DIR, "_metadata.json")
    all_metadata = {}
    try:
        with open(METADATA_FILE, "r", encoding="utf-8-sig") as f:
            all_metadata = json.load(f)
    except:
        pass

    # Categorize related sources
    related_documents = []
    related_emails = []
    related_calendar_events = []
    for result in search_results:
        doc_id = result["metadata"].get("doc_id")
        if doc_id and doc_id in all_metadata:
            doc = all_metadata[doc_id]
            source = doc.get("source")
            if source == "gmail":
                related_emails.append(doc)
            elif source == "calendar":
                related_calendar_events.append(doc)
            else:
                related_documents.append(doc)

    # Get the primary document name
    doc_name = search_results[0]["metadata"].get("document_name", "Document") if search_results else "N/A"

    processing_time = time.time() - start_time
    print(f"[RAG] Query completed in {processing_time:.2f}s, confidence: {confidence:.0%}")

    return {
        "answer": answer,
        "sources": sources,
        "confidence": confidence,
        "document_name": doc_name,
        "processing_time": processing_time,
        "related_entities": related_entities,
        "graph_node_ids": graph_node_ids,
        "memory_ids": memory_ids,
        "related_documents": related_documents,
        "related_emails": related_emails,
        "related_calendar_events": related_calendar_events,
    }

