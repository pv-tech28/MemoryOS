"""
Memory Repository — replaces raw SQLite operations in memory_store.py.
"""

import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.db_models import Memory, MemoryConflict


DEFAULT_USER_ID = "demo-user-id"


def _mem_user_filter(user_id: str):
    if user_id in ("demo-user-id", "default_user", None, ""):
        return Memory.user_id.in_(["demo-user-id", "default_user"])
    return Memory.user_id == user_id


def _conflict_user_filter(user_id: str):
    if user_id in ("demo-user-id", "default_user", None, ""):
        return MemoryConflict.user_id.in_(["demo-user-id", "default_user"])
    return MemoryConflict.user_id == user_id


class MemoryRepository:

    @staticmethod
    def create(
        db: Session,
        chat_id: str,
        memory_type: str,
        memory_text: str,
        importance: float = 0.5,
        user_id: str = DEFAULT_USER_ID,
        status: str = "active",
        confidence: float = 1.0,
        source_ref: Optional[str] = None,
    ) -> str:
        """Create a new memory and return its ID."""
        effective_uid = "demo-user-id" if user_id in ("default_user", None, "") else user_id
        memory_id = str(uuid.uuid4())
        now = datetime.utcnow()
        mem = Memory(
            id=memory_id,
            chat_id=chat_id,
            user_id=effective_uid,
            type=memory_type,
            memory=memory_text,
            importance=importance,
            recency=0.0,
            frequency=0,
            last_accessed=now,
            access_count=0,
            status=status,
            confidence=confidence,
            valid_from=now,
            valid_until=None,
            superseded_by_id=None,
            source_ref=source_ref,
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
        user_id: Optional[str] = None,
        status: Optional[str] = "active",
    ) -> List[Dict[str, Any]]:
        """Retrieve memories for a specific chat."""
        q = (
            db.query(Memory)
            .filter(Memory.chat_id == chat_id, Memory.importance >= min_importance)
        )
        if status:
            q = q.filter(Memory.status == status)
        if user_id:
            q = q.filter(_mem_user_filter(user_id))
        q = q.order_by(Memory.created_at.desc())
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
        status: str = "active",
    ) -> List[Dict[str, Any]]:
        """Retrieve relevant active memories ordered by importance."""
        q = db.query(Memory).filter(
            _mem_user_filter(user_id),
            Memory.importance >= min_importance,
        )
        if status:
            q = q.filter(Memory.status == status)
        if chat_id:
            q = q.filter(Memory.chat_id == chat_id)
        q = q.order_by(Memory.importance.desc(), Memory.created_at.desc()).limit(limit)
        memories = [MemoryRepository._to_dict(m) for m in q.all()]

        # Increment access counts for retrieved memories
        for mem in memories:
            MemoryRepository.increment_access(db, mem["id"])

        return memories

    @staticmethod
    def get_active_memories(
        db: Session,
        user_id: str = DEFAULT_USER_ID,
        memory_type: Optional[str] = None,
        limit: int = 100,
    ) -> List[Memory]:
        """Get active Memory ORM instances for contradiction evaluation."""
        q = db.query(Memory).filter(
            _mem_user_filter(user_id),
            Memory.status == "active"
        )
        if memory_type:
            q = q.filter(Memory.type == memory_type)
        return q.order_by(Memory.importance.desc()).limit(limit).all()

    @staticmethod
    def find_by_source_ref(
        db: Session,
        source_ref: str,
        user_id: str = DEFAULT_USER_ID,
    ) -> Optional[Memory]:
        """Dedup guard: Find if a memory has already been recorded for this source_ref."""
        if not source_ref:
            return None
        return (
            db.query(Memory)
            .filter(_mem_user_filter(user_id), Memory.source_ref == source_ref)
            .first()
        )

    @staticmethod
    def supersede(db: Session, old_memory_id: str, new_memory_id: str) -> bool:
        """Mark an old memory as superseded by a new fact."""
        old_mem = db.query(Memory).filter(Memory.id == old_memory_id).first()
        if not old_mem:
            return False
        now = datetime.utcnow()
        old_mem.status = "superseded"
        old_mem.valid_until = now
        old_mem.superseded_by_id = new_memory_id
        old_mem.updated_at = now
        db.flush()
        return True

    @staticmethod
    def set_status(db: Session, memory_id: str, status: str, confidence: Optional[float] = None) -> bool:
        """Update the status and optional confidence of a memory."""
        mem = db.query(Memory).filter(Memory.id == memory_id).first()
        if not mem:
            return False
        mem.status = status
        if confidence is not None:
            mem.confidence = confidence
        mem.updated_at = datetime.utcnow()
        db.flush()
        return True

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
        """Find an existing active memory by similarity (substring) for simple deduplication."""
        memory_lower = memory_text.strip().lower()
        # Try exact type match first
        mem = (
            db.query(Memory)
            .filter(
                _mem_user_filter(user_id),
                Memory.status == "active",
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
                _mem_user_filter(user_id),
                Memory.status == "active",
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
    def get_all(
        db: Session,
        user_id: str = DEFAULT_USER_ID,
        status: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Get memories for a user, optionally filtered by status."""
        q = db.query(Memory).filter(_mem_user_filter(user_id))
        if status:
            q = q.filter(Memory.status == status)
        mems = q.order_by(Memory.created_at.desc()).all()
        return [MemoryRepository._to_dict(m) for m in mems]

    @staticmethod
    def get_by_id(db: Session, memory_id: str) -> Optional[Memory]:
        """Fetch Memory ORM object by ID."""
        return db.query(Memory).filter(Memory.id == memory_id).first()

    # ─────────────────────────────────────────────────────────────────────────
    # Conflicts Management
    # ─────────────────────────────────────────────────────────────────────────

    @staticmethod
    def create_conflict(
        db: Session,
        user_id: str,
        existing_memory_id: str,
        incoming_memory_text: str,
        incoming_memory_type: str,
        conflict_type: str,
        confidence: float = 0.0,
        explanation: Optional[str] = None,
    ) -> str:
        """Create a new flagged memory conflict."""
        effective_uid = "demo-user-id" if user_id in ("default_user", None, "") else user_id
        conflict_id = str(uuid.uuid4())
        conflict = MemoryConflict(
            id=conflict_id,
            user_id=effective_uid,
            existing_memory_id=existing_memory_id,
            incoming_memory_text=incoming_memory_text,
            incoming_memory_type=incoming_memory_type,
            conflict_type=conflict_type,
            confidence=confidence,
            explanation=explanation,
            resolution_status="pending_review",
            created_at=datetime.utcnow(),
        )
        db.add(conflict)
        db.flush()
        return conflict_id

    @staticmethod
    def get_pending_conflicts(db: Session, user_id: str = DEFAULT_USER_ID) -> List[Dict[str, Any]]:
        """Retrieve all pending conflicts for user review."""
        conflicts = (
            db.query(MemoryConflict)
            .filter(
                _conflict_user_filter(user_id),
                MemoryConflict.resolution_status == "pending_review",
            )
            .order_by(MemoryConflict.created_at.desc())
            .all()
        )
        results = []
        for c in conflicts:
            item = {
                "id": c.id,
                "user_id": c.user_id,
                "existing_memory_id": c.existing_memory_id,
                "existing_memory_text": c.existing_memory.memory if c.existing_memory else None,
                "incoming_memory_text": c.incoming_memory_text,
                "incoming_memory_type": c.incoming_memory_type,
                "conflict_type": c.conflict_type,
                "confidence": c.confidence,
                "explanation": c.explanation,
                "resolution_status": c.resolution_status,
                "created_at": c.created_at.isoformat() if c.created_at else "",
                "resolved_at": c.resolved_at.isoformat() if c.resolved_at else None,
            }
            results.append(item)
        return results

    @staticmethod
    def resolve_conflict(
        db: Session,
        conflict_id: str,
        user_id: str,
        action: str,  # "accept_new" or "keep_existing"
    ) -> Optional[Dict[str, Any]]:
        """Resolve a conflict according to user decision."""
        conflict = (
            db.query(MemoryConflict)
            .filter(
                MemoryConflict.id == conflict_id,
                _conflict_user_filter(user_id),
            )
            .first()
        )
        if not conflict:
            return None

        now = datetime.utcnow()
        existing_mem = db.query(Memory).filter(Memory.id == conflict.existing_memory_id).first()

        # Find the incoming memory if it was saved as disputed or pending
        incoming_mem = (
            db.query(Memory)
            .filter(
                _mem_user_filter(user_id),
                Memory.memory == conflict.incoming_memory_text,
                Memory.status.in_(["disputed", "pending_review"]),
            )
            .order_by(Memory.created_at.desc())
            .first()
        )

        if action == "accept_new":
            # 1. Supersede existing memory
            if existing_mem:
                existing_mem.status = "superseded"
                existing_mem.valid_until = now
                if incoming_mem:
                    existing_mem.superseded_by_id = incoming_mem.id
                existing_mem.updated_at = now

            # 2. Activate incoming memory
            if incoming_mem:
                incoming_mem.status = "active"
                incoming_mem.updated_at = now
            else:
                # If incoming memory was not yet persisted, create it now
                new_id = MemoryRepository.create(
                    db=db,
                    chat_id=existing_mem.chat_id if existing_mem else "resolved_conflict",
                    memory_type=conflict.incoming_memory_type,
                    memory_text=conflict.incoming_memory_text,
                    importance=existing_mem.importance if existing_mem else 0.7,
                    user_id=user_id,
                    status="active",
                )
                if existing_mem:
                    existing_mem.superseded_by_id = new_id

            conflict.resolution_status = "accepted_new"
            conflict.resolved_at = now

        elif action == "keep_existing":
            # 1. Existing memory remains active
            if existing_mem and existing_mem.status != "active":
                existing_mem.status = "active"
                existing_mem.valid_until = None
                existing_mem.updated_at = now

            # 2. Discard/archive incoming memory
            if incoming_mem:
                incoming_mem.status = "archived"
                incoming_mem.updated_at = now

            conflict.resolution_status = "kept_existing"
            conflict.resolved_at = now

        else:
            raise ValueError(f"Unsupported action: {action}. Must be 'accept_new' or 'keep_existing'.")

        db.flush()
        return {
            "conflict_id": conflict.id,
            "resolution_status": conflict.resolution_status,
            "resolved_at": conflict.resolved_at.isoformat() if conflict.resolved_at else None,
        }

    @staticmethod
    def _to_dict(mem: Memory) -> Dict[str, Any]:
        """Convert ORM object to dict."""
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
            "status": getattr(mem, "status", "active"),
            "confidence": getattr(mem, "confidence", 1.0),
            "valid_from": mem.valid_from.isoformat() if getattr(mem, "valid_from", None) else None,
            "valid_until": mem.valid_until.isoformat() if getattr(mem, "valid_until", None) else None,
            "superseded_by_id": getattr(mem, "superseded_by_id", None),
            "source_ref": getattr(mem, "source_ref", None),
            "created_at": mem.created_at.isoformat() if mem.created_at else "",
            "updated_at": mem.updated_at.isoformat() if mem.updated_at else "",
        }
