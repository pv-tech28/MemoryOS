
"""
Memory Graph Builder Service
Extract entities and relationships from memories to build a knowledge graph.
"""
import os
import json
import sqlite3
from contextlib import contextmanager
from typing import List, Dict, Any, Optional
from .memory_store import init_db
from .llm import get_llm_provider

# Database path (same as memory store)
DB_PATH = "./memory_db.sqlite"

# Node and Edge types
NODE_TYPES = [
    "Person", "Project", "Company", "Technology", "Skill", "Language",
    "Framework", "University", "Organization", "Document",
    "Email", "Task", "Goal", "Preference", "Location", "Date",
    "Event", "Meeting", "Certificate", "Custom"
]

EDGE_TYPES = [
    "WORKS_ON", "USES", "BUILT", "CREATED", "PARTICIPATED_IN",
    "RELATED_TO", "OWNS", "READS", "WRITES", "STUDIES_AT",
    "BELONGS_TO", "HAS_SKILL", "HAS_GOAL",
    "INTERESTED_IN", "MENTIONS", "ATTACHED_TO", "GENERATED_FROM",
    "SENT", "RECEIVED", "DEPENDS_ON", "CONNECTED_TO", "LIKES"
]

@contextmanager
def get_db_connection():
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

def init_graph_tables():
    """Initialize graph tables if they don't exist"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        # Nodes table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS graph_nodes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL CHECK (type IN (%s)),
                description TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """ % ','.join(f"'{t}'" for t in NODE_TYPES))
        # Edges table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS graph_edges (
                id TEXT PRIMARY KEY,
                source_node_id TEXT NOT NULL,
                target_node_id TEXT NOT NULL,
                type TEXT NOT NULL CHECK (type IN (%s)),
                description TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (source_node_id) REFERENCES graph_nodes (id) ON DELETE CASCADE,
                FOREIGN KEY (target_node_id) REFERENCES graph_nodes (id) ON DELETE CASCADE,
                UNIQUE(source_node_id, target_node_id, type)
            )
        """ % ','.join(f"'{t}'" for t in EDGE_TYPES))
        # Memory-to-node mapping
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS memory_nodes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                memory_id TEXT NOT NULL,
                node_id TEXT NOT NULL,
                FOREIGN KEY (memory_id) REFERENCES memories (id) ON DELETE CASCADE,
                FOREIGN KEY (node_id) REFERENCES graph_nodes (id) ON DELETE CASCADE,
                UNIQUE(memory_id, node_id)
            )
        """)
        # Memory-to-edge mapping
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS memory_edges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                memory_id TEXT NOT NULL,
                edge_id TEXT NOT NULL,
                FOREIGN KEY (memory_id) REFERENCES memories (id) ON DELETE CASCADE,
                FOREIGN KEY (edge_id) REFERENCES graph_edges (id) ON DELETE CASCADE,
                UNIQUE(memory_id, edge_id)
            )
        """)

# Initialize tables when module loads
init_graph_tables()

def extract_entities_and_relationships(memory_text: str, memory_type: str) -> Dict[str, Any]:
    """Use LLM to extract entities and relationships from a memory"""
    system_prompt = """You are an expert in information extraction for knowledge graphs.
