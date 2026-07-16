"""
Chat Repository — replaces in-memory _chat_memory dict in conversation_memory.py.
"""

import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.models.db_models import Chat, ChatMessage


DEFAULT_USER_ID = "default"


class ChatRepository:

    @staticmethod
    def create_chat(
        db: Session,
        document_id: Optional[str] = None,
        user_id: str = DEFAULT_USER_ID,
    ) -> str:
        """Create a new chat session and return its ID."""
        chat_id = str(uuid.uuid4())
        chat = Chat(
            id=chat_id,
            user_id=user_id,
            document_id=document_id,
            created_at=datetime.utcnow(),
        )
        db.add(chat)
        db.flush()
        return chat_id

    @staticmethod
    def save_message(
        db: Session,
        chat_id: str,
        role: str,
        content: str,
        sources: Optional[List[Dict[str, Any]]] = None,
        confidence: Optional[float] = None,
        document_name: Optional[str] = None,
        processing_time: Optional[float] = None,
    ) -> None:
        """Save a message to a chat. Creates the chat if it doesn't exist."""
        # Auto-create chat if missing
        chat = db.query(Chat).filter(Chat.id == chat_id).first()
        if not chat:
            chat = Chat(id=chat_id, user_id=DEFAULT_USER_ID, created_at=datetime.utcnow())
            db.add(chat)
            db.flush()

        msg = ChatMessage(
            id=str(uuid.uuid4()),
            chat_id=chat_id,
            role=role,
            content=content,
            sources=sources,
            confidence=confidence,
            document_name=document_name,
            processing_time=processing_time,
            created_at=datetime.utcnow(),
        )
        db.add(msg)
        db.flush()

    @staticmethod
    def get_history(db: Session, chat_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Retrieve the last N messages from a chat."""
        msgs = (
            db.query(ChatMessage)
            .filter(ChatMessage.chat_id == chat_id)
            .order_by(ChatMessage.created_at.asc())
            .all()
        )
        # Return the last `limit` messages
        result = []
        for m in msgs[-limit:]:
            result.append({
                "role": m.role,
                "content": m.content,
                "timestamp": m.created_at.isoformat() if m.created_at else "",
                "sources": m.sources or [],
                "confidence": m.confidence,
                "document_name": m.document_name,
                "processing_time": m.processing_time,
            })
        return result

    @staticmethod
    def get_full_chat(db: Session, chat_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve the full chat object."""
        chat = db.query(Chat).filter(Chat.id == chat_id).first()
        if not chat:
            return None
        msgs = (
            db.query(ChatMessage)
            .filter(ChatMessage.chat_id == chat_id)
            .order_by(ChatMessage.created_at.asc())
            .all()
        )
        return {
            "document_id": chat.document_id,
            "messages": [
                {
                    "role": m.role,
                    "content": m.content,
                    "timestamp": m.created_at.isoformat() if m.created_at else "",
                    "sources": m.sources or [],
                    "confidence": m.confidence,
                    "document_name": m.document_name,
                    "processing_time": m.processing_time,
                }
                for m in msgs
            ],
            "created_at": chat.created_at.isoformat() if chat.created_at else "",
        }

    @staticmethod
    def clear_chat(db: Session, chat_id: str) -> bool:
        """Clear all messages from a chat (keep the chat record)."""
        chat = db.query(Chat).filter(Chat.id == chat_id).first()
        if not chat:
            return False
        db.query(ChatMessage).filter(ChatMessage.chat_id == chat_id).delete()
        db.flush()
        return True

    @staticmethod
    def delete_chat(db: Session, chat_id: str) -> bool:
        """Delete an entire chat and its messages."""
        chat = db.query(Chat).filter(Chat.id == chat_id).first()
        if not chat:
            return False
        db.delete(chat)  # cascade deletes messages
        db.flush()
        return True
