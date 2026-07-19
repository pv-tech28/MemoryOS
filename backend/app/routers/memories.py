
"""
Memories Router
Handles long-term memory endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends
from app.models.schemas import (
    Memory, MemoryListResponse,
    GraphNode, GraphEdge, GraphData, RelatedMemoriesResponse
)
from app.services.memory_store import (
    get_relevant_memories,
    get_memories_by_chat_id,
    delete_memory,
    update_memory
)
from app.services.memory_graph_builder import (
    get_all_graph_nodes,
    get_all_graph_edges,
    get_related_memories,
    get_graph_stats
)
from app.dependencies import get_current_user
from app.models.db_models import User

router = APIRouter(prefix="/api/memories", tags=["memories"])


@router.get("", response_model=MemoryListResponse)
def list_memories(
    current_user: User = Depends(get_current_user),
    chat_id: str | None = None
):
    """List all memories."""
    try:
        if chat_id:
            memories = get_memories_by_chat_id(chat_id, min_importance=0.0, user_id="default_user")
        else:
            memories = get_relevant_memories(
                "",
                chat_id=None,
                user_id="default_user",
                limit=100,
                min_importance=0.0
            )
        return MemoryListResponse(memories=[Memory(**m) for m in memories], total=len(memories))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/relevant", response_model=MemoryListResponse)
def list_relevant_memories(
    query: str,
    current_user: User = Depends(get_current_user),
    chat_id: str | None = None
):
    """List relevant memories for a query."""
    try:
        memories = get_relevant_memories(
            query_text=query,
            chat_id=chat_id,
            user_id="default_user",
            limit=10,
            min_importance=0.3
        )
        return MemoryListResponse(memories=[Memory(**m) for m in memories], total=len(memories))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{memory_id}")
def remove_memory(memory_id: str, current_user: User = Depends(get_current_user)):
    """Delete a memory."""
    try:
        success = delete_memory(memory_id, user_id="default_user")
        if not success:
            raise HTTPException(status_code=404, detail="Memory not found")
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/graph", response_model=GraphData)
def get_graph(current_user: User = Depends(get_current_user)):
    """Get all graph nodes and edges."""
    try:
        nodes = [GraphNode(**n) for n in get_all_graph_nodes(user_id="default_user")]
        edges = [GraphEdge(**e) for e in get_all_graph_edges(user_id="default_user")]
        return GraphData(nodes=nodes, edges=edges)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/related/{entity_name}", response_model=RelatedMemoriesResponse)
def get_related_entity_memories(entity_name: str, current_user: User = Depends(get_current_user)):
    """Get related memories for an entity."""
    try:
        result = get_related_memories(entity_name, user_id="default_user")
        return RelatedMemoriesResponse(
            node=GraphNode(**result["node"]) if result["node"] else None,
            edges=result["edges"],
            related_nodes=[GraphNode(**n) for n in result["related_nodes"]],
            memories=[Memory(**m) for m in result["memories"]]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
def get_stats(current_user: User = Depends(get_current_user)):
    """Get graph statistics."""
    try:
        return get_graph_stats(user_id="default_user")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

