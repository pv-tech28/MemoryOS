"""
Graph Repository — replaces knowledge_graph.json persistence.
PostgreSQL is the source of truth; NetworkX is loaded from DB on startup.
"""

import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from app.models.db_models import GraphNodeModel, GraphEdgeModel


DEFAULT_USER_ID = "default"


class GraphRepository:
    """CRUD operations for graph nodes and edges in PostgreSQL."""

    # ── Node operations ──────────────────────────────────────────────────

    @staticmethod
    def create_node(
        db: Session,
        node_id: str,
        name: str,
        node_type: str,
        description: Optional[str] = None,
        importance: float = 0.5,
        metadata: Optional[dict] = None,
        user_id: str = DEFAULT_USER_ID,
    ) -> GraphNodeModel:
        """Create a new graph node."""
        now = datetime.utcnow()
        node = GraphNodeModel(
            id=node_id,
            user_id=user_id,
            name=name,
            type=node_type,
            description=description,
            importance=importance,
            metadata_json=metadata or {},
            access_count=0,
            created_at=now,
            updated_at=now,
        )
        db.add(node)
        db.flush()
        return node

    @staticmethod
    def get_node(db: Session, node_id: str) -> Optional[GraphNodeModel]:
        """Get a node by ID."""
        return db.query(GraphNodeModel).filter(GraphNodeModel.id == node_id).first()

    @staticmethod
    def update_node(
        db: Session,
        node_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        importance: Optional[float] = None,
        metadata: Optional[dict] = None,
    ) -> bool:
        """Update an existing node."""
        node = db.query(GraphNodeModel).filter(GraphNodeModel.id == node_id).first()
        if not node:
            return False
        if name is not None:
            node.name = name
        if description is not None:
            node.description = description
        if importance is not None:
            node.importance = importance
        if metadata is not None:
            node.metadata_json = metadata
        node.updated_at = datetime.utcnow()
        db.flush()
        return True

    @staticmethod
    def get_all_nodes(db: Session, user_id: str = DEFAULT_USER_ID) -> List[GraphNodeModel]:
        """Get all nodes for a user."""
        return db.query(GraphNodeModel).filter(GraphNodeModel.user_id == user_id).all()

    @staticmethod
    def search_nodes(db: Session, query: str, user_id: str = DEFAULT_USER_ID) -> List[GraphNodeModel]:
        """Search nodes by name (case-insensitive substring)."""
        return (
            db.query(GraphNodeModel)
            .filter(
                GraphNodeModel.user_id == user_id,
                func.lower(GraphNodeModel.name).contains(query.lower()),
            )
            .order_by(GraphNodeModel.importance.desc())
            .all()
        )

    @staticmethod
    def find_by_name_and_type(
        db: Session, name: str, node_type: str, user_id: str = DEFAULT_USER_ID
    ) -> Optional[GraphNodeModel]:
        """Find a node by exact name + type (case-insensitive)."""
        return (
            db.query(GraphNodeModel)
            .filter(
                GraphNodeModel.user_id == user_id,
                func.lower(GraphNodeModel.name) == name.strip().lower(),
                func.lower(GraphNodeModel.type) == node_type.lower(),
            )
            .first()
        )

    @staticmethod
    def increment_importance(db: Session, node_id: str, amount: float = 0.05) -> None:
        """Increment importance and access_count for a node."""
        node = db.query(GraphNodeModel).filter(GraphNodeModel.id == node_id).first()
        if node:
            node.importance = min(1.0, (node.importance or 0.5) + amount)
            node.access_count = (node.access_count or 0) + 1
            node.last_accessed = datetime.utcnow()
            node.updated_at = datetime.utcnow()
            db.flush()

    @staticmethod
    def decay_all(db: Session, decay_rate: float = 0.01, user_id: str = DEFAULT_USER_ID) -> None:
        """Decay importance of all nodes."""
        nodes = db.query(GraphNodeModel).filter(GraphNodeModel.user_id == user_id).all()
        now = datetime.utcnow()
        for node in nodes:
            node.importance = max(0.0, (node.importance or 0.5) - decay_rate)
            node.updated_at = now
        db.flush()

    @staticmethod
    def delete_node(db: Session, node_id: str) -> bool:
        """Delete a node (cascades to edges)."""
        node = db.query(GraphNodeModel).filter(GraphNodeModel.id == node_id).first()
        if not node:
            return False
        db.delete(node)
        db.flush()
        return True

    # ── Edge operations ──────────────────────────────────────────────────

    @staticmethod
    def create_edge(
        db: Session,
        edge_id: str,
        source_id: str,
        target_id: str,
        edge_type: str,
        description: Optional[str] = None,
        strength: float = 1.0,
    ) -> GraphEdgeModel:
        """Create a new graph edge."""
        edge = GraphEdgeModel(
            id=edge_id,
            source_id=source_id,
            target_id=target_id,
            type=edge_type,
            description=description,
            strength=strength,
            access_count=0,
            created_at=datetime.utcnow(),
        )
        db.add(edge)
        db.flush()
        return edge

    @staticmethod
    def find_edge(
        db: Session, source_id: str, target_id: str, edge_type: str
    ) -> Optional[GraphEdgeModel]:
        """Find an existing edge by source + target + type."""
        return (
            db.query(GraphEdgeModel)
            .filter(
                GraphEdgeModel.source_id == source_id,
                GraphEdgeModel.target_id == target_id,
                GraphEdgeModel.type == edge_type,
            )
            .first()
        )

    @staticmethod
    def update_edge(
        db: Session,
        edge_id: str,
        description: Optional[str] = None,
        strength: Optional[float] = None,
    ) -> bool:
        """Update an existing edge."""
        edge = db.query(GraphEdgeModel).filter(GraphEdgeModel.id == edge_id).first()
        if not edge:
            return False
        if description is not None:
            edge.description = description
        if strength is not None:
            edge.strength = strength
        db.flush()
        return True

    @staticmethod
    def get_all_edges(db: Session, user_id: str = DEFAULT_USER_ID) -> List[GraphEdgeModel]:
        """Get all edges (joined through nodes belonging to user)."""
        return (
            db.query(GraphEdgeModel)
            .join(GraphNodeModel, GraphEdgeModel.source_id == GraphNodeModel.id)
            .filter(GraphNodeModel.user_id == user_id)
            .all()
        )

    @staticmethod
    def get_edges_for_node(db: Session, node_id: str) -> List[GraphEdgeModel]:
        """Get all edges connected to a node (as source or target)."""
        return (
            db.query(GraphEdgeModel)
            .filter(
                or_(
                    GraphEdgeModel.source_id == node_id,
                    GraphEdgeModel.target_id == node_id,
                )
            )
            .all()
        )

    # ── Conversion helpers ───────────────────────────────────────────────

    @staticmethod
    def node_to_dict(node: GraphNodeModel) -> Dict[str, Any]:
        """Convert node ORM to dict matching EntityNode format."""
        return {
            "id": node.id,
            "name": node.name,
            "type": node.type,
            "description": node.description,
            "importance": node.importance or 0.5,
            "metadata": node.metadata_json or {},
            "access_count": node.access_count or 0,
            "last_accessed": node.last_accessed.isoformat() if node.last_accessed else None,
            "created_at": node.created_at.isoformat() if node.created_at else "",
            "updated_at": node.updated_at.isoformat() if node.updated_at else "",
        }

    @staticmethod
    def edge_to_dict(edge: GraphEdgeModel) -> Dict[str, Any]:
        """Convert edge ORM to dict matching RelationshipEdge format."""
        return {
            "id": edge.id,
            "source_id": edge.source_id,
            "target_id": edge.target_id,
            "type": edge.type,
            "description": edge.description,
            "strength": edge.strength or 1.0,
            "access_count": edge.access_count or 0,
            "last_accessed": edge.last_accessed.isoformat() if edge.last_accessed else None,
            "created_at": edge.created_at.isoformat() if edge.created_at else "",
        }
