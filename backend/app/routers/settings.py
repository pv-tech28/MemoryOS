
"""
Settings Router — handles all user settings endpoints:
profile, email, security, appearance, notifications, language, etc.
"""

from datetime import datetime, UTC
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.db_models import User, UserSettings, Document, GraphNodeModel, GraphEdgeModel, Memory, Chat, ChatMessage, TimelineEventModel
from app.models.schemas import ProfileUpdate, ProfileResponse, EmailUpdate, PasswordChange, TwoFactorUpdate
from app.services.memory_graph_builder import get_graph_service
import shutil
import os
from dotenv import load_dotenv
load_dotenv()

router = APIRouter(prefix="/api/settings", tags=["settings"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
os.makedirs(os.path.join(UPLOAD_DIR, "profile_pics"), exist_ok=True)


# Helper: Get or create default user (since we don't have auth yet)
def get_or_create_default_user(db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == "default_user").first()
    if not user:
        user = User(
            id="default_user",
            email=None,
            display_name=None,
            username=None,
            bio=None,
            email_verified=False
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        settings = UserSettings(user_id=user.id)
        db.add(settings)
        db.commit()
    else:
        if not user.settings:
            settings = UserSettings(user_id=user.id)
            db.add(settings)
            db.commit()
    return user


# ─────────────────────────────────────────────────────────────────────────────
# Profile Management
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/profile", response_model=ProfileResponse)
async def get_profile(db: Session = Depends(get_db)):
    user = get_or_create_default_user(db)
    return ProfileResponse(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        username=user.username,
        bio=user.bio,
        profile_picture_url=user.profile_picture_url,
        email_verified=user.email_verified
    )


@router.put("/profile", response_model=ProfileResponse)
async def update_profile(
    data: ProfileUpdate,
    db: Session = Depends(get_db)
):
    user = get_or_create_default_user(db)
    if data.display_name is not None:
        user.display_name = data.display_name
    if data.username is not None:
        # Check username uniqueness
        existing = db.query(User).filter(User.username == data.username).first()
        if existing and existing.id != user.id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")
        user.username = data.username
    if data.bio is not None:
        user.bio = data.bio
    db.commit()
    db.refresh(user)
    return ProfileResponse(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        username=user.username,
        bio=user.bio,
        profile_picture_url=user.profile_picture_url,
        email_verified=user.email_verified
    )


@router.post("/profile/picture")
async def upload_profile_picture(file: UploadFile = File(...), db: Session = Depends(get_db)):
    user = get_or_create_default_user(db)
    
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{user.id}{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, "profile_pics", unique_filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    user.profile_picture_url = f"/uploads/profile_pics/{unique_filename}"
    db.commit()
    db.refresh(user)
    
    return {"profile_picture_url": user.profile_picture_url}


# ─────────────────────────────────────────────────────────────────────────────
# Email Management
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/email")
async def get_email(db: Session = Depends(get_db)):
    user = get_or_create_default_user(db)
    return {
        "email": user.email,
        "email_verified": user.email_verified
    }


@router.put("/email")
async def update_email(data: EmailUpdate, db: Session = Depends(get_db)):
    user = get_or_create_default_user(db)
    existing = db.query(User).filter(User.email == data.new_email).first()
    if existing and existing.id != user.id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")
    user.email = data.new_email
    user.email_verified = False
    db.commit()
    return {"email": user.email, "email_verified": user.email_verified}


@router.post("/email/send-verification")
async def send_verification_email(db: Session = Depends(get_db)):
    user = get_or_create_default_user(db)
    # TODO: Implement actual email sending here
    print(f"[EMAIL] Would send verification email to {user.email}")
    return {"message": "Verification email sent"}


@router.post("/email/verify")
async def verify_email(code: str, db: Session = Depends(get_db)):
    user = get_or_create_default_user(db)
    # TODO: Implement actual verification logic here
    user.email_verified = True
    db.commit()
    return {"email_verified": user.email_verified}


# ─────────────────────────────────────────────────────────────────────────────
# Password & Security
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/password/change")
async def change_password(
    data: PasswordChange,
    db: Session = Depends(get_db)
):
    user = get_or_create_default_user(db)
    # TODO: Replace with actual password hashing and verification
    # For now, just update the password_hash to a placeholder
    user.password_hash = f"hashed_{data.new_password}"
    db.commit()
    return {"message": "Password changed successfully"}


@router.put("/security/two-factor")
async def update_two_factor(data: TwoFactorUpdate, db: Session = Depends(get_db)):
    # TODO: Implement two factor authentication
    return {"two_factor_enabled": data.enabled}


# ─────────────────────────────────────────────────────────────────────────────
# User Settings (all settings categories)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/all")
async def get_all_settings(db: Session = Depends(get_db)):
    user = get_or_create_default_user(db)
    settings = user.settings
    return {
        "theme": settings.theme,
        "push_notifications": settings.push_notifications,
        "email_notifications": settings.email_notifications,
        "daily_summary_notifications": settings.daily_summary_notifications,
        "memory_update_notifications": settings.memory_update_notifications,
        "sync_completion_notifications": settings.sync_completion_notifications,
        "ai_activity_notifications": settings.ai_activity_notifications,
        "sound_enabled": settings.sound_enabled,
        "language": settings.language,
        "data_sharing_enabled": settings.data_sharing_enabled,
        "ai_training_consent": settings.ai_training_consent,
        "store_chat_history": settings.store_chat_history,
        "memory_retention_period": settings.memory_retention_period,
        "auto_memory_extraction": settings.auto_memory_extraction,
        "auto_graph_building": settings.auto_graph_building,
        "auto_daily_summary": settings.auto_daily_summary,
        "auto_source_sync": settings.auto_source_sync,
        "auto_ai_insights": settings.auto_ai_insights,
        "ai_provider": settings.ai_provider,
        "response_length": settings.response_length,
        "creativity_level": settings.creativity_level
    }


@router.put("/all")
async def update_all_settings(
    theme: str | None = None,
    push_notifications: bool | None = None,
    email_notifications: bool | None = None,
    daily_summary_notifications: bool | None = None,
    memory_update_notifications: bool | None = None,
    sync_completion_notifications: bool | None = None,
    ai_activity_notifications: bool | None = None,
    sound_enabled: bool | None = None,
    language: str | None = None,
    data_sharing_enabled: bool | None = None,
    ai_training_consent: bool | None = None,
    store_chat_history: bool | None = None,
    memory_retention_period: str | None = None,
    auto_memory_extraction: bool | None = None,
    auto_graph_building: bool | None = None,
    auto_daily_summary: bool | None = None,
    auto_source_sync: bool | None = None,
    auto_ai_insights: bool | None = None,
    ai_provider: str | None = None,
    response_length: str | None = None,
    creativity_level: str | None = None,
    db: Session = Depends(get_db)
):
    user = get_or_create_default_user(db)
    settings = user.settings
    if theme is not None:
        settings.theme = theme
    if push_notifications is not None:
        settings.push_notifications = push_notifications
    if email_notifications is not None:
        settings.email_notifications = email_notifications
    if daily_summary_notifications is not None:
        settings.daily_summary_notifications = daily_summary_notifications
    if memory_update_notifications is not None:
        settings.memory_update_notifications = memory_update_notifications
    if sync_completion_notifications is not None:
        settings.sync_completion_notifications = sync_completion_notifications
    if ai_activity_notifications is not None:
        settings.ai_activity_notifications = ai_activity_notifications
    if sound_enabled is not None:
        settings.sound_enabled = sound_enabled
    if language is not None:
        settings.language = language
    if data_sharing_enabled is not None:
        settings.data_sharing_enabled = data_sharing_enabled
    if ai_training_consent is not None:
        settings.ai_training_consent = ai_training_consent
    if store_chat_history is not None:
        settings.store_chat_history = store_chat_history
    if memory_retention_period is not None:
        settings.memory_retention_period = memory_retention_period
    if auto_memory_extraction is not None:
        settings.auto_memory_extraction = auto_memory_extraction
    if auto_graph_building is not None:
        settings.auto_graph_building = auto_graph_building
    if auto_daily_summary is not None:
        settings.auto_daily_summary = auto_daily_summary
    if auto_source_sync is not None:
        settings.auto_source_sync = auto_source_sync
    if auto_ai_insights is not None:
        settings.auto_ai_insights = auto_ai_insights
    if ai_provider is not None:
        settings.ai_provider = ai_provider
    if response_length is not None:
        settings.response_length = response_length
    if creativity_level is not None:
        settings.creativity_level = creativity_level
    db.commit()
    return {
        "theme": settings.theme,
        "push_notifications": settings.push_notifications,
        "email_notifications": settings.email_notifications,
        "daily_summary_notifications": settings.daily_summary_notifications,
        "memory_update_notifications": settings.memory_update_notifications,
        "sync_completion_notifications": settings.sync_completion_notifications,
        "ai_activity_notifications": settings.ai_activity_notifications,
        "sound_enabled": settings.sound_enabled,
        "language": settings.language,
        "data_sharing_enabled": settings.data_sharing_enabled,
        "ai_training_consent": settings.ai_training_consent,
        "store_chat_history": settings.store_chat_history,
        "memory_retention_period": settings.memory_retention_period,
        "auto_memory_extraction": settings.auto_memory_extraction,
        "auto_graph_building": settings.auto_graph_building,
        "auto_daily_summary": settings.auto_daily_summary,
        "auto_source_sync": settings.auto_source_sync,
        "auto_ai_insights": settings.auto_ai_insights,
        "ai_provider": settings.ai_provider,
        "response_length": settings.response_length,
        "creativity_level": settings.creativity_level
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
