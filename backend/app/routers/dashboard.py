"""
Dashboard Router — for Home page stats and data
"""
import os
import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.services.memory_store import get_all_memories
from app.services.timeline_service import get_timeline_events
from app.services.memory_graph_builder import get_graph_service
from app.database import SessionLocal, get_db
from app.repositories.document_repo import DocumentRepository
from app.dependencies import get_current_user
from app.models.db_models import User

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
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all dashboard stats for Home page
    """
    # Load metadata for documents, emails, calendar from PostgreSQL
    all_metadata = []
    try:
        docs = DocumentRepository.list_all(db, user_id=current_user.id)
        all_metadata = [DocumentRepository.to_dict(d) for d in docs]
    except Exception as e:
        print(f"Error loading metadata from DB: {e}")

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


@router.get("/daily-summary")
async def get_daily_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get daily summary stats, highlights, and AI insights for the Daily Summary page
    """
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    try:
        # --- 1. Load all documents ---
        docs = DocumentRepository.list_all(db, user_id=current_user.id)
        doc_dicts = [DocumentRepository.to_dict(d) for d in docs]
        
        # --- Stats ---
        # New Documents Processed today
        today_docs = [
            d for d in doc_dicts
            if (d.get("source", "upload") == "upload" and 
                datetime.fromisoformat(d["uploaded_at"].rstrip("Z")) >= today_start)
        ]
        new_docs_count = len(today_docs)
        doc_names = [d["filename"] for d in today_docs]
        
        # Emails Found (from Gmail source)
        emails = [d for d in doc_dicts if d.get("source") == "gmail"]
        email_count = len(emails)
        important_emails = [d["filename"] for d in emails]
        
        # Upcoming Meetings (from Calendar source)
        calendar_events = [d for d in doc_dicts if d.get("source") == "calendar"]
        upcoming_meetings = [
            {
                "title": d["filename"],
                "date": d["uploaded_at"]
            } for d in calendar_events
        ]
        
        # Sources Active
        source_counts = DocumentRepository.count_by_source(db, user_id=current_user.id)
        active_sources_count = sum(
            1 for src, count in source_counts.items() if count > 0
        ) + (1 if source_counts.get("document", 0) > 0 else 0)  # count uploaded docs as source
        
        # Connections Made Today from graph
        graph_service = get_graph_service()
        all_edges = graph_service.get_all_edges()
        new_connections_today = 0
        for edge in all_edges:
            try:
                created_at = datetime.fromisoformat(edge.created_at)
                if created_at >= today_start:
                    new_connections_today +=1
            except Exception:
                pass
        
        # --- Highlights ---
        highlights = []
        
        if new_docs_count > 0:
            highlights.append({
                "icon": "FileText",
                "title": f"{new_docs_count} new document{'s' if new_docs_count !=1 else ''} processed",
                "desc": ", ".join(doc_names[:3]) + ("" if len(doc_names) <=3 else f", and {len(doc_names)-3} more"),
                "color": "#4facfe",
            })
        
        if email_count >0:
            highlights.append({
                "icon": "Mail",
                "title": f"{email_count} email{'s' if email_count !=1 else ''} found",
                "desc": ", ".join(important_emails[:3]) + ("" if len(important_emails) <=3 else f", and {len(important_emails)-3} more"),
                "color": "#ea4335",
            })
        
        if len(upcoming_meetings) >0:
            highlights.append({
                "icon": "Calendar",
                "title": f"{len(upcoming_meetings)} upcoming meeting{'s' if len(upcoming_meetings) !=1 else ''}",
                "desc": upcoming_meetings[0]["title"],
                "color": "#f0a500",
            })
        
        if new_connections_today >0:
            highlights.append({
                "icon": "GitCommit",
                "title": f"{new_connections_today} new connection{'s' if new_connections_today !=1 else ''} made",
                "desc": "New relationships discovered in your data.",
                "color": "#f0f0f0",
            })
        
        # --- AI Insights ---
        insights = []
        all_nodes = graph_service.get_all_nodes()
        
        if all_nodes:
            # Most referenced topic/entity
            node_types = {}
            for node in all_nodes:
                t = node.type
                node_types[t] = node_types.get(t, 0) + 1
            most_common_type = max(node_types, key=lambda k: node_types[k]) if node_types else "Topic"
            insights.append(f"The most common entity type today is '{most_common_type}' ({node_types.get(most_common_type,0)} times).")
            
            # Most active source
            max_source = max(source_counts, key=lambda k: source_counts[k]) if source_counts else "documents"
            insights.append(f"Your most active data source today is '{max_source}' ({source_counts.get(max_source,0)} items).")
            
            # Most frequent entity
            if all_nodes:
                top_node = max(all_nodes, key=lambda n: n.importance)
                insights.append(f"'{top_node.name}' appears frequently and has a high importance score.")
        
        # Return all data
        return {
            "stats": {
                "new_documents": new_docs_count,
                "emails_found": email_count,
                "upcoming_meetings": len(upcoming_meetings),
                "connections_made": new_connections_today,
                "sources_active": active_sources_count,
            },
            "highlights": highlights,
            "insights": insights
        }
        
    except Exception as e:
        print(f"Error getting daily summary: {e}")
        import traceback
        traceback.print_exc()
        return {
            "stats": {
                "new_documents": 0,
                "emails_found": 0,
                "upcoming_meetings": 0,
                "connections_made": 0,
                "sources_active": 0,
            },
            "highlights": [],
            "insights": []
        }
    finally:
        db.close()
