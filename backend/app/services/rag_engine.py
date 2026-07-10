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
        # Configure client to fail fast on errors (e.g. 429) rather than hanging in retry loops
        from google.genai import types
        _gemini_client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(
                timeout=120000,  # 2 minutes timeout in milliseconds
                retry_options=types.HttpRetryOptions(attempts=1)
            )
        )
        print("[RAG] Gemini client initialized")
    return _gemini_client


SYSTEM_PROMPT = """You are EVOLVE AI, an intelligent memory assistant. You answer questions based ONLY on the provided context from the user's documents.

RULES:
1. Answer ONLY based on the provided context chunks. Do not make up information.
2. If the context doesn't contain enough information, say so honestly.
3. Reference specific parts of the documents when possible (mention page numbers).
4. Be concise but thorough.
5. Format your response with bullet points and bold text for readability.
6. At the end, rate your confidence from 0.0 to 1.0 based on how well the context answers the question. Output it as: [CONFIDENCE: 0.X]"""


def build_context_prompt(question: str, search_results: list[dict]) -> str:
    """Build the prompt with retrieved context chunks."""
    context_parts = []
    for i, result in enumerate(search_results):
        page_info = ""
        if result["metadata"].get("page_number"):
            page_info = f" (Page {result['metadata']['page_number']})"
        
        doc_name = result["metadata"].get("document_name", "Document")
        context_parts.append(
            f"--- Chunk {i + 1}{page_info} from '{doc_name}' "
            f"[Relevance: {result['relevance_score']:.0%}] ---\n"
            f"{result['content']}"
        )

    context = "\n\n".join(context_parts)

    return f"""CONTEXT FROM USER'S DOCUMENTS:
{context}

USER'S QUESTION:
{question}

Answer the question based on the context above. End with [CONFIDENCE: X.X]"""


def parse_confidence(answer: str) -> tuple[str, float]:
    """Extract confidence score from the LLM response."""
    import re
    confidence_match = re.search(r"\[CONFIDENCE:\s*([\d.]+)\]", answer)
    
    if confidence_match:
        confidence = min(1.0, max(0.0, float(confidence_match.group(1))))
        # Remove the confidence tag from the visible answer
        clean_answer = re.sub(r"\s*\[CONFIDENCE:\s*[\d.]+\]\s*", "", answer).strip()
        return clean_answer, confidence
    
    return answer, 0.7  # Default confidence if not provided


def query(
    question: str,
    document_id: str | None = None,
    top_k: int = 5,
) -> dict:
    """
    Full RAG pipeline: embed question → search → build prompt → LLM → response.
    
    Args:
        question: The user's natural language question.
        document_id: Optional document ID to search within. None = all documents.
        top_k: Number of context chunks to retrieve.
        
    Returns:
        Dict with: answer, sources, confidence, processing_time
    """
    start_time = time.time()

    # 1. Embed the question
    query_embedding = embed_query(question)

    # 2. Search ChromaDB for relevant chunks
    search_results = vector_search(
        query_embedding=query_embedding,
        doc_id=document_id,
        top_k=top_k,
    )

    if not search_results:
        return {
            "answer": "I couldn't find any relevant information in your documents to answer this question. Try uploading more documents or rephrasing your question.",
            "sources": [],
            "confidence": 0.0,
            "document_name": "N/A",
            "processing_time": time.time() - start_time,
        }

    # 3. Build context prompt
    prompt = build_context_prompt(question, search_results)

    # 4. Query Gemini
    try:
        client = _get_gemini_client()
        model_name = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.3,
                max_output_tokens=1024,
            ),
        )
        raw_answer = response.text or "I was unable to generate a response."
    except Exception as e:
        # Fallback to local search summary if no key is configured or API call fails
        if isinstance(e, ValueError):
            err_msg = "GEMINI_API_KEY is not configured in backend/.env"
        else:
            err_msg = f"Gemini API Error ({type(e).__name__}: {e})"
            
        print(f"[RAG] {err_msg}. Falling back to local search summary.")
        primary_chunks = search_results[:2]
        raw_answer = f"⚠️ **Note: {err_msg}. Running in keyless fallback mode.**\n\nHere is the direct matching text found in your document:\n\n"
        for chunk in primary_chunks:
            p_num = chunk["metadata"].get("page_number")
            p_str = f"Page {p_num}" if p_num else "Unknown page"
            raw_answer += f"• **Source ({p_str}):** {chunk['content']}\n\n"
        raw_answer += "\nTo get full AI-generated answers, please set a valid and active `GEMINI_API_KEY` in `backend/.env`."
        raw_answer += "\n\n[CONFIDENCE: 0.8]"

    # 5. Parse confidence
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
