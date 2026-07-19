"""
Conversation Memory Service — now backed by PostgreSQL via ChatRepository.
Preserves identical function signatures so chat.py router requires zero changes.
"""

from typing import Optional, List, Dict, Any
from app.database import SessionLocal
from app.repositories.chat_repo import ChatRepository


def _get_db():
    """Get a new database session for standalone service calls."""
    return SessionLocal()


def create_chat(document_id: Optional[str] = None, user_id: str = "default_user") -> str:
    """Create a new chat session and return its ID."""
    db = _get_db()
    try:
        chat_id = ChatRepository.create_chat(db, document_id, user_id)
        db.commit()
        return chat_id
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def save_message(
    chat_id: str,
    role: str,
    content: str,
    sources: Optional[List[Dict[str, Any]]] = None,
    confidence: Optional[float] = None,
    document_name: Optional[str] = None,
    processing_time: Optional[float] = None,
) -> None:
    """Save a message to the chat history."""
    db = _get_db()
    try:
        ChatRepository.save_message(
            db, chat_id, role, content,
            sources, confidence, document_name, processing_time,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_chat_history(chat_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Retrieve the last N messages from the chat history."""
    db = _get_db()
    try:
        return ChatRepository.get_history(db, chat_id, limit)
    finally:
        db.close()


def get_full_chat(chat_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve the full chat object."""
    db = _get_db()
    try:
        return ChatRepository.get_full_chat(db, chat_id)
    finally:
        db.close()


def clear_chat(chat_id: str) -> bool:
    """Clear all messages from a specific chat."""
    db = _get_db()
    try:
        result = ChatRepository.clear_chat(db, chat_id)
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def delete_chat(chat_id: str) -> bool:
    """Delete a chat entirely."""
    db = _get_db()
    try:
        result = ChatRepository.delete_chat(db, chat_id)
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
