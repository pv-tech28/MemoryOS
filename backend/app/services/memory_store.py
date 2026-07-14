
"""
Long-term memory storage using SQLite database
"""
import sqlite3
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from contextlib import contextmanager
from app.services.timeline_service import add_timeline_event

# Database path
DB_PATH = "./memory_db.sqlite"

# Memory types
MEMORY_TYPES = [
    "personal",
    "goal",
    "project",
    "preference",
    "skill",
    "deadline",
    "task",
    "education",
    "career",
    "custom"
]

# SQL to create memory table
CREATE_MEMORY_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    user_id TEXT DEFAULT 'default',
    type TEXT NOT NULL CHECK (type IN ({})),
    memory TEXT NOT NULL,
    importance REAL DEFAULT 0.5 CHECK (importance BETWEEN 0 AND 1),
    recency REAL DEFAULT 0.0,
    frequency INTEGER DEFAULT 0,
    last_accessed TEXT,
    access_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
""".format(','.join(f"'{t}'" for t in MEMORY_TYPES))

@contextmanager
def get_db_connection():
    """Context manager for SQLite connections"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def init_db():
    """Initialize the database and create tables if not exists, and migrate existing tables"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Create or update table (handle migration for existing databases)
        try:
            cursor.execute("SELECT recency FROM memories LIMIT 1")
        except sqlite3.OperationalError:
            # Columns don't exist, need to add them
            cursor.execute("ALTER TABLE memories ADD COLUMN recency REAL DEFAULT 0.0")
            cursor.execute("ALTER TABLE memories ADD COLUMN frequency INTEGER DEFAULT 0")
            cursor.execute("ALTER TABLE memories ADD COLUMN last_accessed TEXT")
            cursor.execute("ALTER TABLE memories ADD COLUMN access_count INTEGER DEFAULT 0")
        
        cursor.execute(CREATE_MEMORY_TABLE_SQL)

def create_memory(
    chat_id: str,
    memory_type: str,
    memory_text: str,
    importance: float = 0.5,
    user_id: str = "default"
) -> str:
    """Create a new memory and return its ID."""
    memory_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO memories (id, chat_id, user_id, type, memory, importance, recency, frequency, last_accessed, access_count, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 0.0, 0, ?, 0, ?, ?)
            """,
            (memory_id, chat_id, user_id, memory_type, memory_text, importance, now, now, now)
        )
    
    # Add timeline event
    add_timeline_event(
        title=f"Memory Created: {memory_type}",
        description=memory_text[:100] + ("..." if len(memory_text) > 100 else ""),
        event_type="memory",
        related_memory=memory_id
    )
    
    return memory_id


def increment_access(memory_id: str, importance_increment: float = 0.05) -> None:
    """Increment access count and update importance when a memory is retrieved"""
    now = datetime.now().isoformat()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            UPDATE memories
            SET access_count = access_count + 1,
                frequency = frequency + 1,
                last_accessed = ?,
                importance = MIN(1.0, importance + ?),
                updated_at = ?
            WHERE id = ?
            """,
            (now, importance_increment, now, memory_id)
        )

def get_memories_by_chat_id(
    chat_id: str,
    limit: Optional[int] = None,
    min_importance: float = 0.0
) -> List[Dict[str, Any]]:
    """Retrieve memories for a specific chat"""
    query = "SELECT * FROM memories WHERE chat_id = ? AND importance >= ? ORDER BY created_at DESC"
    params = [chat_id, min_importance]
    if limit:
        query += " LIMIT ?"
        params.append(limit)

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def get_relevant_memories(
    query_text: str,
    chat_id: Optional[str] = None,
    user_id: str = "default",
    limit: int = 10,
    min_importance: float = 0.3
) -> List[Dict[str, Any]]:
    """Retrieve relevant memories for a query (simple keyword-based for now)"""
    # Simple keyword matching for now, in future could use embeddings
    with get_db_connection() as conn:
        cursor = conn.cursor()
        if chat_id:
            cursor.execute(
                """
                SELECT * FROM memories
                WHERE user_id = ? AND chat_id = ? AND importance >= ?
                ORDER BY importance DESC, created_at DESC
                LIMIT ?
                """,
                (user_id, chat_id, min_importance, limit)
            )
        else:
            cursor.execute(
                """
                SELECT * FROM memories
                WHERE user_id = ? AND importance >= ?
                ORDER BY importance DESC, created_at DESC
                LIMIT ?
                """,
                (user_id, min_importance, limit)
            )
        rows = cursor.fetchall()
        memories = [dict(row) for row in rows]
    
    # Increment access count for retrieved memories
    for mem in memories:
        increment_access(mem['id'])
    
    return memories

def update_memory(
    memory_id: str,
    memory_text: Optional[str] = None,
    importance: Optional[float] = None,
    memory_type: Optional[str] = None
) -> bool:
    """Update an existing memory"""
    update_parts = []
    params = []
    if memory_text:
        update_parts.append("memory = ?")
        params.append(memory_text)
    if importance is not None:
        update_parts.append("importance = ?")
        params.append(importance)
    if memory_type:
        update_parts.append("type = ?")
        params.append(memory_type)

    if not update_parts:
        return False

    now = datetime.now().isoformat()
    update_parts.append("updated_at = ?")
    params.append(now)
    params.append(memory_id)

    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            f"UPDATE memories SET {','.join(update_parts)} WHERE id = ?",
            params
        )
        return cursor.rowcount > 0

def find_existing_memory(
    memory_text: str,
    memory_type: str,
    user_id: str = "default"
) -> Optional[Dict[str, Any]]:
    """
    Find an existing memory by similarity (substring match) for deduplication
    """
    memory_lower = memory_text.strip().lower()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT * FROM memories
            WHERE user_id = ?
            AND type = ?
            AND LOWER(memory) LIKE ?
            LIMIT 1
            """,
            (user_id, memory_type, f"%{memory_lower}%")
        )
        row = cursor.fetchone()
        if row:
            return dict(row)
    
    # If not exact type match, try any type
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT * FROM memories
            WHERE user_id = ?
            AND LOWER(memory) LIKE ?
            LIMIT 1
            """,
            (user_id, f"%{memory_lower}%")
        )
        row = cursor.fetchone()
        if row:
            return dict(row)
    return None


def delete_memory(memory_id: str) -> bool:
    """Delete a memory by ID"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM memories WHERE id = ?", (memory_id,))
        return cursor.rowcount > 0


def get_all_memories(user_id: str = "default") -> List[Dict[str, Any]]:
    """Get all memories from the database"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM memories WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


# Initialize the database when this module is imported
init_db()
