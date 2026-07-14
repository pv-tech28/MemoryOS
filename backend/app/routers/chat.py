"""
Chat Router
Handles the RAG-based chat with documents and memory extraction.
"""

from fastapi import APIRouter, HTTPException
from app.models.schemas import ChatRequest, ChatResponse, SourceReference, RelatedEntity
from app.services.timeline_service import add_timeline_event
from app.services.rag_engine import query as rag_query
from app.services.conversation_memory import (
    create_chat,
    save_message,
    get_chat_history,
    clear_chat,
    delete_chat
)
from app.services.memory_extractor import extract_memories

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
async def chat_with_document(request: ChatRequest):
    """
    Ask a question about your uploaded documents.
    Uses the RAG pipeline with conversation history and memory extraction.
    """
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    try:
        # Get or create chat ID
        chat_id = request.chat_id
        if not chat_id:
            chat_id = create_chat(document_id=request.document_id)

        # Retrieve conversation history
        chat_history = get_chat_history(chat_id)

        # Process the query with chat_id
        result = rag_query(
            question=request.question,
            document_id=request.document_id,
            top_k=5,
            chat_history=chat_history,
            chat_id=chat_id
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

        # Save messages to conversation history
        save_message(chat_id, "user", request.question)
        save_message(
            chat_id,
            "ai",
            result["answer"],
            sources=[s.model_dump() for s in sources],
            confidence=result["confidence"],
            document_name=result["document_name"],
            processing_time=result["processing_time"],
        )

        # Extract memories from conversation
        try:
            full_history = get_chat_history(chat_id)
            extract_memories(chat_id, full_history)
        except Exception as extract_error:
            print(f"[Memory Extractor] Error extracting memories: {extract_error}")

        # Convert related entities to model
        related_entities = None
        if result.get("related_entities"):
            related_entities = [
                RelatedEntity(name=e["name"], type=e["type"])
                for e in result["related_entities"]
            ]

        # Add timeline event
        add_timeline_event(
            title=f"Ask EVOLVE: {request.question[:50]}{'...' if len(request.question) > 50 else ''}",
            description=f"AI answered your question in {result['processing_time']:.2f}s.",
            event_type="chat"
        )

        return ChatResponse(
            chat_id=chat_id,
            answer=result["answer"],
            sources=sources,
            confidence=result["confidence"],
            document_name=result["document_name"],
            processing_time=result["processing_time"],
            related_entities=related_entities,
            graph_node_ids=result.get("graph_node_ids"),
            memory_ids=result.get("memory_ids"),
            related_documents=result.get("related_documents"),
            related_emails=result.get("related_emails"),
            related_calendar_events=result.get("related_calendar_events"),
        )

    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while processing your question: {str(e)}"
        )


@router.post("/clear/{chat_id}")
async def clear_conversation(chat_id: str):
    """Clear all messages from a chat."""
    success = clear_chat(chat_id)
    return {"success": success}


@router.delete("/{chat_id}")
async def delete_conversation(chat_id: str):
    """Delete an entire chat."""
    success = delete_chat(chat_id)
    return {"success": success}
