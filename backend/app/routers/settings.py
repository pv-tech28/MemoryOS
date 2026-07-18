
"""
Settings Router — handles all user settings endpoints:
profile, email, security, appearance, notifications, language, etc.
"""

from datetime import datetime, UTC
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.db_models import User, Document, GraphNodeModel, GraphEdgeModel, Memory, Chat, ChatMessage, TimelineEventModel
from app.services.memory_graph_builder import get_graph_service
from app.dependencies import get_current_user
from dotenv import load_dotenv
load_dotenv()

router = APIRouter(prefix="/api/settings", tags=["settings"])


# ─────────────────────────────────────────────────────────────────────────────
# Profile Management
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/profile")
async def get_profile(
    current_user: User = Depends(get_current_user)
):
    return {
        "id": current_user.id,
        "full_name": current_user.full_name,
        "username": current_user.username,
        "email": current_user.email,
        "avatar_url": current_user.avatar_url
    }


# ─────────────────────────────────────────────────────────────────────────────
# Connected Sources
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/connected-sources")
async def get_connected_sources(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    gmail_count = db.query(Document).filter(Document.user_id == current_user.id, Document.source == "gmail").count()
    drive_count = db.query(Document).filter(Document.user_id == current_user.id, Document.source == "drive").count()
    calendar_count = db.query(Document).filter(Document.user_id == current_user.id, Document.source == "calendar").count()
    
    has_google_creds = len(current_user.google_credentials) > 0
    
    return {
        "gmail": {
            "connected": has_google_creds,
            "last_sync": datetime.now(UTC).isoformat() if has_google_creds else None,
            "count": gmail_count
        },
        "drive": {
            "connected": has_google_creds,
            "last_sync": datetime.now(UTC).isoformat() if has_google_creds else None,
            "count": drive_count
        },
        "calendar": {
            "connected": has_google_creds,
            "last_sync": datetime.now(UTC).isoformat() if has_google_creds else None,
            "count": calendar_count
        }
    }


# ─────────────────────────────────────────────────────────────────────────────
# Delete Data
# ─────────────────────────────────────────────────────────────────────────────
@router.delete("/data/documents")
async def delete_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(Document).filter(Document.user_id == current_user.id, Document.source == "upload").delete()
    db.commit()
    return {"message": "All uploaded documents deleted"}


@router.delete("/data/memory-graph")
async def delete_memory_graph(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # First delete all edges, then nodes
    db.query(GraphEdgeModel).filter(GraphEdgeModel.source_id.in_(
        db.query(GraphNodeModel.id).filter(GraphNodeModel.user_id == current_user.id)
    )).delete(synchronize_session=False)
    db.query(GraphEdgeModel).filter(GraphEdgeModel.target_id.in_(
        db.query(GraphNodeModel.id).filter(GraphNodeModel.user_id == current_user.id)
    )).delete(synchronize_session=False)
    db.query(GraphNodeModel).filter(GraphNodeModel.user_id == current_user.id).delete()
    db.commit()
    # Clear in-memory graph if the method exists
    try:
        get_graph_service().clear_graph(user_id=current_user.id)
    except:
        pass
    return {"message": "Memory graph deleted"}


@router.delete("/data/conversations")
async def delete_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(ChatMessage).filter(ChatMessage.chat_id.in_(
        db.query(Chat.id).filter(Chat.user_id == current_user.id)
    )).delete(synchronize_session=False)
    db.query(Chat).filter(Chat.user_id == current_user.id).delete()
    db.commit()
    return {"message": "All conversations deleted"}


@router.delete("/data/gmail")
async def delete_gmail_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(Document).filter(Document.user_id == current_user.id, Document.source == "gmail").delete()
    db.commit()
    return {"message": "Gmail data deleted"}


@router.delete("/data/drive")
async def delete_drive_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(Document).filter(Document.user_id == current_user.id, Document.source == "drive").delete()
    db.commit()
    return {"message": "Google Drive data deleted"}


@router.delete("/data/calendar")
async def delete_calendar_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(Document).filter(Document.user_id == current_user.id, Document.source == "calendar").delete()
    db.commit()
    return {"message": "Google Calendar data deleted"}


@router.delete("/data/all")
async def delete_all_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(Document).filter(Document.user_id == current_user.id).delete()
    db.query(Memory).filter(Memory.user_id == current_user.id).delete()
    db.query(TimelineEventModel).filter(TimelineEventModel.user_id == current_user.id).delete()
    db.query(GraphEdgeModel).filter(GraphEdgeModel.source_id.in_(
        db.query(GraphNodeModel.id).filter(GraphNodeModel.user_id == current_user.id)
    )).delete(synchronize_session=False)
    db.query(GraphEdgeModel).filter(GraphEdgeModel.target_id.in_(
        db.query(GraphNodeModel.id).filter(GraphNodeModel.user_id == current_user.id)
    )).delete(synchronize_session=False)
    db.query(GraphNodeModel).filter(GraphNodeModel.user_id == current_user.id).delete()
    db.query(ChatMessage).filter(ChatMessage.chat_id.in_(
        db.query(Chat.id).filter(Chat.user_id == current_user.id)
    )).delete(synchronize_session=False)
    db.query(Chat).filter(Chat.user_id == current_user.id).delete()
    db.commit()
    try:
        get_graph_service().clear_graph(user_id=current_user.id)
    except:
        pass
    return {"message": "All data deleted"}


# ─────────────────────────────────────────────────────────────────────────────
# Data & Storage Statistics
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/storage/stats")
async def get_storage_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    doc_count = db.query(Document).filter(Document.user_id == current_user.id).count()
    memory_count = db.query(Memory).filter(Memory.user_id == current_user.id).count()
    node_count = db.query(GraphNodeModel).filter(GraphNodeModel.user_id == current_user.id).count()
    edge_count = db.query(GraphEdgeModel).filter(GraphEdgeModel.source_id.in_(
        db.query(GraphNodeModel.id).filter(GraphNodeModel.user_id == current_user.id)
    )).count()
    
    total_file_size = db.query(Document).filter(Document.user_id == current_user.id).with_entities(
        db.func.sum(Document.file_size)
    ).scalar() or 0
    
    return {
        "documents_uploaded": doc_count,
        "memories_stored": memory_count,
        "memory_nodes": node_count,
        "graph_connections": edge_count,
        "storage_used_bytes": total_file_size,
        "storage_used_mb": round(total_file_size / (1024 * 1024), 2)
    }


@router.post("/connected-sources/{source}/sync")
async def sync_source(
    source: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # TODO: Call actual sync functions here (from sources.py)
    print(f"[SYNC] Syncing {source} for user {current_user.id}")
    return {"message": f"Sync started for {source}"}


@router.delete("/connected-sources/{source}")
async def disconnect_source(
    source: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # TODO: Implement actual disconnect logic
    print(f"[DISCONNECT] Disconnecting {source} for user {current_user.id}")
    return {"message": f"{source} disconnected"}
