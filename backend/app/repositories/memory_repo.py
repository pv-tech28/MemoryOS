"""
Memory Repository — replaces raw SQLite operations in memory_store.py.
"""

import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.db_models import Memory


DEFAULT_USER_ID = "default_user"


class MemoryRepository:

    @staticmethod
    def create(
        db: Session,
        chat_id: str,
        memory_type: str,
        memory_text: str,
        importance: float = 0.5,
        user_id: str = DEFAULT_USER_ID,
    ) -> str:
        """Create a new memory and return its ID."""
        memory_id = str(uuid.uuid4())
        now = datetime.utcnow()
        mem = Memory(
            id=memory_id,
            chat_id=chat_id,
            user_id=user_id,
            type=memory_type,
            memory=memory_text,
            importance=importance,
            recency=0.0,
            frequency=0,
            last_accessed=now,
            access_count=0,
            created_at=now,
            updated_at=now,
        )
        db.add(mem)
        db.flush()
        return memory_id

    @staticmethod
    def increment_access(db: Session, memory_id: str, importance_increment: float = 0.05) -> None:
        """Increment access count and update importance."""
        mem = db.query(Memory).filter(Memory.id == memory_id).first()
        if mem:
            mem.access_count = (mem.access_count or 0) + 1
            mem.frequency = (mem.frequency or 0) + 1
            mem.last_accessed = datetime.utcnow()
            mem.importance = min(1.0, (mem.importance or 0.5) + importance_increment)
            mem.updated_at = datetime.utcnow()
            db.flush()

    @staticmethod
    def get_by_chat_id(
        db: Session,
        chat_id: str,
        limit: Optional[int] = None,
        min_importance: float = 0.0,
    ) -> List[Dict[str, Any]]:
        """Retrieve memories for a specific chat."""
        q = (
            db.query(Memory)
            .filter(Memory.chat_id == chat_id, Memory.importance >= min_importance)
            .order_by(Memory.created_at.desc())
        )
        if limit:
            q = q.limit(limit)
        return [MemoryRepository._to_dict(m) for m in q.all()]

    @staticmethod
    def get_relevant(
        db: Session,
        query_text: str,
        chat_id: Optional[str] = None,
        user_id: str = DEFAULT_USER_ID,
        limit: int = 10,
        min_importance: float = 0.3,
    ) -> List[Dict[str, Any]]:
        """Retrieve relevant memories ordered by importance."""
        q = db.query(Memory).filter(
            Memory.user_id == user_id,
            Memory.importance >= min_importance,
        )
        if chat_id:
            q = q.filter(Memory.chat_id == chat_id)
        q = q.order_by(Memory.importance.desc(), Memory.created_at.desc()).limit(limit)
        memories = [MemoryRepository._to_dict(m) for m in q.all()]

        # Increment access counts for retrieved memories
        for mem in memories:
            MemoryRepository.increment_access(db, mem["id"])

        return memories

    @staticmethod
    def update(
        db: Session,
        memory_id: str,
        memory_text: Optional[str] = None,
        importance: Optional[float] = None,
        memory_type: Optional[str] = None,
    ) -> bool:
        """Update an existing memory."""
        mem = db.query(Memory).filter(Memory.id == memory_id).first()
        if not mem:
            return False
        if memory_text is not None:
            mem.memory = memory_text
        if importance is not None:
            mem.importance = importance
        if memory_type is not None:
            mem.type = memory_type
        mem.updated_at = datetime.utcnow()
        db.flush()
        return True

    @staticmethod
    def find_existing(
        db: Session,
        memory_text: str,
        memory_type: str,
        user_id: str = DEFAULT_USER_ID,
    ) -> Optional[Dict[str, Any]]:
        """Find an existing memory by similarity (substring) for deduplication."""
        memory_lower = memory_text.strip().lower()
        # Try exact type match first
        mem = (
            db.query(Memory)
            .filter(
                Memory.user_id == user_id,
                Memory.type == memory_type,
                func.lower(Memory.memory).contains(memory_lower),
            )
            .first()
        )
        if mem:
            return MemoryRepository._to_dict(mem)
        # Try any type
        mem = (
            db.query(Memory)
            .filter(
                Memory.user_id == user_id,
                func.lower(Memory.memory).contains(memory_lower),
            )
            .first()
        )
        if mem:
            return MemoryRepository._to_dict(mem)
        return None

    @staticmethod
    def delete(db: Session, memory_id: str) -> bool:
        """Delete a memory by ID."""
        mem = db.query(Memory).filter(Memory.id == memory_id).first()
        if not mem:
            return False
        db.delete(mem)
        db.flush()
        return True

    @staticmethod
    def get_all(db: Session, user_id: str = DEFAULT_USER_ID) -> List[Dict[str, Any]]:
        """Get all memories for a user."""
        mems = (
            db.query(Memory)
            .filter(Memory.user_id == user_id)
            .order_by(Memory.created_at.desc())
            .all()
        )
        return [MemoryRepository._to_dict(m) for m in mems]

    @staticmethod
    def _to_dict(mem: Memory) -> Dict[str, Any]:
        """Convert ORM object to dict matching the old SQLite row format."""
        return {
            "id": mem.id,
            "chat_id": mem.chat_id,
            "user_id": mem.user_id,
            "type": mem.type,
            "memory": mem.memory,
            "importance": mem.importance or 0.5,
            "recency": mem.recency or 0.0,
            "frequency": mem.frequency or 0,
            "last_accessed": mem.last_accessed.isoformat() if mem.last_accessed else None,
            "access_count": mem.access_count or 0,
            "created_at": mem.created_at.isoformat() if mem.created_at else "",
            "updated_at": mem.updated_at.isoformat() if mem.updated_at else "",
        }