Extract entities and relationships from the given memory.
Return ONLY a valid JSON object with these keys:
- entities: list of {"name": "...", "type": "..."} where type is one of: Person, Project, Skill, Company, Technology, Goal, Preference, Education, Task, Event, Document, Custom
- relationships: list of {"source": "...", "target": "...", "type": "...", "description": "..."} where type is one of: WORKS_ON, USES, LIKES, STUDIES_AT, RELATED_TO, BELONGS_TO, CREATED, PARTICIPATED_IN, KNOWS, HAS_GOAL, INTERESTED_IN
Example:
{
  "entities": [
    {"name": "Siddh", "type": "Person"},
    {"name": "EVOLVE AI", "type": "Project"},
    {"name": "Gemini", "type": "Technology"},
    {"name": "Python", "type": "Skill"}
  ],
  "relationships": [
    {"source": "Siddh", "target": "EVOLVE AI", "type": "WORKS_ON", "description": "Building EVOLVE AI"},
    {"source": "EVOLVE AI", "target": "Gemini", "type": "USES", "description": "Uses Gemini AI"},
    {"source": "Siddh", "target": "Python", "type": "LIKES", "description": "Likes Python"}
  ]
}
Do NOT include any extra text, only the JSON.
"""
    user_prompt = f"Memory Type: {memory_type}\nMemory Text: {memory_text}"
    
    try:
        llm = get_llm_provider()
        llm_response = llm.generate(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.2,
            max_tokens=8192
        )
        text = llm_response["text"].strip()
        
        # Clean up markdown if present
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        
        return json.loads(text)
    except Exception as e:
        print(f"Error extracting entities/relationships: {e}")
        import traceback
        traceback.print_exc()
        return {"entities": [], "relationships": []}

def find_existing_node(name: str) -> Optional[Dict[str, Any]]:
    """Find an existing node by name (case-insensitive)"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM graph_nodes WHERE LOWER(name) = LOWER(?)", (name,))
        row = cursor.fetchone()
        if row:
            return dict(row)
    return None

def create_node(name: str, node_type: str, description: Optional[str] = None) -> str:
    """Create a new node or return existing one if found"""
    from datetime import datetime
    existing = find_existing_node(name)
    if existing:
        return existing["id"]
    
    import uuid
    node_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO graph_nodes (id, name, type, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (node_id, name, node_type, description, now, now))
    
    return node_id

def find_existing_edge(source_id: str, target_id: str, edge_type: str) -> Optional[Dict[str, Any]]:
    """Find an existing edge"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM graph_edges 
            WHERE source_node_id = ? AND target_node_id = ? AND type = ?
        """, (source_id, target_id, edge_type))
        row = cursor.fetchone()
        if row:
            return dict(row)
    return None

def create_edge(source_id: str, target_id: str, edge_type: str, description: Optional[str] = None) -> str:
    """Create an edge or return existing one"""
    from datetime import datetime
    existing = find_existing_edge(source_id, target_id, edge_type)
    if existing:
        return existing["id"]
    
    import uuid
    edge_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO graph_edges (id, source_node_id, target_node_id, type, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (edge_id, source_id, target_id, edge_type, description, now))
    
    return edge_id

def link_memory_to_node(memory_id: str, node_id: str):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("INSERT OR IGNORE INTO memory_nodes (memory_id, node_id) VALUES (?, ?)", (memory_id, node_id))
        except:
            pass

def link_memory_to_edge(memory_id: str, edge_id: str):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("INSERT OR IGNORE INTO memory_edges (memory_id, edge_id) VALUES (?, ?)", (memory_id, edge_id))
        except:
            pass

def process_memory(memory_id: str, memory_text: str, memory_type: str):
    """Process a new memory to extract graph entities and relationships"""
    extraction_result = extract_entities_and_relationships(memory_text, memory_type)
    entities = extraction_result.get("entities", [])
    relationships = extraction_result.get("relationships", [])
    
    node_name_to_id = {}
    
    # Create nodes
    for entity in entities:
        name = entity["name"]
        type_ = entity["type"]
        node_id = create_node(name, type_)
        node_name_to_id[name] = node_id
        link_memory_to_node(memory_id, node_id)
    
    # Create edges
    for rel in relationships:
        source_name = rel["source"]
        target_name = rel["target"]
        if source_name not in node_name_to_id or target_name not in node_name_to_id:
            continue
        source_id = node_name_to_id[source_name]
        target_id = node_name_to_id[target_name]
        edge_type = rel["type"]
        description = rel.get("description")
        edge_id = create_edge(source_id, target_id, edge_type, description)
        link_memory_to_edge(memory_id, edge_id)

