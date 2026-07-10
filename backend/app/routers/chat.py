"""
Chat Router
Handles the RAG-based chat with documents.
"""

from fastapi import APIRouter, HTTPException
from app.models.schemas import ChatRequest, ChatResponse, SourceReference
from app.services.rag_engine import query as rag_query

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat_with_document(request: ChatRequest):
    """
    Ask a question about your uploaded documents.
    Uses the RAG pipeline: embed → search → context → LLM → answer.
    """
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    try:
        result = rag_query(
            question=request.question,
            document_id=request.document_id,
            top_k=5,
        )

        # Convert source dicts to SourceReference models
        sources = [
            SourceReference(
                content=s["content"],
                page_number=s.get("page_number"),
                chunk_index=s.get("chunk_index", 0),
                relevance_score=s.get("relevance_score", 0.0),
                document_name=s.get("document_name", "Unknown"),
            )
            for s in result.get("sources", [])
        ]

        return ChatResponse(
            answer=result["answer"],
            sources=sources,
            confidence=result["confidence"],
            document_name=result["document_name"],
            processing_time=result["processing_time"],
        )

    except ValueError as e:
        # Gemini API key not set
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while processing your question: {str(e)}"
        )
