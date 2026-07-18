
"""
Memory Graph Router
Handles generation of memory graph data from documents, sources, and extracted entities.
Reverted to show all nodes (as requested by user).
"""

import os
import json
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import Optional, List
from app.services.memory_graph_builder import (
    get_graph_service,
    EntityNode,
    RelationshipEdge
)

from app.database import SessionLocal
from app.repositories.document_repo import DocumentRepository

load_dotenv()

router = APIRouter(prefix="/api/memory-graph", tags=["memory-graph"])


def _load_metadata() -> dict:
    """Load document metadata from PostgreSQL."""
    db = SessionLocal()
    try:
        return DocumentRepository.to_metadata_dict(db, user_id="default_user")
    finally:
        db.close()



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
async def get_memory_graph():
    """
    Get full knowledge graph including all nodes and edges, plus document/source nodes.
    """
    try:
        graph_service = get_graph_service()
        nodes = graph_service.get_all_nodes()
        edges = graph_service.get_all_edges()
        
        # Format for frontend
        formatted_nodes = []
        node_id_map = {}

        
        # Add entity nodes
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
        
        # Load and add document/source nodes
        metadata = _load_metadata()
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
        
        # Format edges and build connections
        formatted_edges = []
        edge_set = set()
        
        # Add entity edges only (from graph service, no duplicate Connected edges!)
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
                # Add connections for display
                if edge.source_id in node_id_map and edge.target_id in node_id_map:
                    node_id_map[edge.source_id]["connections"].append(
                        node_id_map[edge.target_id]["label"]
                    )
                    node_id_map[edge.target_id]["connections"].append(
                        node_id_map[edge.source_id]["label"]
                    )
        
        # Remove duplicate connections
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
async def get_entity(node_id: str):
    """Get details for a single entity node, including connected content."""
    try:
        graph_service = get_graph_service()
        node = graph_service.get_node(node_id)
        if not node:
            raise HTTPException(status_code=404, detail="Entity not found")
        
        # Get related entities
        related_nodes = graph_service.find_related_nodes(node_id)
        
        # Get connected documents/emails/calendar events from database
        all_metadata = _load_metadata()

        
        connected_documents = []
        connected_emails = []
        connected_calendar_events = []
        
        # Load memories
        from app.services.memory_store import get_relevant_memories
        related_memories = get_relevant_memories(query_text=node.name, limit=5)
        
        # Return everything!
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
    type: Optional[str] = None
):
    """Search for entities by name (substring match)."""
    try:
        graph_service = get_graph_service()
        results = graph_service.search_nodes(query, type)
        return [node.model_dump() for node in results]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/subgraph")
async def get_subgraph(
    node_ids: List[str] = Query(...)
):
    """Get subgraph containing specified nodes and their connecting edges."""
    try:
        graph_service = get_graph_service()
        subgraph = graph_service.get_subgraph(node_ids)
        return {
            "nodes": [n.model_dump() for n in subgraph["nodes"]],
            "edges": [e.model_dump() for e in subgraph["edges"]]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/highlight")
async def highlight_entities(query: str):
    """Search for entities and return a subgraph to highlight (for chat integration)."""
    try:
        graph_service = get_graph_service()
        results = graph_service.search_nodes(query)
        if not results:
            return {"nodes": [], "edges": [], "highlighted_ids": []}
        
        node_ids = [node.id for node in results]
        subgraph = graph_service.get_subgraph(node_ids)
        
        # Format as frontend-compatible nodes/edges
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
async def get_smart_recommendations(limit: int = Query(10, ge=1, le=50)):
    """Get smart recommendations based on importance, recency, and access."""
    try:
        graph_service = get_graph_service()
        recommendations = graph_service.get_smart_recommendations(limit=limit)
        
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
async def get_graph_stats():
    """Get comprehensive graph statistics including communities, central nodes, etc."""
    try:
        graph_service = get_graph_service()
        return graph_service.get_stats()
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/decay")
async def decay_graph(decay_rate: float = Query(0.01, ge=0.0, le=0.1)):
    """Manually trigger importance decay for all nodes."""
    try:
        graph_service = get_graph_service()
        graph_service.decay_importance(decay_rate)
        return {"status": "success", "message": "Graph importance decayed successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
