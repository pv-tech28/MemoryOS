
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
from dotenv import load_dotenv
load_dotenv()

router = APIRouter(prefix="/api/settings", tags=["settings"])


# Helper: Get or create default user (since we don't have auth yet)
def get_or_create_default_user(db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == "default_user").first()
    if not user:
        user = User(
            id="default_user"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


# ─────────────────────────────────────────────────────────────────────────────
# Profile Management
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/profile")
async def get_profile(db: Session = Depends(get_db)):
    user = get_or_create_default_user(db)
    return {
        "id": user.id
    }


# ─────────────────────────────────────────────────────────────────────────────
# Connected Sources
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/connected-sources")
async def get_connected_sources(db: Session = Depends(get_db)):
    user = get_or_create_default_user(db)
    gmail_count = db.query(Document).filter(Document.user_id == user.id, Document.source == "gmail").count()
    drive_count = db.query(Document).filter(Document.user_id == user.id, Document.source == "drive").count()
    calendar_count = db.query(Document).filter(Document.user_id == user.id, Document.source == "calendar").count()
    
    has_google_creds = len(user.google_credentials) > 0
    
    return {
        "gmail": {
            "connected": has_google_creds,
            "count": gmail_count
        },
        "drive": {
            "connected": has_google_creds,
            "count": drive_count
        },
        "calendar": {
            "connected": has_google_creds,
            "count": calendar_count
        }
    }


# ─────────────────────────────────────────────────────────────────────────────
# Delete Data
# ─────────────────────────────────────────────────────────────────────────────
@router.delete("/data/documents")
async def delete_documents(db: Session = Depends(get_db)):
    user = get_or_create_default_user(db)
    db.query(Document).filter(Document.user_id == user.id, Document.source == "upload").delete()
    db.commit()
    return {"message": "All uploaded documents deleted"}


@router.delete("/data/memory-graph")
async def delete_memory_graph(db: Session = Depends(get_db)):
    user = get_or_create_default_user(db)
    # First delete all edges, then nodes
    db.query(GraphEdgeModel).filter(GraphEdgeModel.source_id.in_(
        db.query(GraphNodeModel.id).filter(GraphNodeModel.user_id == user.id)
    )).delete(synchronize_session=False)
    db.query(GraphEdgeModel).filter(GraphEdgeModel.target_id.in_(
        db.query(GraphNodeModel.id).filter(GraphNodeModel.user_id == user.id)
    )).delete(synchronize_session=False)
    db.query(GraphNodeModel).filter(GraphNodeModel.user_id == user.id).delete()
    db.commit()
    # Clear in-memory graph if the method exists
    try:
        get_graph_service().clear_graph()
    except:
        pass
    return {"message": "Memory graph deleted"}


@router.delete("/data/conversations")
async def delete_conversations(db: Session = Depends(get_db)):
    user = get_or_create_default_user(db)
    db.query(ChatMessage).filter(ChatMessage.chat_id.in_(
        db.query(Chat.id).filter(Chat.user_id == user.id)
    )).delete(synchronize_session=False)
    db.query(Chat).filter(Chat.user_id == user.id).delete()
    db.commit()
    return {"message": "All conversations deleted"}


@router.delete("/data/all")
async def delete_all_data(db: Session = Depends(get_db)):
    user = get_or_create_default_user(db)
    db.query(Document).filter(Document.user_id == user.id).delete()
    db.query(Memory).filter(Memory.user_id == user.id).delete()
    db.query(TimelineEventModel).filter(TimelineEventModel.user_id == user.id).delete()
    db.query(GraphEdgeModel).filter(GraphEdgeModel.source_id.in_(
        db.query(GraphNodeModel.id).filter(GraphNodeModel.user_id == user.id)
    )).delete(synchronize_session=False)
    db.query(GraphEdgeModel).filter(GraphEdgeModel.target_id.in_(
        db.query(GraphNodeModel.id).filter(GraphNodeModel.user_id == user.id)
    )).delete(synchronize_session=False)
    db.query(GraphNodeModel).filter(GraphNodeModel.user_id == user.id).delete()
    db.query(ChatMessage).filter(ChatMessage.chat_id.in_(
        db.query(Chat.id).filter(Chat.user_id == user.id)
    )).delete(synchronize_session=False)
    db.query(Chat).filter(Chat.user_id == user.id).delete()
    db.commit()
    try:
        get_graph_service().clear_graph()
    except:
        pass
    return {"message": "All data deleted"}


# ─────────────────────────────────────────────────────────────────────────────
# Data & Storage Statistics
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/storage/stats")
async def get_storage_stats(db: Session = Depends(get_db)):
    user = get_or_create_default_user(db)
    doc_count = db.query(Document).filter(Document.user_id == user.id).count()
    memory_count = db.query(Memory).filter(Memory.user_id == user.id).count()
    node_count = db.query(GraphNodeModel).filter(GraphNodeModel.user_id == user.id).count()
    edge_count = db.query(GraphEdgeModel).filter(GraphEdgeModel.source_id.in_(
        db.query(GraphNodeModel.id).filter(GraphNodeModel.user_id == user.id)
    )).count()
    
    total_file_size = db.query(Document).filter(Document.user_id == user.id).with_entities(
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


# ─────────────────────────────────────────────────────────────────────────────
# Connected Sources
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/connected-sources")
async def get_connected_sources(db: Session = Depends(get_db)):
    user = get_or_create_default_user(db)
    gmail_count = db.query(Document).filter(Document.user_id == user.id, Document.source == "gmail").count()
    drive_count = db.query(Document).filter(Document.user_id == user.id, Document.source == "drive").count()
    calendar_count = db.query(Document).filter(Document.user_id == user.id, Document.source == "calendar").count()
    
    has_google_creds = len(user.google_credentials) > 0
    
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


@router.post("/connected-sources/{source}/sync")
async def sync_source(source: str, db: Session = Depends(get_db)):
    user = get_or_create_default_user(db)
    # TODO: Call actual sync functions here (from sources.py)
    print(f"[SYNC] Syncing {source} for user {user.id}")
    return {"message": f"Sync started for {source}"}


@router.delete("/connected-sources/{source}")
async def disconnect_source(source: str, db: Session = Depends(get_db)):
    user = get_or_create_default_user(db)
    # TODO: Implement actual disconnect logic
    print(f"[DISCONNECT] Disconnecting {source} for user {user.id}")
    return {"message": f"{source} disconnected"}


# ─────────────────────────────────────────────────────────────────────────────
# Delete Data
# ─────────────────────────────────────────────────────────────────────────────
@router.delete("/data/documents")
async def delete_documents(db: Session = Depends(get_db)):
    user = get_or_create_default_user(db)
    db.query(Document).filter(Document.user_id == user.id, Document.source == "upload").delete()
    db.commit()
    return {"message": "All uploaded documents deleted"}


@router.delete("/data/memory-graph")
async def delete_memory_graph(db: Session = Depends(get_db)):
    user = get_or_create_default_user(db)
    # First delete all edges, then nodes
    db.query(GraphEdgeModel).filter(GraphEdgeModel.source_id.in_(
        db.query(GraphNodeModel.id).filter(GraphNodeModel.user_id == user.id)
    )).delete(synchronize_session=False)
    db.query(GraphEdgeModel).filter(GraphEdgeModel.target_id.in_(
        db.query(GraphNodeModel.id).filter(GraphNodeModel.user_id == user.id)
    )).delete(synchronize_session=False)
    db.query(GraphNodeModel).filter(GraphNodeModel.user_id == user.id).delete()
    db.commit()
    get_graph_service().clear_graph()  # Also clear in-memory graph
    return {"message": "Memory graph deleted"}


@router.delete("/data/conversations")
async def delete_conversations(db: Session = Depends(get_db)):
    user = get_or_create_default_user(db)
    db.query(ChatMessage).filter(ChatMessage.chat_id.in_(
        db.query(Chat.id).filter(Chat.user_id == user.id)
    )).delete(synchronize_session=False)
    db.query(Chat).filter(Chat.user_id == user.id).delete()
    db.commit()
    return {"message": "All conversations deleted"}


@router.delete("/data/gmail")
async def delete_gmail_data(db: Session = Depends(get_db)):
    user = get_or_create_default_user(db)
    db.query(Document).filter(Document.user_id == user.id, Document.source == "gmail").delete()
    db.commit()
    return {"message": "Gmail data deleted"}


@router.delete("/data/drive")
async def delete_drive_data(db: Session = Depends(get_db)):
    user = get_or_create_default_user(db)
    db.query(Document).filter(Document.user_id == user.id, Document.source == "drive").delete()
    db.commit()
    return {"message": "Google Drive data deleted"}


@router.delete("/data/calendar")
async def delete_calendar_data(db: Session = Depends(get_db)):
    user = get_or_create_default_user(db)
    db.query(Document).filter(Document.user_id == user.id, Document.source == "calendar").delete()
    db.commit()
    return {"message": "Google Calendar data deleted"}


@router.delete("/data/all")
async def delete_all_data(db: Session = Depends(get_db)):
    user = get_or_create_default_user(db)
    db.query(Document).filter(Document.user_id == user.id).delete()
    db.query(Memory).filter(Memory.user_id == user.id).delete()
    db.query(TimelineEventModel).filter(TimelineEventModel.user_id == user.id).delete()
    db.query(GraphEdgeModel).filter(GraphEdgeModel.source_id.in_(
        db.query(GraphNodeModel.id).filter(GraphNodeModel.user_id == user.id)
    )).delete(synchronize_session=False)
    db.query(GraphEdgeModel).filter(GraphEdgeModel.target_id.in_(
        db.query(GraphNodeModel.id).filter(GraphNodeModel.user_id == user.id)
    )).delete(synchronize_session=False)
    db.query(GraphNodeModel).filter(GraphNodeModel.user_id == user.id).delete()
    db.query(ChatMessage).filter(ChatMessage.chat_id.in_(
        db.query(Chat.id).filter(Chat.user_id == user.id)
    )).delete(synchronize_session=False)
    db.query(Chat).filter(Chat.user_id == user.id).delete()
    db.commit()
    get_graph_service().clear_graph()  # Also clear in-memory graph
    return {"message": "All data deleted"}


# ─────────────────────────────────────────────────────────────────────────────
# Data & Storage Statistics
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/storage/stats")
async def get_storage_stats(db: Session = Depends(get_db)):
    user = get_or_create_default_user(db)
    doc_count = db.query(Document).filter(Document.user_id == user.id).count()
    memory_count = db.query(Memory).filter(Memory.user_id == user.id).count()
    node_count = db.query(GraphNodeModel).filter(GraphNodeModel.user_id == user.id).count()
    edge_count = db.query(GraphEdgeModel).filter(GraphEdgeModel.source_id.in_(
        db.query(GraphNodeModel.id).filter(GraphNodeModel.user_id == user.id)
    )).count()
    
    total_file_size = db.query(Document).filter(Document.user_id == user.id).with_entities(
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
