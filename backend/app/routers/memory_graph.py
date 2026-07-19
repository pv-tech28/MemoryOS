
"""
Memory Graph Router
Handles generation of memory graph data from documents, sources, and extracted entities.
"""

import os
import json
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query, Depends
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import Optional, List
from app.services.memory_graph_builder import (
    get_graph_service,
    EntityNode,
    RelationshipEdge,
    get_all_graph_nodes,
    get_all_graph_edges,
    get_graph_stats,
    get_related_memories
)

from app.database import SessionLocal, get_db
from app.repositories.document_repo import DocumentRepository
from app.dependencies import get_current_user
from app.models.db_models import User
from sqlalchemy.orm import Session

load_dotenv()

router = APIRouter(prefix="/api/memory-graph", tags=["memory-graph"])

def _load_metadata(user_id: str, db: Session) -> dict:
    """Load document metadata from PostgreSQL."""
    return DocumentRepository.to_metadata_dict(db, user_id=user_id)

# Node type colors
NODE_COLORS = {
    "Person": "#4facfe",
    "Organization": "#00d68f",
    "Company": "#00d68f",
    "Project": "#f0a500",
    "Technology": "#ff6b6b",
    "Skill": "#1abc9c",
    "Task": "#9b59b6",
    "Meeting": "#e84393",
    "Date": "#3498db",
    "Deadline": "#e74c3c",
    "Topic": "#2ecc71",
    "Location": "#95a5a6",
    "Course": "#8e44ad",
    "Product": "#d35400",
    "Email": "#ea4335",
    "Document": "#e84393",
    "Event": "#34a853",
    "Concept": "#34495e",
    "Conversation": "#27ae60",
    "Custom": "#9b59b6"
}

