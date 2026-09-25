
"""
Settings Router — handles all user settings endpoints:
profile, email, security, appearance, notifications, language, etc.
"""

import os
import uuid
from datetime import datetime, UTC
from pathlib import Path
from typing import Optional
from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models.db_models import (
    User, Document, DocumentChunk, GraphNodeModel, GraphEdgeModel, Memory,
    Chat, ChatMessage, TimelineEventModel, UserSettingsModel
)
from app.services.memory_graph_builder import get_graph_service
from app.services.vector_store import delete_document as vs_delete
from app.dependencies import get_current_user
from app.routers.auth import hash_password, verify_password
from app.repositories.auth_repo import AuthRepository
from dotenv import load_dotenv
load_dotenv()

router = APIRouter(prefix="/api/settings", tags=["settings"])


# ─────────────────────────────────────────────────────────────────────────────
# Profile Management
# ─────────────────────────────────────────────────────────────────────────────
class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = None
    full_name: Optional[str] = None
    username: Optional[str] = None
    bio: Optional[str] = None


@router.get("/profile")
async def get_profile(
    current_user: User = Depends(get_current_user)
):
    avatar = current_user.avatar_url
    return {
        "id": current_user.id,
        "email": current_user.email or "",
        "full_name": current_user.full_name or "",
        "display_name": current_user.full_name or current_user.username or "",
        "username": current_user.username or "",
        "bio": current_user.bio or "",
        "avatar_url": avatar,
        "profile_picture_url": avatar,
        "email_verified": bool(current_user.email),
    }


@router.put("/profile")
async def update_profile(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        user = current_user
        db.add(user)

    if data.display_name is not None:
        user.full_name = data.display_name
    elif data.full_name is not None:
        user.full_name = data.full_name

    if data.username is not None:
        clean_username = data.username.strip()
        if clean_username:
            existing = db.query(User).filter(User.username == clean_username, User.id != user.id).first()
            if existing:
                raise HTTPException(status_code=400, detail="Username is already taken")
            user.username = clean_username
        else:
            user.username = None

    if data.bio is not None:
        user.bio = data.bio

    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)

    avatar = user.avatar_url
    return {
        "id": user.id,
        "email": user.email or "",
        "full_name": user.full_name or "",
        "display_name": user.full_name or user.username or "",
        "username": user.username or "",
        "bio": user.bio or "",
        "avatar_url": avatar,
        "profile_picture_url": avatar,
        "email_verified": bool(user.email),
    }