def get_all_graph_nodes() -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM graph_nodes")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def get_all_graph_edges() -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM graph_edges")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def get_related_memories(entity_name: str) -> Dict[str, Any]:
    """Get related memories and nodes for an entity"""
    node = find_existing_node(entity_name)
    if not node:
        return {"node": None, "edges": [], "related_nodes": [], "memories": []}
    
    # Get edges connected to this node
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT e.*, 
                   s.name as source_name, s.type as source_type,
                   t.name as target_name, t.type as target_type
            FROM graph_edges e
            LEFT JOIN graph_nodes s ON e.source_node_id = s.id
            LEFT JOIN graph_nodes t ON e.target_node_id = t.id
            WHERE source_node_id = ? OR target_node_id = ?
        """, (node["id"], node["id"]))
        edges = cursor.fetchall()
        edge_dicts = [dict(e) for e in edges]
    
    # Collect unique related nodes
    related_node_ids = set()
    for edge in edge_dicts:
        related_node_ids.add(edge["source_node_id"])
        related_node_ids.add(edge["target_node_id"])
    related_node_ids.discard(node["id"])
    
    # Get related nodes
    related_nodes = []
    if related_node_ids:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            placeholders = ','.join(['?'] * len(related_node_ids))
            cursor.execute(f"SELECT * FROM graph_nodes WHERE id IN ({placeholders})", list(related_node_ids))
            related_nodes = [dict(n) for n in cursor.fetchall()]
    
    # Get connected memories
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT m.* FROM memories m
            JOIN memory_nodes mn ON m.id = mn.memory_id
            WHERE mn.node_id = ?
        """, (node["id"],))
        memories = [dict(m) for m in cursor.fetchall()]
    
    return {
        "node": node,
        "edges": edge_dicts,
        "related_nodes": related_nodes,
        "memories": memories
    }


def get_graph_stats() -> Dict[str, Any]:
    """Get statistics about the graph for frontend display."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Total nodes and edges
        cursor.execute("SELECT COUNT(*) FROM graph_nodes")
        total_nodes = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM graph_edges")
        total_edges = cursor.fetchone()[0]
        
        # Count per node type
        cursor.execute("""
            SELECT type, COUNT(*) AS count
            FROM graph_nodes
            GROUP BY type
        """)
        node_counts = {row[0]: row[1] for row in cursor.fetchall()}
        
        # Find most connected node
        cursor.execute("""
            SELECT n.id, n.name, n.type, COUNT(*) AS connection_count
            FROM graph_nodes n
            JOIN graph_edges e
            ON n.id = e.source_node_id OR n.id = e.target_node_id
            GROUP BY n.id
            ORDER BY connection_count DESC
            LIMIT 1
        """)
        most_connected = cursor.fetchone()
        if most_connected:
            most_connected = {
                "id": most_connected[0],
                "name": most_connected[1],
                "type": most_connected[2],
                "connection_count": most_connected[3]
            }
        
        # Find newest node
        cursor.execute("""
            SELECT id, name, type, created_at
            FROM graph_nodes
            ORDER BY created_at DESC
            LIMIT 1
        """)
        newest_node = cursor.fetchone()
        if newest_node:
            newest_node = {
                "id": newest_node[0],
                "name": newest_node[1],
                "type": newest_node[2],
                "created_at": newest_node[3]
            }
        
        # Calculate average connections per node
        avg_connections = 0
        if total_nodes > 0:
            avg_connections = (total_edges * 2) / total_nodes  # Each edge counts for 2 nodes
        
        return {
            "total_nodes": total_nodes,
            "total_edges": total_edges,
            "node_counts": node_counts,
            "most_connected": most_connected,
            "newest_node": newest_node,
            "avg_connections": avg_connections
        }

def get_graph_service():
    """Return graph service instance (for compatibility)"""
    class GraphServiceCompat:
        @staticmethod
        def get_all_nodes():
            return get_all_graph_nodes()
        
        @staticmethod
        def get_all_edges():
            return get_all_graph_edges()
        
        @staticmethod
        def get_stats():
            return get_graph_stats()
    
    return GraphServiceCompat()
