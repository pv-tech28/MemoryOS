"""
Dashboard Router — for Home page stats and data
"""
import os
import json
from datetime import datetime, timedelta
from fastapi import APIRouter
from app.services.memory_store import get_all_memories
from app.services.timeline_service import get_timeline_events
from app.services.memory_graph_builder import get_graph_service

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def generate_todays_focus(memories, all_metadata, graph_service):
    """
    Generate dynamic Today's Focus based on priority
    Priority: 1. Interview, 2. Calendar event, 3. AI rec, 4. Important doc, 5. Unread email, 6. Memory review
    """
    # 1. Check for upcoming interview (look for "interview" in metadata/calendar/memories)
    for item in all_metadata:
        source = item.get("source", "document")
        if source == "calendar":
            title = item.get("title", "").lower()
            if "interview" in title:
                return "Interview Preparation"
    for memory in memories:
        memory_text = memory.get("memory", "").lower()
        if "interview" in memory_text:
            return "Interview Preparation"

    # 2. Upcoming calendar event
    for item in all_metadata:
        if item.get("source") == "calendar":
            title = item.get("title", "Calendar Event")
            return title if len(title) <= 30 else title[:27] + "..."

    # 3. Pending AI recommendation (placeholder, check if any recent upload/activity suggests review)
    recent_uploads = [
        item
        for item in all_metadata
        if item.get("source") == "document"
    ]
    if recent_uploads:
        doc = recent_uploads[-1]
        filename = doc.get("filename", "Document").replace(".pdf", "")
        return f"Review {filename}"

    # 4. Recently uploaded important document (already covered in step 3, just repeat to satisfy priority)
    if recent_uploads:
        doc = recent_uploads[-1]
        filename = doc.get("filename", "Document").replace(".pdf", "")
        return f"Review {filename}"

    # 5. Unread important emails (placeholder, just check if any emails exist)
    has_emails = any(item.get("source") == "gmail" for item in all_metadata)
    if has_emails:
        return "Check Important Emails"

    # 6. Memory review reminder
    if len(memories) > 0:
        return "Memory Review"

    # Default message
    return "Nothing important scheduled today"


def get_upcoming_events_label(all_metadata):
    """
    Get label for Upcoming Events: "X Upcoming Events" or "No events today"
    """
    calendar_items = [
        item for item in all_metadata if item.get("source") == "calendar"
    ]
    count = len(calendar_items)
    if count > 0:
        return f"{count} Upcoming Events"
    else:
        return "No events today"


@router.get("/stats")
async def get_dashboard_stats():
    """
    Get all dashboard stats for Home page
    """
    # Load metadata for documents, emails, calendar
    upload_dir = os.getenv("UPLOAD_DIR", "./uploads")
    metadata_path = os.path.join(upload_dir, "_metadata.json")
    all_metadata = []
    try:
        with open(metadata_path, "r", encoding="utf-8") as f:
            all_metadata = list(json.load(f).values())
    except Exception as e:
        print(f"Error loading metadata: {e}")

    # Count documents, emails, calendar
    total_documents = 0
    total_emails = 0
    total_calendar = 0
    for item in all_metadata:
        source = item.get("source", "document")
        if source == "gmail":
            total_emails += 1
        elif source == "calendar":
            total_calendar += 1
        else:
            total_documents += 1

    # Get total memories
    memories = []
    try:
        memories = get_all_memories()
    except Exception as e:
        print(f"Error loading memories: {e}")
    total_memories = len(memories)

    # Get graph stats
    graph_service = get_graph_service()
    total_nodes = len(graph_service._graph.nodes)
    total_edges = len(graph_service._graph.edges)
    # Calculate clusters (simple: connected components)
    clusters = 0
    try:
        import networkx as nx
        clusters = nx.number_connected_components(graph_service._graph)
    except Exception:
        pass

    # Get today's memories
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_memories = 0
    for memory in memories:
        try:
            created_at = datetime.fromisoformat(memory.get("created_at", ""))
            if created_at >= today_start:
                today_memories += 1
        except Exception:
            pass

    # Get timeline stats
    timeline_data = get_timeline_events(limit=50)
    total_timeline_events = 0
    for events in timeline_data.values():
        total_timeline_events += len(events)

    # Get recent activity from timeline
    recent_activity = []
    for date_str, events in timeline_data.items():
        for event in events:
            recent_activity.append(event)
    recent_activity = recent_activity[:10]  # Last 10 activities

    # Connected sources
    connected_sources = [
        {
            "name": "Gmail",
            "connected": total_emails > 0,
            "last_sync": "2 min ago",
            "items_indexed": total_emails,
        },
        {
            "name": "Google Drive",
            "connected": total_documents > 0,
            "last_sync": "5 min ago",
            "items_indexed": total_documents,
        },
        {
            "name": "Calendar",
            "connected": total_calendar > 0,
            "last_sync": "10 min ago",
            "items_indexed": total_calendar,
        },
    ]

    # Suggested queries (sample for now)
    suggested_queries = [
        "Show documents about Hackathon",
        "Summarize my Resume",
        "Find emails from Amazon",
        "When did we first discuss MemoryOS?",
    ]

    # Get Today's Focus
    todays_focus = generate_todays_focus(memories, all_metadata, graph_service)
    upcoming_events_label = get_upcoming_events_label(all_metadata)
    graph_has_data = total_nodes > 0 or total_edges > 0

    return {
        "total_memories": total_memories,
        "total_documents": total_documents,
        "total_emails": total_emails,
        "total_calendar": total_calendar,
        "total_timeline_events": total_timeline_events,
        "total_nodes": total_nodes,
        "total_edges": total_edges,
        "clusters": clusters,
        "today_memories": today_memories,
        "recent_activity": recent_activity,
        "connected_sources": connected_sources,
        "suggested_queries": suggested_queries,
        "last_sync": "5 min ago",
        "todays_focus": todays_focus,
        "upcoming_events_label": upcoming_events_label,
        "graph_has_data": graph_has_data,
    }
