
"""
RAG Engine Service
Retrieval-Augmented Generation pipeline using ChromaDB + Google Gemini.
"""

import os
import time
from google import genai
from dotenv import load_dotenv
from app.services.embeddings import embed_query
from app.services.vector_store import search as vector_search
from app.services.memory_store import get_relevant_memories

load_dotenv()

# Initialize Gemini client
_gemini_client: genai.Client | None = None


def _get_gemini_client() -> genai.Client:
    """Lazy-initialize the Gemini client."""
    global _gemini_client
    if _gemini_client is None:
        api_key = os.getenv("GEMINI_API_KEY", "")
        if not api_key or api_key == "your_gemini_api_key_here":
            raise ValueError(
                "GEMINI_API_KEY not set. Please add your key to backend/.env\n"
                "Get one at: https://aistudio.google.com/apikey"
            )
        from google.genai import types
        _gemini_client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(
                timeout=120000,
                retry_options=types.HttpRetryOptions(attempts=1)
            )
        )
    return _gemini_client


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
    Full RAG pipeline with long-term memories, conversation history, and context.
    """
    start_time = time.time()
    if chat_history is None:
        chat_history = []

    # 1. Retrieve relevant long-term memories
    relevant_memories = get_relevant_memories(
        query_text=question,
        chat_id=chat_id,
        limit=10,
        min_importance=0.3
    )

    # 2. Embed the question and search for documents
    query_embedding = embed_query(question)
    search_results = vector_search(
        query_embedding=query_embedding,
        doc_id=document_id,
        top_k=top_k,
    )

    # 3. Build full prompt
    memories_prompt = build_relevant_memories_prompt(relevant_memories)
    history_prompt = build_conversation_history_prompt(chat_history)
    context_prompt = build_context_prompt(question, search_results)

    final_prompt = ""
    if memories_prompt:
        final_prompt += memories_prompt + "\n\n"
    if history_prompt:
        final_prompt += history_prompt + "\n\n"
    final_prompt += context_prompt

    # 4. Query Gemini
    try:
        client = _get_gemini_client()
        model_name = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")
        response = client.models.generate_content(
            model=model_name,
            contents=final_prompt,
            config=genai.types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.3,
                max_output_tokens=1024,
            )
        )
        raw_answer = response.text or "I was unable to generate a response."
    except Exception as e:
        import traceback
        print(f"[RAG] Error querying Gemini: {e}")
        traceback.print_exc()
        # Fallback response
        primary_chunks = search_results[:2]
        raw_answer = f"⚠️ Gemini API Error: {e}\n\nHere is relevant text from your documents:\n"
        for chunk in primary_chunks:
            p_num = chunk["metadata"].get("page_number")
            raw_answer += f"\n- {'Page ' + str(p_num) if p_num else 'Document'}: {chunk['content'][:150]}..."
        raw_answer += "\n\n[CONFIDENCE: 0.5]"

    # 5. Parse confidence and return result
    answer, confidence = parse_confidence(raw_answer)

    # 6. Build source references
    sources = []
    for result in search_results:
        sources.append({
            "content": result["content"][:200] + "..." if len(result["content"]) > 200 else result["content"],
            "page_number": result["metadata"].get("page_number"),
            "chunk_index": result["metadata"].get("chunk_index", 0),
            "relevance_score": result["relevance_score"],
            "document_name": result["metadata"].get("document_name", "Unknown"),
        })

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
    }
