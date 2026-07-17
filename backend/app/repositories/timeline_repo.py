"""
Timeline Repository — replaces timeline_events.json file operations.
"""

import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.models.db_models import TimelineEventModel


DEFAULT_USER_ID = "default_user"

# Color map for event types
COLOR_MAP = {
    "pdf_upload": "#e84393",
    "chat": "#00d68f",
    "memory": "#6c5ce7",
    "memory_update": "#a29bfe",
    "gmail_sync": "#ea4335",
    "drive_sync": "#34a853",
    "calendar_sync": "#fbbc04",
    "graph_update": "#25d366",
    "document_processing": "#f0a500",
    "ai_summary": "#1abc9c",
}


class TimelineRepository:

    @staticmethod
    def add_event(
        db: Session,
        title: str,
        description: str,
        event_type: str,
        color: str = "#25d366",
        related_document: Optional[str] = None,
        related_memory: Optional[str] = None,
        related_graph_node: Optional[str] = None,
        user_id: str = DEFAULT_USER_ID,
    ) -> Dict[str, Any]:
        """Add a new timeline event. Returns the event as a dict."""
        final_color = COLOR_MAP.get(event_type, color)
        event_id = str(uuid.uuid4())
        now = datetime.utcnow()

        event = TimelineEventModel(
            id=event_id,
            user_id=user_id,
            title=title,
            description=description,
            event_type=event_type,
            color=final_color,
            related_document=related_document,
            related_memory=related_memory,
            related_graph_node=related_graph_node,
            created_at=now,
        )
        db.add(event)
        db.flush()
        return TimelineRepository._to_dict(event)

    @staticmethod
    def get_events(
        db: Session,
        limit: int = 100,
        user_id: str = DEFAULT_USER_ID,
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get timeline events grouped by date, newest first.
        Returns { "16 Jul 2026": [ {event}, … ], … }
        """
        events = (
            db.query(TimelineEventModel)
            .filter(TimelineEventModel.user_id == user_id)
            .order_by(TimelineEventModel.created_at.desc())
            .limit(limit)
            .all()
        )
        grouped: Dict[str, List[Dict[str, Any]]] = {}
        for ev in events:
            d = TimelineRepository._to_dict(ev)
            date_str = ev.created_at.strftime("%d %b %Y") if ev.created_at else "Unknown"
            if date_str not in grouped:
                grouped[date_str] = []
            grouped[date_str].append(d)
        return grouped

    @staticmethod
    def get_events_flat(
        db: Session,
        limit: int = 100,
        user_id: str = DEFAULT_USER_ID,
    ) -> List[Dict[str, Any]]:
        """Get timeline events as a flat list, newest first."""
        events = (
            db.query(TimelineEventModel)
            .filter(TimelineEventModel.user_id == user_id)
            .order_by(TimelineEventModel.created_at.desc())
            .limit(limit)
            .all()
        )
        return [TimelineRepository._to_dict(ev) for ev in events]

    @staticmethod
    def delete_event(db: Session, event_id: str) -> bool:
        """Delete a timeline event by ID."""
        ev = db.query(TimelineEventModel).filter(TimelineEventModel.id == event_id).first()
        if not ev:
            return False
        db.delete(ev)
        db.flush()
        return True

    @staticmethod
    def count(db: Session, user_id: str = DEFAULT_USER_ID) -> int:
        """Count total timeline events."""
        return db.query(TimelineEventModel).filter(TimelineEventModel.user_id == user_id).count()

    @staticmethod
    def _to_dict(ev: TimelineEventModel) -> Dict[str, Any]:
        """Convert ORM event to dict matching the old JSON format."""
        return {
            "id": ev.id,
            "title": ev.title,
            "description": ev.description or "",
            "timestamp": ev.created_at.isoformat() if ev.created_at else "",
            "event_type": ev.event_type,
            "color": ev.color,
            "related_document": ev.related_document,
            "related_memory": ev.related_memory,
            "related_graph_node": ev.related_graph_node,
        }
