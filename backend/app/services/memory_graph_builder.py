
"""
<<<<<<< HEAD
Intelligent Knowledge Graph Service for MemoryOS
Uses NetworkX as the graph abstraction layer (easily replaceable with Neo4j)
Handles node/edge management, entity extraction, relationship extraction,
duplicate merging, and importance scoring.
"""

import os
import json
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
from pydantic import BaseModel, Field
import networkx as nx

# Load environment variables
load_dotenv()

# -----------------------------------------------------------------------------
# Pydantic Models (for type safety)
# -----------------------------------------------------------------------------

class EntityNode(BaseModel):
    """Model for a node in our knowledge graph."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: str = Field(..., description="Type of entity: Person, Project, Technology, etc.")
    description: Optional[str] = None
    importance: float = 0.5  # 0.0 to 1.0, decays over time
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class RelationshipEdge(BaseModel):
    """Model for an edge (relationship) between two nodes."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source_id: str
    target_id: str
    type: str = Field(..., description="Type of relationship: works_at, mentions, etc.")
    description: Optional[str] = None
    strength: float = Field(default=1.0, description="Strength of the relationship (0.0-1.0)")
    access_count: int = Field(default=0, description="Number of times this relationship has been accessed")
    last_accessed: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class ExtractionResult(BaseModel):
    """Result from entity/relationship extraction."""
    entities: List[EntityNode] = Field(default_factory=list)
    relationships: List[RelationshipEdge] = Field(default_factory=list)


# -----------------------------------------------------------------------------
# Graph Service Implementation
# -----------------------------------------------------------------------------