@router.get("")
async def get_memory_graph(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get full knowledge graph including all nodes and edges, plus document/source nodes."""
    try:
        graph_service = get_graph_service()
        nodes = graph_service.get_all_nodes("default_user")
        edges = graph_service.get_all_edges("default_user")

        formatted_nodes = []
        node_id_map = {}

        for node in nodes:
            color = NODE_COLORS.get(node.type, NODE_COLORS["Custom"])
            formatted_node = {
                "id": node.id,
                "label": node.name,
                "category": node.type,
                "color": color,
                "radius": 35,
                "description": node.description or "",
                "date": datetime.fromisoformat(node.created_at).strftime("%d %b %Y"),
                "type": node.type,
                "importance": node.importance,
                "connections": [],
            }
            formatted_nodes.append(formatted_node)
            node_id_map[node.id] = formatted_node

        metadata = _load_metadata("default_user", db)
        for doc in metadata.values():
            doc_id = f"doc_{doc['id']}"
            source = doc.get("source", "upload")
            if source == "gmail":
                category = "Email"
                color = NODE_COLORS["Email"]
            elif source == "drive":
                category = "Document"
                color = NODE_COLORS["Document"]
            elif source == "calendar":
                category = "Event"
                color = NODE_COLORS["Event"]
            else:
                category = "Document"
                color = NODE_COLORS["Document"]

            filename = doc["filename"]
            short_filename = filename[:18] + "..." if len(filename) > 20 else filename

            doc_node = {
                "id": doc_id,
                "label": f"{short_filename}",
                "category": category,
                "color": color,
                "radius": 30,
                "description": f"Source document",
                "date": datetime.fromisoformat(doc["uploaded_at"].rstrip("Z")).strftime("%d %b %Y"),
                "type": category,
                "connections": [],
            }
            formatted_nodes.append(doc_node)
            node_id_map[doc_id] = doc_node

        formatted_edges = []
        edge_set = set()
        for edge in edges:
            if edge.source_id in node_id_map and edge.target_id in node_id_map:
                edge_key = (edge.source_id, edge.target_id, edge.type)
                if edge_key not in edge_set:
                    formatted_edges.append({
                        "id": edge.id,
                        "source": edge.source_id,
                        "target": edge.target_id,
                        "label": edge.type,
                        "relationship": edge.type,
                        "confidence": edge.strength or 1.0,
                        "animated": True,
                        "markerEnd": {
                            "type": "arrowclosed",
                            "color": "#A855F7"
                        }
                    })
                    edge_set.add(edge_key)
                if edge.source_id in node_id_map and edge.target_id in node_id_map:
                    node_id_map[edge.source_id]["connections"].append(
                        node_id_map[edge.target_id]["label"]
                    )
                    node_id_map[edge.target_id]["connections"].append(
                        node_id_map[edge.source_id]["label"]
                    )

        for node in formatted_nodes:
            node["connections"] = list(set(node["connections"]))

        return {"nodes": formatted_nodes, "edges": formatted_edges}
    except Exception as e:
        import traceback
        print("Error getting graph:")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error generating memory graph: {str(e)}"
        )

@router.get("/entity/{node_id}")
async def get_entity(
    node_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get details for a single entity node, including connected content."""
    try:
        graph_service = get_graph_service()
        node = graph_service.get_node(node_id, "default_user")
        if not node:
            raise HTTPException(status_code=404, detail="Entity not found")

        related_nodes = graph_service.find_related_nodes(node_id, "default_user")
        all_metadata = _load_metadata("default_user", db)

        connected_documents = []
        connected_emails = []
        connected_calendar_events = []
        related_memories = []

        return {
            **node.model_dump(),
            "related_nodes": [n.model_dump() for n in related_nodes],
            "connected_documents": connected_documents,
            "connected_emails": connected_emails,
            "connected_calendar_events": connected_calendar_events,
            "related_memories": related_memories,
            "ai_explanation": f"This entity is part of your memory graph and has {len(related_nodes)} connections to other entities."
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
 
@router.get("/search")
async def search_entities(
    query: str = Query(...),
    type: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Search for entities by name (substring match)."""
    try:
        graph_service = get_graph_service()
        results = graph_service.search_nodes(query, "default_user", type)
        return [node.model_dump() for node in results]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/subgraph")
async def get_subgraph(
    node_ids: List[str] = Query(...),
    current_user: User = Depends(get_current_user)
):
    """Get subgraph containing specified nodes and connecting edges."""
    try:
        graph_service = get_graph_service()
        subgraph = graph_service.get_subgraph(node_ids, "default_user")
        return {
            "nodes": [n.model_dump() for n in subgraph["nodes"]],
            "edges": [e.model_dump() for e in subgraph["edges"]]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
 
@router.post("/highlight")
async def highlight_entities(
    query: str,
    current_user: User = Depends(get_current_user)
):
    """Search for entities and return a subgraph to highlight (for chat integration)."""
    try:
        graph_service = get_graph_service()
        results = graph_service.search_nodes(query, "default_user")
        if not results:
            return {"nodes": [], "edges": [], "highlighted_ids": []}

        node_ids = [node.id for node in results]
        subgraph = graph_service.get_subgraph(node_ids, "default_user")

        formatted_nodes = []
        for node in subgraph["nodes"]:
            color = NODE_COLORS.get(node.type, NODE_COLORS["Custom"])
            formatted_nodes.append({
                "id": node.id,
                "label": node.name,
                "category": node.type,
                "color": color,
                "radius": 35,
                "description": node.description or "",
                "type": node.type,
                "connections": [],
            })

        formatted_edges = []
        for edge in subgraph["edges"]:
            formatted_edges.append({
                "source": edge.source_id,
                "target": edge.target_id,
                "label": edge.type
            })

        return {
            "nodes": formatted_nodes,
            "edges": formatted_edges,
            "highlighted_ids": node_ids
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/recommendations")
async def get_smart_recommendations(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user)
):
    """Get smart recommendations based on importance, recency, and access."""
    try:
        graph_service = get_graph_service()
        recommendations = graph_service.get_smart_recommendations("default_user", limit=limit)

        formatted = []
        for node in recommendations:
            color = NODE_COLORS.get(node.type, NODE_COLORS["Custom"])
            formatted.append({
                **node.model_dump(),
                "color": color
            })

        return {"recommendations": formatted}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats")
async def get_graph_stats_endpoint(current_user: User = Depends(get_current_user)):
    """Get comprehensive graph statistics including communities, central nodes, etc."""
    try:
        graph_service = get_graph_service()
        return graph_service.get_stats("default_user")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/decay")
async def decay_graph(
    decay_rate: float = Query(0.01, ge=0.0, le=0.1),
    current_user: User = Depends(get_current_user)
):
    """Manually trigger importance decay for all nodes."""
    try:
        graph_service = get_graph_service()
        graph_service.decay_importance("default_user", decay_rate)
        return {"status": "success", "message": "Graph importance decayed successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
