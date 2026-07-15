
"""
Timeline Service - tracks all events for the EVOLVE AI timeline.
"""
import os
import json
import uuid
from datetime import datetime
from typing import List, Dict
from app.models.schemas import TimelineEvent


TIMELINE_FILE = os.getenv("TIMELINE_FILE", "./timeline_events.json")


def _ensure_file() -> None:
    """Ensure timeline file exists and is initialized."""
    if not os.path.exists(TIMELINE_FILE):
        with open(TIMELINE_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)


def _load_events() -> List[Dict]:
    """Load all timeline events from file."""
    _ensure_file()
    try:
        with open(TIMELINE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return []


def _save_events(events: List[Dict]) -> None:
    """Save timeline events to file."""
    _ensure_file()
    try:
        with open(TIMELINE_FILE, "w", encoding="utf-8") as f:
            json.dump(events, f, indent=2)
    except Exception as e:
        print(f"[Timeline Service] Error saving events: {e}")


def add_timeline_event(
    title: str,
    description: str,
    event_type: str,
    color: str = "#25d366",
    related_document: str = None,
    related_memory: str = None,
    related_graph_node: str = None
) -> TimelineEvent:
    """
    Add a new event to the timeline.
    
    Args:
        title: Event title
        description: Event description
        event_type: Type of event (pdf_upload, chat, memory, etc.)
        color: Color for the timeline dot
        related_document: Optional document ID
        related_memory: Optional memory ID
        related_graph_node: Optional graph node ID
    
    Returns:
        Created TimelineEvent
    """
    events = _load_events()
    event_id = str(uuid.uuid4())
    
    # Color map for event types
    color_map = {
        "pdf_upload": "#e84393",
        "chat": "#00d68f",
        "memory": "#6c5ce7",
        "memory_update": "#a29bfe",
        "gmail_sync": "#ea4335",
        "drive_sync": "#34a853",
        "calendar_sync": "#fbbc04",
        "graph_update": "#25d366",
        "document_processing": "#f0a500",
        "ai_summary": "#1abc9c"
    }
    final_color = color_map.get(event_type, color)
    
    event = {
        "id": event_id,
        "title": title,
        "description": description,
        "timestamp": datetime.now().isoformat(),
        "event_type": event_type,
        "color": final_color,
        "related_document": related_document,
        "related_memory": related_memory,
        "related_graph_node": related_graph_node
    }
    
    events.append(event)
    _save_events(events)
    
    return TimelineEvent(**event)


def get_timeline_events(limit: int = 100) -> Dict[str, List[TimelineEvent]]:
    """
    Get timeline events, grouped by date and sorted newest first.
    
    Args:
        limit: Maximum number of events to return
    
    Returns:
        Dictionary with date strings as keys and list of TimelineEvent as values
    """
    events = _load_events()
    
    # Sort newest first
    events.sort(key=lambda x: x["timestamp"], reverse=True)
    
    # Take latest N events
    events = events[:limit]
    
    # Group by date
    grouped = {}
    for event_dict in events:
        event = TimelineEvent(**event_dict)
        date = datetime.fromisoformat(event.timestamp).strftime("%d %b %Y")
        if date not in grouped:
            grouped[date] = []
        grouped[date].append(event)
    
    return grouped


def delete_timeline_event(event_id: str) -> bool:
    """
    Delete a timeline event by ID.
    
    Args:
        event_id: ID of event to delete
    
    Returns:
        True if deleted, False if not found
    """
    events = _load_events()
    initial_length = len(events)
    events = [event for event in events if event.get("id") != event_id]
    if len(events) != initial_length:
        _save_events(events)
        return True
    return False

