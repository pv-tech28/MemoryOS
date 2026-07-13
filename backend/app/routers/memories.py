
"""
Memories Router
Handles long-term memory endpoints.
"""

from fastapi import APIRouter, HTTPException
from app.models.schemas import Memory, MemoryListResponse
from app.services.memory_store import (
    get_relevant_memories,
    get_memories_by_chat_id,
    delete_memory,
    update_memory
)

router = APIRouter(prefix="/api/memories", tags=["memories"])


@router.get("", response_model=MemoryListResponse)
def list_memories(user_id: str = "default", chat_id: str | None = None):
    """List all memories."""
    try:
        if chat_id:
            memories = get_memories_by_chat_id(chat_id, min_importance=0.0)
        else:
            memories = get_relevant_memories(
                "",
                chat_id=None,
                user_id=user_id,
                limit=100,
                min_importance=0.0
            )
        return MemoryListResponse(memories=[Memory(**m) for m in memories], total=len(memories))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/relevant", response_model=MemoryListResponse)
def list_relevant_memories(query: str, user_id: str = "default", chat_id: str | None = None):
    """List relevant memories for a query."""
    try:
        memories = get_relevant_memories(
            query_text=query,
            chat_id=chat_id,
            user_id=user_id,
            limit=10,
            min_importance=0.3
        )
        return MemoryListResponse(memories=[Memory(**m) for m in memories], total=len(memories))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{memory_id}")
def remove_memory(memory_id: str):
    """Delete a memory."""
    try:
        success = delete_memory(memory_id)
        if not success:
            raise HTTPException(status_code=404, detail="Memory not found")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