class GraphService:
    """
    Core graph service for MemoryOS.
    Abstracted so the underlying implementation can be swapped from NetworkX to Neo4j.
    """
    
    # Entity types (expanded per requirements)
    ENTITY_TYPES = [
        "Person", "Organization", "Company", "Project", "Technology", "Skill", "Task",
        "Meeting", "Date", "Deadline", "Topic", "Location", "Course", "Product",
        "Email", "Document", "Event", "Concept", "Conversation", "Custom"
    ]
    
    # Relationship types (semantic, per requirements)
    RELATIONSHIP_TYPES = [
        "works_at", "mentions", "belongs_to", "assigned_to", "created_by",
        "attends", "related_to", "depends_on", "references", "contains",
        "emailed_by", "meeting_with", "has_deadline", "uploaded_by",
        "uses", "implements", "studies", "is_attending", "is_about",
        "is_part_of", "knows", "interests", "has_goal"
    ]
    
    # Entity synonyms/aliases for merging
    _entity_aliases: Dict[str, List[str]] = {
        # Example mappings (will grow with usage)
        "Microsoft": ["Microsoft", "Microsoft Corporation", "MSFT"],
        "John Smith": ["John", "John Smith", "john@gmail.com"]
    }
    
    def __init__(self, db_path: Optional[str] = None):
        """Initialize GraphService with a NetworkX graph."""
        self.db_path = db_path or "./knowledge_graph.json"
        self._graph: nx.DiGraph = nx.DiGraph()
        self._load_graph()
    
    # -------------------------------------------------------------------------
    # Graph Persistence (save/load from JSON)
    # -------------------------------------------------------------------------
    
    def _load_graph(self) -> None:
        """Load the graph from JSON file if it exists."""
        if os.path.exists(self.db_path):
            try:
                with open(self.db_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self._graph = nx.node_link_graph(data)
                print(f"[GraphService] Loaded graph from {self.db_path}")
            except Exception as e:
                print(f"[GraphService] Error loading graph, starting fresh: {e}")
                self._graph = nx.DiGraph()
    
    def _save_graph(self) -> None:
        """Save the graph to JSON file."""
        try:
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
            data = nx.node_link_data(self._graph)
            with open(self.db_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"[GraphService] Error saving graph: {e}")
    
    # -------------------------------------------------------------------------
    # Node Management
    # -------------------------------------------------------------------------
    
    def create_node(self, node: EntityNode) -> str:
        """Create or update a node, merging duplicates if needed."""
        # First check if a similar node exists to merge
        existing_id = self._find_duplicate_node(node.name, node.type)
        if existing_id:
            return self.update_node(existing_id, node)
        
        # Add new node
        self._graph.add_node(node.id, **node.model_dump())
        self._save_graph()
        print(f"[GraphService] Created node: {node.type} - {node.name}")
        return node.id
    
    def get_node(self, node_id: str) -> Optional[EntityNode]:
        """Retrieve a single node by ID."""
        if node_id in self._graph.nodes:
            return EntityNode(**self._graph.nodes[node_id])
        return None
    
    def get_node_by_name_and_type(self, name: str, type: str) -> Optional[EntityNode]:
        """Get a node by name and type (case-insensitive)."""
        name_lower = name.strip().lower()
        for node_id, node_data in self._graph.nodes(data=True):
            if (node_data.get("type", "").lower() == type.lower()
                and node_data.get("name", "").strip().lower() == name_lower):
                return EntityNode(**node_data)
        return None
    
    def update_node(self, node_id: str, updates: EntityNode) -> str:
        """Update an existing node's data, preserving some fields."""
        if node_id not in self._graph.nodes:
            return self.create_node(updates)
        
        existing_data = dict(self._graph.nodes[node_id])
        # Merge updates with existing
        updated_data = {
            **existing_data,
            **updates.model_dump(exclude_unset=True),
            "id": node_id,  # Keep original ID
            "updated_at": datetime.now().isoformat()
        }
        self._graph.nodes[node_id].update(updated_data)
        self._save_graph()
        return node_id
    
    def _find_duplicate_node(self, name: str, type: str) -> Optional[str]:
        """Check for existing node that should be merged."""
        # Check direct matches
        direct_match = self.get_node_by_name_and_type(name, type)
        if direct_match:
            return direct_match.id
        
        # Check aliases
        name_lower = name.strip().lower()
        for canonical_name, aliases in self._entity_aliases.items():
            if name_lower in [a.lower() for a in aliases]:
                alias_match = self.get_node_by_name_and_type(canonical_name, type)
                if alias_match:
                    return alias_match.id
        
        return None
    
    # -------------------------------------------------------------------------
    # Edge Management
    # -------------------------------------------------------------------------
    
    def create_edge(self, edge: RelationshipEdge) -> str:
        """Create or update a relationship between two nodes."""
        # Check if edge already exists
        existing_edges = list(self._graph.edges(edge.source_id, data=True))
        for (u, v, data) in existing_edges:
            if (v == edge.target_id 
                and data.get("type") == edge.type):
                # Update existing edge
                data["description"] = edge.description or data.get("description")
                data["updated_at"] = datetime.now().isoformat()
                self._save_graph()
                return data["id"]
        
        # Create new edge
        self._graph.add_edge(
            edge.source_id,
            edge.target_id,
            **edge.model_dump()
        )
        self._save_graph()
        return edge.id
    
    def get_edge(self, edge_id: str) -> Optional[RelationshipEdge]:
        """Retrieve an edge by ID."""
        for u, v, data in self._graph.edges(data=True):
            if data.get("id") == edge_id:
                return RelationshipEdge(**data)
        return None
    
    # -------------------------------------------------------------------------
    # Entity & Relationship Extraction
    # -------------------------------------------------------------------------
    
    def extract_entities_and_relationships(
        self, 
        text: str, 
        context: Optional[Dict[str, Any]] = None
    ) -> ExtractionResult:
        """
        Use OpenRouter to extract entities and relationships from text.
        Context is optional metadata like source type, document name, etc.
        """
        import os
        import traceback
        from .ai_provider import generate_response
        
        prompt = f"""
        You are an expert at extracting entities and relationships from text for a knowledge graph.
        Extract entities and relationships from the given text, especially from emails, calendar events, technical documents, and other personal content.

        VALID ENTITY TYPES (use only these): {json.dumps(self.ENTITY_TYPES)}
        VALID RELATIONSHIP TYPES (use only these): {json.dumps(self.RELATIONSHIP_TYPES)}

        CONTEXT: {json.dumps(context or {})}

        EXTRACTION GUIDELINES (based on context):
        - For Gmail emails: Extract senders, recipients, companies, meeting names, interview names, projects, important dates, action items
        - For Drive files: Extract document type, technologies, project names, people, important topics
        - For Calendar events: Extract event name, participants, deadlines, location, project relation
        - For technical documents: Extract topics, chapters, technologies, programming languages, frameworks
        - For all content: Extract people, organizations, companies, dates, important concepts, keywords

        TEXT:
        {text}

        OUTPUT ONLY a JSON object in this format:
        {{
            "entities": [
                {{
                    "name": "<entity name>",
                    "type": "<one of valid entity types>",
                    "description": "<optional short description>"
                }}
            ],
            "relationships": [
                {{
                    "source_entity": "<name of source entity>",
                    "source_type": "<type of source entity>",
                    "target_entity": "<name of target entity>",
                    "target_type": "<type of target entity>",
                    "type": "<one of valid relationship types>",
                    "description": "<optional description>"
                }}
            ]
        }}

        If no entities/relationships, return {{ "entities": [], "relationships": [] }}
        """
        
        try:
            text_response = generate_response(
                prompt=prompt,
                temperature=0.1,
                max_tokens=1024
            )
            text_response = text_response.strip()
            # Clean up any markdown
            if text_response.startswith("```json"):
                text_response = text_response[7:]
            if text_response.endswith("```"):
                text_response = text_response[:-3]
            
            data = json.loads(text_response.strip())
            
            # Convert to our models
            entities = []
            for ent_data in data.get("entities", []):
                # Ensure valid type, default to Custom if invalid
                ent_type = ent_data.get("type", "Custom")
                if ent_type not in self.ENTITY_TYPES:
                    ent_type = "Custom"
                entities.append(
                    EntityNode(
                        name=ent_data["name"],
                        type=ent_type,
                        description=ent_data.get("description")
                    )
                )
            
            return ExtractionResult(entities=entities, relationships=data.get("relationships", []))
        
        except Exception as e:
            print(f"[GraphService] Extraction error: {e}")
            return ExtractionResult()
    
    # -------------------------------------------------------------------------
    # Graph Operations
    # -------------------------------------------------------------------------
    
    def process_text(
        self,
        text: str,
        source_node: Optional[EntityNode] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> List[str]:
        """
        Process a piece of text, extract entities/relationships, and add them to the graph.
        Returns IDs of newly created/updated nodes.
        """
        result = self.extract_entities_and_relationships(text, context)
        node_ids: List[str] = []
        
        # Create entities
        entity_map: Dict[str, str] = {}  # name -> node_id
        for entity in result.entities:
            node_id = self.create_node(entity)
            entity_map[(entity.name.lower(), entity.type.lower())] = node_id
            node_ids.append(node_id)
        
        # Create relationships between extracted entities
        for rel_data in result.relationships:
            source_key = (rel_data["source_entity"].lower(), rel_data["source_type"].lower())
            target_key = (rel_data["target_entity"].lower(), rel_data["target_type"].lower())
            
            if source_key in entity_map and target_key in entity_map:
                edge = RelationshipEdge(
                    source_id=entity_map[source_key],
                    target_id=entity_map[target_key],
                    type=rel_data["type"],
                    description=rel_data.get("description")
                )
                self.create_edge(edge)
        
        # If there's a source node, link all entities to it
        if source_node:
            source_id = self.create_node(source_node)
            for node_id in node_ids:
                self.create_edge(RelationshipEdge(
                    source_id=source_id,
                    target_id=node_id,
                    type="contains",
                    description=f"Source contains entity"
                ))
        
        return node_ids
    
    def find_related_nodes(self, node_id: str, max_depth: int = 2) -> List[EntityNode]:
        """Find all nodes within max_depth steps from given node."""
        if node_id not in self._graph:
            return []
        
        # Get subgraph (both directions)
        subgraph = nx.ego_graph(self._graph.to_undirected(), node_id, radius=max_depth)
        return [
            EntityNode(**subgraph.nodes[n])
            for n in subgraph.nodes
        ]
    
    def get_subgraph(self, node_ids: List[str]) -> Dict[str, Any]:
        """Get a subgraph containing only given node IDs and connecting edges."""
        subgraph = self._graph.subgraph(node_ids).copy()
        nodes_data = [
            EntityNode(**data)
            for _, data in subgraph.nodes(data=True)
        ]
        edges_data = [
            RelationshipEdge(**data)
            for _, _, data in subgraph.edges(data=True)
        ]
        return {"nodes": nodes_data, "edges": edges_data}
    
    def search_nodes(self, query: str, entity_type: Optional[str] = None) -> List[EntityNode]:
        """Search nodes by name (case-insensitive, substring match)."""
        query_lower = query.lower()
        results = []
        for node_id, data in self._graph.nodes(data=True):
            name = data.get("name", "").lower()
            if query_lower in name:
                if entity_type and data.get("type", "").lower() != entity_type.lower():
                    continue
                results.append(EntityNode(**data))
        # Sort by relevance (exact matches first, then importance)
        results.sort(
            key=lambda n: (
                0 if n.name.lower() == query_lower else 1,
                -n.importance
            )
        )
        return results
    
    def get_all_nodes(self) -> List[EntityNode]:
        """Get all nodes in the graph."""
        return [
            EntityNode(**data)
            for _, data in self._graph.nodes(data=True)
        ]
    
    def get_all_edges(self) -> List[RelationshipEdge]:
        """Get all edges in the graph."""
        return [
            RelationshipEdge(**data)
            for _, _, data in self._graph.edges(data=True)
        ]
    
    # -------------------------------------------------------------------------
    # Memory Scoring & Consolidation
    # -------------------------------------------------------------------------
    
    def increment_importance(self, node_id: str, amount: float = 0.1) -> None:
        """Increase a node's importance (capped at 1.0)."""
        if node_id not in self._graph.nodes:
            return
        
        current = self._graph.nodes[node_id].get("importance", 0.5)
        self._graph.nodes[node_id]["importance"] = min(1.0, current + amount)
        self._graph.nodes[node_id]["updated_at"] = datetime.now().isoformat()
        self._save_graph()
    
    def decay_importance(self, decay_rate: float = 0.01) -> None:
        """Decay importance of all nodes over time (call periodically)."""
        for node_id, data in self._graph.nodes(data=True):
            current = data.get("importance", 0.5)
            data["importance"] = max(0.0, current - decay_rate)
            data["updated_at"] = datetime.now().isoformat()
        self._save_graph()

    def increment_node_importance(self, node_id: str, amount: float = 0.05) -> None:
        """Increase node importance when accessed or mentioned."""
        if node_id in self._graph.nodes:
            current = self._graph.nodes[node_id].get("importance", 0.5)
            self._graph.nodes[node_id]["importance"] = min(1.0, current + amount)
            self._graph.nodes[node_id]["access_count"] = self._graph.nodes[node_id].get("access_count", 0) + 1
            self._graph.nodes[node_id]["last_accessed"] = datetime.now().isoformat()
            self._save_graph()

    def get_smart_recommendations(self, limit: int = 10) -> List[EntityNode]:
        """Get smart recommendations based on importance, recency, and access count."""
        nodes = []
        for node_id, data in self._graph.nodes(data=True):
            try:
                nodes.append(EntityNode(**data))
            except:
                pass
        
        # Sort by a combined score of importance, recency, and access count
        def score(node):
            recency_score = 0.5
            try:
                last_access = datetime.fromisoformat(node.updated_at)
                days_since = (datetime.now() - last_access).days
                recency_score = max(0.0, 1.0 - (days_since / 30.0))
            except:
                pass
            
            return (node.importance * 0.5) + (recency_score * 0.3) + (min(1.0, node.access_count / 10) * 0.2)
        
        nodes.sort(key=score, reverse=True)
        return nodes[:limit]

    def find_path(self, source_id: str, target_id: str) -> Optional[List[str]]:
        """Find a path between two nodes in the graph."""
        try:
            import networkx as nx
            path = nx.shortest_path(self._graph, source=source_id, target=target_id)
            return path
        except:
            return None


# -----------------------------------------------------------------------------
# Singleton Instance
# -----------------------------------------------------------------------------

_graph_service_instance: Optional[GraphService] = None


def get_graph_service() -> GraphService:
    """Get or create the singleton GraphService instance."""
    global _graph_service_instance
    if _graph_service_instance is None:
        _graph_service_instance = GraphService()
    return _graph_service_instance


def update_graph_from_memory(memory_text: str, memory_type: str) -> None:
    """
    Update the knowledge graph with a new memory.
    
    Args:
        memory_text: The text content of the memory
        memory_type: The type of memory (personal, goal, etc.)
    """
    try:
        graph_service = get_graph_service()
        
        # Create source node representing the memory
        name = memory_text[:50]
        source_node = EntityNode(
            name=name,
            type="Conversation",
            description=memory_text
        )
        
        # Process the memory text with context
        context = {
            "source": "memory",
            "memory_type": memory_type
        }
        
        graph_service.process_text(
            text=memory_text,
            source_node=source_node,
            context=context
        )
        
    except Exception as e:
        print(f"[update_graph_from_memory] Error: {e}")
=======
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
>>>>>>> 007607a (Describe your changes)
