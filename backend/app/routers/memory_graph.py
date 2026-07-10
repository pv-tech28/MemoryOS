"""
Memory Graph Router
Handles generation of memory graph data from documents and sources.
"""

import os
import json
from datetime import datetime
from fastapi import APIRouter, HTTPException
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api/memory-graph", tags=["memory-graph"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
METADATA_FILE = os.path.join(UPLOAD_DIR, "_metadata.json")


def _load_metadata() -> dict:
    """Load document metadata from disk."""
    if os.path.exists(METADATA_FILE):
        with open(METADATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


@router.get("")
async def get_memory_graph():
    """
    Generate and return memory graph data including nodes and edges
    from uploaded documents, sources, and their connections.
    """
    try:
        metadata = _load_metadata()
        documents = list(metadata.values()) if metadata else []

        # --- Nodes ---
        nodes = []
        node_ids = set()

        # 1. Add user as central node
        user_node = {
            "id": "user",
            "label": "User",
            "category": "Person",
            "color": "#4facfe",
            "radius": 45,
            "description": "Owner of this memory vault",
            "date": datetime.now().strftime("%d %b %Y"),
            "owner": "self",
            "type": "Person",
            "connections": [],
        }
        nodes.append(user_node)
        node_ids.add("user")

        # 2. Add document nodes
        for doc in documents:
            doc_id = doc["id"]
            filename = doc["filename"].replace(".pdf", "")
            if len(filename) > 20:
                filename = filename[:18] + "..."

            # Determine document category/type
            category = "Document"
            color = "#e84393"

            doc_node = {
                "id": f"doc_{doc_id}",
                "label": f"{filename}\n(PDF)",
                "category": category,
                "color": color,
                "radius": 30,
                "description": f"Uploaded document with {doc['page_count']} pages and {doc['chunk_count']} chunks",
                "date": datetime.fromisoformat(doc["uploaded_at"].rstrip("Z")).strftime("%d %b %Y"),
                "owner": "User",
                "type": "Document",
                "connections": [],
            }
            nodes.append(doc_node)
            node_ids.add(f"doc_{doc_id}")
            user_node["connections"].append(filename)

        # --- Edges ---
        edges = []

        # Connect all documents to user
        for doc in documents:
            doc_id = f"doc_{doc['id']}"
            edges.append(
                {
                    "source": "user",
                    "target": doc_id,
                    "label": "Uploaded",
                }
            )

        return {"nodes": nodes, "edges": edges}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating memory graph: {str(e)}",
        )
