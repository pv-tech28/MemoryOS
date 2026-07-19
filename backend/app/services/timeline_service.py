"""
Timeline Service — now backed by PostgreSQL via TimelineRepository.
Preserves identical function signatures so all callers require zero changes.
"""

from typing import Optional, List, Dict
from app.database import SessionLocal
from app.repositories.timeline_repo import TimelineRepository
from app.models.schemas import TimelineEvent


def _get_db():
    """Get a new database session for standalone service calls."""
    return SessionLocal()


def add_timeline_event(
    title: str,
    description: str,
    event_type: str,
    color: str = "#25d366",
    related_document: Optional[str] = None,
    related_memory: Optional[str] = None,
    related_graph_node: Optional[str] = None,
    user_id: str = "default_user",
) -> TimelineEvent:
    """
    Add a new event to the timeline.
    Returns a TimelineEvent pydantic model.
    """
    db = _get_db()
    try:
        event_dict = TimelineRepository.add_event(
            db,
            title=title,
            description=description,
            event_type=event_type,
            color=color,
            related_document=related_document,
            related_memory=related_memory,
            related_graph_node=related_graph_node,
            user_id=user_id
        )
        db.commit()
        return TimelineEvent(**event_dict)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_timeline_events(limit: int = 100, user_id: str = "default_user") -> Dict[str, List[TimelineEvent]]:
    """
    Get timeline events, grouped by date and sorted newest first.
    Returns { "16 Jul 2026": [TimelineEvent, …], … }
    """
    db = _get_db()
    try:
        grouped = TimelineRepository.get_events(db, limit, user_id)
        # Convert dicts to TimelineEvent models
        result = {}
        for date_str, events in grouped.items():
            result[date_str] = [TimelineEvent(**ev) for ev in events]
        return result
    finally:
        db.close()


def delete_timeline_event(event_id: str, user_id: str = "default_user") -> bool:
    """Delete a timeline event by ID."""
    db = _get_db()
    try:
        result = TimelineRepository.delete_event(db, event_id)
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