@router.post("/profile/picture")
async def upload_profile_picture(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        user = current_user
        db.add(user)

    upload_dir = Path("uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    safe_filename = f"avatar_{user.id}_{uuid.uuid4().hex[:8]}{file_ext}"
    target_path = upload_dir / safe_filename

    contents = await file.read()
    with open(target_path, "wb") as f:
        f.write(contents)

    url_path = f"/uploads/{safe_filename}"
    user.avatar_url = url_path
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)

    return {
        "profile_picture_url": url_path,
        "avatar_url": url_path
    }


# ─────────────────────────────────────────────────────────────────────────────
# Email Settings
# ─────────────────────────────────────────────────────────────────────────────
class UpdateEmailRequest(BaseModel):
    new_email: EmailStr


@router.get("/email")
async def get_email(
    current_user: User = Depends(get_current_user)
):
    return {
        "email": current_user.email or "",
        "email_verified": bool(current_user.email)
    }


@router.put("/email")
async def update_email(
    data: UpdateEmailRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        user = current_user
        db.add(user)

    existing = db.query(User).filter(User.email == data.new_email, User.id != user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email is already in use")

    user.email = data.new_email
    user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user)

    return {
        "email": user.email,
        "email_verified": True
    }


@router.post("/email/send-verification")
async def send_verification(
    current_user: User = Depends(get_current_user)
):
    return {"message": "Verification email sent successfully"}


# ─────────────────────────────────────────────────────────────────────────────
# Password & Security
# ─────────────────────────────────────────────────────────────────────────────
class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/password/change")
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        user = current_user
        db.add(user)

    if user.password_hash:
        if not verify_password(data.current_password, user.password_hash):
            raise HTTPException(status_code=400, detail="Incorrect current password")

    user.password_hash = hash_password(data.new_password)
    user.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Password changed successfully"}


class TwoFactorRequest(BaseModel):
    enabled: bool


@router.put("/security/two-factor")
async def update_two_factor(
    data: TwoFactorRequest,
    current_user: User = Depends(get_current_user)
):
    return {"two_factor_enabled": data.enabled}


# ─────────────────────────────────────────────────────────────────────────────
# User Preferences & App Settings
# ─────────────────────────────────────────────────────────────────────────────
def get_or_create_settings(db: Session, user_id: str) -> UserSettingsModel:
    settings = db.query(UserSettingsModel).filter(UserSettingsModel.user_id == user_id).first()
    if not settings:
        settings = UserSettingsModel(user_id=user_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def serialize_settings(settings: UserSettingsModel) -> dict:
    return {
        "theme": settings.theme or "dark",
        "push_notifications": bool(settings.push_notifications),
        "email_notifications": bool(settings.email_notifications),
        "daily_summary_notifications": bool(settings.daily_summary_notifications),
        "memory_update_notifications": bool(settings.memory_update_notifications),
        "sync_completion_notifications": bool(settings.sync_completion_notifications),
        "ai_activity_notifications": bool(settings.ai_activity_notifications),
        "sound_enabled": bool(settings.sound_enabled),
        "language": settings.language or "en",
        "data_sharing_enabled": bool(settings.data_sharing_enabled),
        "ai_training_consent": bool(settings.ai_training_consent),
        "store_chat_history": bool(settings.store_chat_history),
        "memory_retention_period": settings.memory_retention_period or "forever",
        "auto_memory_extraction": bool(settings.auto_memory_extraction),
        "auto_graph_building": bool(settings.auto_graph_building),
        "auto_daily_summary": bool(settings.auto_daily_summary),
        "auto_source_sync": bool(settings.auto_source_sync),
        "auto_ai_insights": bool(settings.auto_ai_insights),
        "ai_provider": settings.ai_provider or "gemini",
        "response_length": settings.response_length or "medium",
        "creativity_level": settings.creativity_level or "medium",
    }


@router.get("/all")
async def get_all_settings_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    settings = get_or_create_settings(db, current_user.id)
    return serialize_settings(settings)


@router.put("/all")
async def update_all_settings_endpoint(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    settings = get_or_create_settings(db, current_user.id)

    data = {}
    try:
        data = await request.json()
    except Exception:
        pass

    query_params = dict(request.query_params)
    data.update(query_params)

    bool_fields = {
        "push_notifications", "email_notifications", "daily_summary_notifications",
        "memory_update_notifications", "sync_completion_notifications", "ai_activity_notifications",
        "sound_enabled", "data_sharing_enabled", "ai_training_consent", "store_chat_history",
        "auto_memory_extraction", "auto_graph_building", "auto_daily_summary",
        "auto_source_sync", "auto_ai_insights"
    }

    for k, v in data.items():
        if hasattr(settings, k):
            if k in bool_fields and isinstance(v, str):
                v = v.lower() in ("true", "1", "yes")
            setattr(settings, k, v)

    settings.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(settings)
    return serialize_settings(settings)


# ─────────────────────────────────────────────────────────────────────────────
# Connected Sources
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/connected-sources")
async def get_connected_sources(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_id = current_user.id if current_user and current_user.id else "demo-user-id"
    gmail_count = db.query(Document).filter(Document.user_id == user_id, Document.source == "gmail").count()
    drive_count = db.query(Document).filter(Document.user_id == user_id, Document.source == "drive").count()
    calendar_count = db.query(Document).filter(Document.user_id == user_id, Document.source == "calendar").count()
    
    has_google_creds = AuthRepository.has_credentials(db, user_id)

    def get_last_sync(count: int, source: str):
        if not has_google_creds:
            return None
        last_doc = (
            db.query(Document)
            .filter(Document.user_id == user_id, Document.source == source)
            .order_by(Document.uploaded_at.desc())
            .first()
        )
        if last_doc and last_doc.uploaded_at:
            return last_doc.uploaded_at.isoformat()
        return datetime.now(UTC).isoformat() if count > 0 else None

    return {
        "gmail": {
            "connected": has_google_creds,
            "last_sync": get_last_sync(gmail_count, "gmail"),
            "count": gmail_count
        },
        "drive": {
            "connected": has_google_creds,
            "last_sync": get_last_sync(drive_count, "drive"),
            "count": drive_count
        },
        "calendar": {
            "connected": has_google_creds,
            "last_sync": get_last_sync(calendar_count, "calendar"),
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
    docs = db.query(Document).filter(Document.user_id == current_user.id, Document.source == "upload").all()
    for d in docs:
        if d.file_path and os.path.exists(d.file_path):
            try:
                os.remove(d.file_path)
            except Exception:
                pass
        vs_delete(d.id)
    doc_ids = [d.id for d in docs]
    if doc_ids:
        db.query(DocumentChunk).filter(DocumentChunk.document_id.in_(doc_ids)).delete(synchronize_session=False)
        db.query(Document).filter(Document.id.in_(doc_ids)).delete(synchronize_session=False)
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
    docs = db.query(Document).filter(Document.user_id == current_user.id, Document.source == "gmail").all()
    for d in docs:
        vs_delete(d.id)
    doc_ids = [d.id for d in docs]
    if doc_ids:
        db.query(DocumentChunk).filter(DocumentChunk.document_id.in_(doc_ids)).delete(synchronize_session=False)
        db.query(Document).filter(Document.id.in_(doc_ids)).delete(synchronize_session=False)
    db.commit()
    return {"message": "Gmail data deleted"}


@router.delete("/data/drive")
async def delete_drive_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    docs = db.query(Document).filter(Document.user_id == current_user.id, Document.source == "drive").all()
    for d in docs:
        vs_delete(d.id)
    doc_ids = [d.id for d in docs]
    if doc_ids:
        db.query(DocumentChunk).filter(DocumentChunk.document_id.in_(doc_ids)).delete(synchronize_session=False)
        db.query(Document).filter(Document.id.in_(doc_ids)).delete(synchronize_session=False)
    db.commit()
    return {"message": "Google Drive data deleted"}


@router.delete("/data/calendar")
async def delete_calendar_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    docs = db.query(Document).filter(Document.user_id == current_user.id, Document.source == "calendar").all()
    for d in docs:
        vs_delete(d.id)
    doc_ids = [d.id for d in docs]
    if doc_ids:
        db.query(DocumentChunk).filter(DocumentChunk.document_id.in_(doc_ids)).delete(synchronize_session=False)
        db.query(Document).filter(Document.id.in_(doc_ids)).delete(synchronize_session=False)
    db.commit()
    return {"message": "Google Calendar data deleted"}


@router.delete("/data/all")
async def delete_all_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    docs = db.query(Document).filter(Document.user_id == current_user.id).all()
    for d in docs:
        if d.file_path and os.path.exists(d.file_path):
            try:
                os.remove(d.file_path)
            except Exception:
                pass
        vs_delete(d.id)
    doc_ids = [d.id for d in docs]
    if doc_ids:
        db.query(DocumentChunk).filter(DocumentChunk.document_id.in_(doc_ids)).delete(synchronize_session=False)
        db.query(Document).filter(Document.id.in_(doc_ids)).delete(synchronize_session=False)
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
    user_id = current_user.id if current_user and current_user.id else "demo-user-id"
    doc_count = db.query(Document).filter(Document.user_id == user_id).count()
    memory_count = db.query(Memory).filter(Memory.user_id == user_id).count()
    node_count = db.query(GraphNodeModel).filter(GraphNodeModel.user_id == user_id).count()
    edge_count = db.query(GraphEdgeModel).filter(GraphEdgeModel.source_id.in_(
        db.query(GraphNodeModel.id).filter(GraphNodeModel.user_id == user_id)
    )).count()
    
    total_file_size = db.query(func.sum(Document.file_size)).filter(Document.user_id == user_id).scalar() or 0
    
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
