
"""
Long-term memory storage using SQLite database
"""
import sqlite3
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from contextlib import contextmanager

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
    """Initialize the database and create tables if not exists"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(CREATE_MEMORY_TABLE_SQL)

def create_memory(
    chat_id: str,
    memory_type: str,
    memory_text: str,
    importance: float = 0.5,
    user_id: str = "default"
) -> str:
    """Create a new memory and return its ID"""
    memory_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO memories (id, chat_id, user_id, type, memory, importance, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (memory_id, chat_id, user_id, memory_type, memory_text, importance, now, now)
        )
    return memory_id

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
    keywords = query_text.lower().split()
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
        return [dict(row) for row in rows]

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

def delete_memory(memory_id: str) -> bool:
    """Delete a memory by ID"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM memories WHERE id = ?", (memory_id,))
        return cursor.rowcount > 0

# Initialize the database when this module is imported
init_db()
