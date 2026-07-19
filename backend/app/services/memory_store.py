"""
Long-term memory storage — now backed by PostgreSQL via MemoryRepository.
Preserves identical function signatures so all callers (memory_extractor, memory_intelligence, etc.)
require zero changes.
"""

from typing import Optional, List, Dict, Any
from app.database import SessionLocal
from app.repositories.memory_repo import MemoryRepository

# Re-export for backward compatibility
MEMORY_TYPES = [
    "personal", "goal", "project", "preference", "skill",
    "deadline", "task", "education", "career", "custom",
]


def _get_db():
    """Get a new database session for standalone service calls."""
    return SessionLocal()


def init_db():
    """No-op — tables are now created by database.init_database() at startup."""
    pass


def create_memory(
    chat_id: str,
    memory_type: str,
    memory_text: str,
    importance: float = 0.5,
    user_id: str = "default_user",
) -> str:
    """Create a new memory and return its ID."""
    db = _get_db()
    try:
        memory_id = MemoryRepository.create(
            db, chat_id, memory_type, memory_text, importance, user_id
        )
        db.commit()

        # Add timeline event (import here to avoid circular import)
        from app.services.timeline_service import add_timeline_event
        from app.services.memory_graph_builder import update_graph_from_memory
        add_timeline_event(
            title=f"Memory Created: {memory_type}",
            description=memory_text[:100] + ("..." if len(memory_text) > 100 else ""),
            event_type="memory",
            related_memory=memory_id,
            user_id=user_id,
        )
        
        update_graph_from_memory(memory_text, memory_type, user_id)
        
        return memory_id
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def increment_access(memory_id: str, importance_increment: float = 0.05) -> None:
    """Increment access count and update importance when a memory is retrieved."""
    db = _get_db()
    try:
        MemoryRepository.increment_access(db, memory_id, importance_increment)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_memories_by_chat_id(
    chat_id: str,
    limit: Optional[int] = None,
    min_importance: float = 0.0,
) -> List[Dict[str, Any]]:
    """Retrieve memories for a specific chat."""
    db = _get_db()
    try:
        result = MemoryRepository.get_by_chat_id(db, chat_id, limit, min_importance)
        db.commit()
        return result
    finally:
        db.close()


def get_relevant_memories(
    query_text: str,
    chat_id: Optional[str] = None,
    user_id: str = "default_user",
    limit: int = 10,
    min_importance: float = 0.3,
) -> List[Dict[str, Any]]:
    """Retrieve relevant memories for a query."""
    db = _get_db()
    try:
        result = MemoryRepository.get_relevant(
            db, query_text, chat_id, user_id, limit, min_importance
        )
        db.commit()
        return result
    finally:
        db.close()


def update_memory(
    memory_id: str,
    memory_text: Optional[str] = None,
    importance: Optional[float] = None,
    memory_type: Optional[str] = None,
) -> bool:
    """Update an existing memory."""
    db = _get_db()
    try:
        result = MemoryRepository.update(db, memory_id, memory_text, importance, memory_type)
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def find_existing_memory(
    memory_text: str,
    memory_type: str,
    user_id: str = "default_user",
) -> Optional[Dict[str, Any]]:
    """Find an existing memory by similarity for deduplication."""
    db = _get_db()
    try:
        return MemoryRepository.find_existing(db, memory_text, memory_type, user_id)
    finally:
        db.close()


def delete_memory(memory_id: str, user_id: str = "default_user") -> bool:
    """Delete a memory by ID."""
    db = _get_db()
    try:
        result = MemoryRepository.delete(db, memory_id)
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_all_memories(user_id: str = "default_user") -> List[Dict[str, Any]]:
    """Get all memories from the database."""
    db = _get_db()
    try:
        return MemoryRepository.get_all(db, user_id)
    finally:
        db.close()
