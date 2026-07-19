"""
Intelligent Knowledge Graph Service for MemoryOS
Uses NetworkX as the in-memory graph abstraction layer for algorithms.
PostgreSQL (via GraphRepository) is the source of truth for persistence.
"""

import os
import json
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
from pydantic import BaseModel, Field
import networkx as nx
from app.repositories.graph_repo import GraphRepository
from app.database import SessionLocal


load_dotenv()


class EntityNode(BaseModel):
    """Model for a node in our knowledge graph."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: str = Field(..., description="Type of entity: Person, Project, Technology, etc.")
    description: Optional[str] = None
    importance: float = 0.5  # 0.0 to 1.0, decays over time
    metadata: Dict[str, Any] = Field(default_factory=dict)
    access_count: int = 0
    last_accessed: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    source_doc_ids: List[str] = Field(default_factory=list)


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
    relationships: List[Dict[str, Any]] = Field(default_factory=list)


class GraphService:
    """
    Core graph service for MemoryOS.
    PostgreSQL is the source of truth. NetworkX is used in-memory for algorithms.
    """

    ENTITY_TYPES = [
        "Person", "Organization", "Company", "Project", "Technology", "Skill", "Task",
        "Meeting", "Date", "Deadline", "Topic", "Location", "Course", "Product",
        "Email", "Document", "Event", "Concept", "Conversation", "Custom"
    ]

    RELATIONSHIP_TYPES = [
        "USES", "WORKS_ON", "CREATED", "CREATED_BY", "PART_OF",
        "BELONGS_TO", "RELATED_TO", "CONNECTED_TO", "MENTIONED_IN",
        "ATTENDED", "GENERATED_FROM", "SYNCED_FROM", "OWNS",
        "CONTAINS", "REFERENCES", "DERIVED_FROM"
    ]

    _entity_aliases: Dict[str, List[str]] = {
        "Microsoft": ["Microsoft", "Microsoft Corporation", "MSFT"],
        "John Smith": ["John", "John Smith", "john@gmail.com"]
    }

    def __init__(self):
        """Initialize GraphService — load per-user graphs on demand."""
        self._graphs: Dict[str, nx.DiGraph] = {}

    def _get_or_load_graph(self, user_id: str) -> nx.DiGraph:
        """Get the graph for a user, loading from DB if not cached."""
        if user_id not in self._graphs:
            self._graphs[user_id] = nx.DiGraph()
            self._load_from_db(user_id)
        return self._graphs[user_id]

    def _load_from_db(self, user_id: str) -> None:
        """Load graph for a specific user from PostgreSQL."""
        db = SessionLocal()
        try:
            from app.models.db_models import GraphNodeModel, GraphEdgeModel
            db_nodes = GraphRepository.get_all_nodes(db, user_id=user_id)
            db_edges = GraphRepository.get_all_edges(db, user_id=user_id)

            print(f"[GraphService] Loading {len(db_nodes)} nodes and {len(db_edges)} edges for user {user_id}")
            for node in db_nodes:
                node_data = GraphRepository.node_to_dict(node)
                self._graphs[user_id].add_node(node.id, **node_data)
            for edge in db_edges:
                edge_data = GraphRepository.edge_to_dict(edge)
                self._graphs[user_id].add_edge(edge.source_id, edge.target_id, **edge_data)
        except Exception as e:
            print(f"[GraphService] Error loading from DB for user {user_id}: {e}")
            import traceback
            traceback.print_exc()
        finally:
            db.close()

    def _save_node_to_db(self, node: EntityNode, user_id: str) -> str:
        """Persist a single node to PostgreSQL for a specific user."""
        db = SessionLocal()
        try:
            existing = GraphRepository.get_node(db, node.id)
            if existing:
                GraphRepository.update_node(
                    db, node.id,
                    name=node.name,
                    description=node.description,
                    importance=node.importance,
                    metadata=node.metadata,
                )
            else:
                GraphRepository.create_node(
                    db,
                    node_id=node.id,
                    name=node.name,
                    node_type=node.type,
                    description=node.description,
                    importance=node.importance,
                    metadata=node.metadata,
                    user_id=user_id
                )
            db.commit()
            return node.id
        except Exception as e:
            db.rollback()
            print(f"[GraphService] Error saving node to DB: {e}")
            return node.id
        finally:
            db.close()

    def _save_edge_to_db(self, edge: RelationshipEdge, user_id: str) -> str:
        """Persist a single edge to PostgreSQL for a specific user."""
        db = SessionLocal()
        try:
            existing = GraphRepository.find_edge(db, edge.source_id, edge.target_id, edge.type)
            if existing:
                GraphRepository.update_edge(
                    db, existing.id,
                    description=edge.description,
                    strength=edge.strength,
                )
                db.commit()
                return existing.id
            else:
                GraphRepository.create_edge(
                    db,
                    edge_id=edge.id,
                    source_id=edge.source_id,
                    target_id=edge.target_id,
                    edge_type=edge.type,
                    description=edge.description,
                    strength=edge.strength,
                )
                db.commit()
                return edge.id
        except Exception as e:
            db.rollback()
            print(f"[GraphService] Error saving edge to DB: {e}")
            return edge.id
        finally:
            db.close()

    def create_node(self, node: EntityNode, user_id: str) -> str:
        """Create or update a node, merging duplicates if needed, for a specific user."""
        existing_id = self._find_duplicate_node(node.name, node.type, user_id)
        if existing_id:
            return self.update_node(existing_id, node, user_id)

        graph = self._get_or_load_graph(user_id)
        graph.add_node(node.id, **node.model_dump())
        self._save_node_to_db(node, user_id)
        print(f"[GraphService] Created node: {node.type} - {node.name}")
        return node.id

    def get_node(self, node_id: str, user_id: str) -> Optional[EntityNode]:
        """Retrieve a single node by ID for a specific user."""
        graph = self._get_or_load_graph(user_id)
        if node_id in graph.nodes:
            return EntityNode(**graph.nodes[node_id])
        return None

    def get_node_by_name_and_type(self, name: str, type: str, user_id: str) -> Optional[EntityNode]:
        """Get a node by name and type (case-insensitive) for a specific user."""
        name_lower = name.strip().lower()
        graph = self._get_or_load_graph(user_id)
        for node_id, node_data in graph.nodes(data=True):
            if (node_data.get("type", "").lower() == type.lower()
                and node_data.get("name", "").strip().lower() == name_lower):
                return EntityNode(**node_data)
        return None

    def update_node(self, node_id: str, updates: EntityNode, user_id: str) -> str:
        """Update an existing node's data, preserving some fields, for a specific user."""
        graph = self._get_or_load_graph(user_id)
        if node_id not in graph.nodes:
            return self.create_node(updates, user_id)

        existing_data = dict(graph.nodes[node_id])
        updated_data = {
            **existing_data,
            **updates.model_dump(exclude_unset=True),
            "id": node_id,
            "updated_at": datetime.now().isoformat()
        }
        graph.nodes[node_id].update(updated_data)
        self._save_node_to_db(EntityNode(**updated_data), user_id)
        return node_id

    def _find_duplicate_node(self, name: str, type: str, user_id: str) -> Optional[str]:
        """Check for existing node that should be merged for a specific user."""
        direct_match = self.get_node_by_name_and_type(name, type, user_id)
        if direct_match:
            return direct_match.id

        name_lower = name.strip().lower()
        for canonical_name, aliases in self._entity_aliases.items():
            if name_lower in [a.lower() for a in aliases]:
                alias_match = self.get_node_by_name_and_type(canonical_name, type, user_id)
                if alias_match:
                    return alias_match.id

        return None

    def create_edge(self, edge: RelationshipEdge, user_id: str) -> str:
        """Create or update a relationship between two nodes for a specific user."""
        graph = self._get_or_load_graph(user_id)
        existing_edges = list(graph.edges(edge.source_id, data=True))
        for (u, v, data) in existing_edges:
            if (v == edge.target_id and data.get("type") == edge.type):
                data["description"] = edge.description or data.get("description")
                data["updated_at"] = datetime.now().isoformat()
                self._save_edge_to_db(RelationshipEdge(**data), user_id)
                return data["id"]

        graph.add_edge(edge.source_id, edge.target_id, **edge.model_dump())
        self._save_edge_to_db(edge, user_id)
        return edge.id

    def get_edge(self, edge_id: str, user_id: str) -> Optional[RelationshipEdge]:
        """Retrieve an edge by ID for a specific user."""
        graph = self._get_or_load_graph(user_id)
        for u, v, data in graph.edges(data=True):
            if data.get("id") == edge_id:
                return RelationshipEdge(**data)
        return None

    def extract_entities_and_relationships(
        self,
        text: str,
        context: Optional[Dict[str, Any]] = None
    ) -> ExtractionResult:
        """Use LLM to extract entities and relationships from text."""
        import traceback
        from app.services.llm import get_llm_provider

        llm = get_llm_provider()

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
            llm_response = llm.generate(
                prompt=prompt,
                temperature=0.1,
                max_tokens=1024
            )
            text_response = llm_response["text"].strip()
            if text_response.startswith("```json"):
                text_response = text_response[7:]
            if text_response.endswith("```"):
                text_response = text_response[:-3]

            data = json.loads(text_response.strip())

            entities = []
            for ent_data in data.get("entities", []):
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
            traceback.print_exc()
            return ExtractionResult()

    def process_text(
        self,
        text: str,
        user_id: str,
        source_node: Optional[EntityNode] = None,
        context: Optional[Dict[str, Any]] = None,
        doc_id: Optional[str] = None
    ) -> List[str]:
        """Process text and add to graph for a specific user."""
        result = self.extract_entities_and_relationships(text, context)
        node_ids: List[str] = []

        entity_map: Dict[str, str] = {}
        for entity in result.entities:
            if doc_id and doc_id not in entity.source_doc_ids:
                entity.source_doc_ids.append(doc_id)
            node_id = self.create_node(entity, user_id)
            entity_map[(entity.name.lower(), entity.type.lower())] = node_id
            node_ids.append(node_id)

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
                self.create_edge(edge, user_id)

        if source_node:
            if doc_id and doc_id not in source_node.source_doc_ids:
                source_node.source_doc_ids.append(doc_id)
            source_id = self.create_node(source_node, user_id)
            for node_id in node_ids:
                self.create_edge(RelationshipEdge(
                    source_id=source_id,
                    target_id=node_id,
                    type="contains",
                    description=f"Source contains entity"
                ), user_id)

        return node_ids

    def find_related_nodes(self, node_id: str, user_id: str, max_depth: int = 2) -> List[EntityNode]:
        """Find related nodes for a specific user."""
        graph = self._get_or_load_graph(user_id)
        if node_id not in graph:
            return []
        subgraph = nx.ego_graph(graph.to_undirected(), node_id, radius=max_depth)
        return [EntityNode(**subgraph.nodes[n]) for n in subgraph.nodes]

    def get_subgraph(self, node_ids: List[str], user_id: str) -> Dict[str, Any]:
        """Get subgraph for a specific user."""
        graph = self._get_or_load_graph(user_id)
        subgraph = graph.subgraph(node_ids).copy()
        nodes_data = [EntityNode(**data) for _, data in subgraph.nodes(data=True)]
        edges_data = [RelationshipEdge(**data) for _, _, data in subgraph.edges(data=True)]
        return {"nodes": nodes_data, "edges": edges_data}

    def search_nodes(self, query: str, user_id: str, entity_type: Optional[str] = None) -> List[EntityNode]:
        """Search nodes for a specific user."""
        query_lower = query.lower()
        results = []
        graph = self._get_or_load_graph(user_id)
        for node_id, data in graph.nodes(data=True):
            name = data.get("name", "").lower()
            if query_lower in name:
                if entity_type and data.get("type", "").lower() != entity_type.lower():
                    continue
                results.append(EntityNode(**data))
        results.sort(key=lambda n: (0 if n.name.lower() == query_lower else 1, -n.importance))
        return results

    def get_all_nodes(self, user_id: str) -> List[EntityNode]:
        """Get all nodes for a specific user."""
        graph = self._get_or_load_graph(user_id)
        return [EntityNode(**data) for _, data in graph.nodes(data=True)]

    def get_all_edges(self, user_id: str) -> List[RelationshipEdge]:
        """Get all edges for a specific user."""
        graph = self._get_or_load_graph(user_id)
        return [RelationshipEdge(**data) for _, _, data in graph.edges(data=True)]

    def increment_importance(self, node_id: str, user_id: str, amount: float = 0.1) -> None:
        graph = self._get_or_load_graph(user_id)
        if node_id not in graph.nodes:
            return
        current = graph.nodes[node_id].get("importance", 0.5)
        graph.nodes[node_id]["importance"] = min(1.0, current + amount)
        graph.nodes[node_id]["updated_at"] = datetime.now().isoformat()
        db = SessionLocal()
        try:
            GraphRepository.increment_importance(db, node_id, amount)
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()

    def decay_importance(self, user_id: str, decay_rate: float = 0.01) -> None:
        graph = self._get_or_load_graph(user_id)
        for node_id, data in graph.nodes(data=True):
            current = data.get("importance", 0.5)
            data["importance"] = max(0.0, current - decay_rate)
            data["updated_at"] = datetime.now().isoformat()
        db = SessionLocal()
        try:
            GraphRepository.decay_all(db, decay_rate, user_id=user_id)
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()

    def increment_node_importance(self, node_id: str, user_id: str, amount: float = 0.05) -> None:
        graph = self._get_or_load_graph(user_id)
        if node_id in graph.nodes:
            current = graph.nodes[node_id].get("importance", 0.5)
            graph.nodes[node_id]["importance"] = min(1.0, current + amount)
            graph.nodes[node_id]["access_count"] = graph.nodes[node_id].get("access_count", 0) + 1
            graph.nodes[node_id]["last_accessed"] = datetime.now().isoformat()
            db = SessionLocal()
            try:
                GraphRepository.increment_importance(db, node_id, amount)
                db.commit()
            except Exception:
                db.rollback()
            finally:
                db.close()

    def get_smart_recommendations(self, user_id: str, limit: int = 10) -> List[EntityNode]:
        graph = self._get_or_load_graph(user_id)
        nodes = []
        for node_id, data in graph.nodes(data=True):
            try:
                nodes.append(EntityNode(**data))
            except Exception:
                pass

        def score(node):
            recency_score = 0.5
            try:
                last_access = datetime.fromisoformat(node.updated_at)
                days_since = (datetime.now() - last_access).days
                recency_score = max(0.0, 1.0 - (days_since / 30.0))
            except Exception:
                pass
            return (node.importance * 0.5) + (recency_score * 0.3) + (min(1.0, node.access_count / 10) * 0.2)

        nodes.sort(key=score, reverse=True)
        return nodes[:limit]

    def find_path(self, source_id: str, target_id: str, user_id: str) -> Optional[List[str]]:
        try:
            graph = self._get_or_load_graph(user_id)
            path = nx.shortest_path(graph, source=source_id, target=target_id)
            return path
        except Exception:
            return None

    def get_community_detection(self, user_id: str) -> List[List[str]]:
        graph = self._get_or_load_graph(user_id)
        if len(graph.nodes()) < 2:
            return []
        try:
            undirected = graph.to_undirected()
            import community as community_louvain
            partition = community_louvain.best_partition(undirected)
            communities = {}
            for node_id, comm_id in partition.items():
                if comm_id not in communities:
                    communities[comm_id] = []
                communities[comm_id].append(node_id)
            return list(communities.values())
        except ImportError:
            return list(nx.connected_components(graph.to_undirected()))
        except Exception as e:
            print(f"[GraphService] Community detection error: {e}")
            return []

    def get_central_nodes(self, user_id: str, limit: int = 5) -> List[Dict[str, Any]]:
        graph = self._get_or_load_graph(user_id)
        if len(graph.nodes()) < 2:
            return []
        try:
            undirected = graph.to_undirected()
            betweenness = nx.betweenness_centrality(undirected)
            sorted_nodes = sorted(betweenness.items(), key=lambda x: x[1], reverse=True)[:limit]
            return [
                {
                    "id": node_id,
                    "name": graph.nodes[node_id].get("name"),
                    "type": graph.nodes[node_id].get("type"),
                    "centrality": score
                }
                for node_id, score in sorted_nodes
            ]
        except Exception as e:
            print(f"[GraphService] Centrality error: {e}")
            return []

    def clear_graph(self, user_id: str):
        if user_id in self._graphs:
            del self._graphs[user_id]
        print(f"[GraphService] In-memory graph cleared for user {user_id}")

    def get_stats(self, user_id: str) -> Dict[str, Any]:
        graph = self._get_or_load_graph(user_id)
        total_nodes = graph.number_of_nodes()
        total_edges = graph.number_of_edges()

        node_counts = {}
        for node_id, data in graph.nodes(data=True):
            node_type = data.get("type", "Custom")
            node_counts[node_type] = node_counts.get(node_type, 0) + 1

        most_connected = None
        if total_nodes > 0:
            node_degrees = graph.degree()
            most_connected_id = max(node_degrees, key=lambda x: x[1])[0]
            most_connected_data = graph.nodes[most_connected_id]
            most_connected = {
                "id": most_connected_id,
                "name": most_connected_data.get("name"),
                "type": most_connected_data.get("type"),
                "connection_count": node_degrees[most_connected_id]
            }

        newest_node = None
        if total_nodes > 0:
            sorted_nodes = sorted(
                [(node_id, data) for node_id, data in graph.nodes(data=True)],
                key=lambda x: x[1].get("created_at", ""), reverse=True
            )
            newest_data = sorted_nodes[0][1]
            newest_node = {
                "id": sorted_nodes[0][0],
                "name": newest_data.get("name"),
                "type": newest_data.get("type"),
                "created_at": newest_data.get("created_at")
            }

        avg_connections = 0
        if total_nodes > 0:
            avg_connections = (total_edges * 2) / total_nodes

        undirected = graph.to_undirected()
        connected_components = list(nx.connected_components(undirected))
        connected_components_count = len(connected_components)
        largest_cluster_size = max(len(c) for c in connected_components) if connected_components_count > 0 else 0

        central_nodes = self.get_central_nodes(user_id)
        communities = self.get_community_detection(user_id)

        return {
            "total_nodes": total_nodes,
            "total_edges": total_edges,
            "connected_components": connected_components_count,
            "largest_cluster": {
                "size": largest_cluster_size,
                "node_ids": list(connected_components[0]) if connected_components_count > 0 else []
            },
            "avg_connections": avg_connections,
            "node_counts": node_counts,
            "most_connected": most_connected,
            "central_nodes": central_nodes,
            "newest_node": newest_node,
            "communities": communities
        }


_graph_service_instance: Optional[GraphService] = None


def get_graph_service() -> GraphService:
    """Get or create the singleton GraphService instance."""
    global _graph_service_instance
    if _graph_service_instance is None:
        _graph_service_instance = GraphService()
    return _graph_service_instance


def update_graph_from_memory(memory_text: str, memory_type: str, user_id: str = "default_user") -> None:
    """Update the knowledge graph with a new memory."""
    try:
        graph_service = get_graph_service()
        name = memory_text[:50]
        source_node = EntityNode(
            name=name,
            type="Conversation",
            description=memory_text
        )
        context = {
            "source": "memory",
            "memory_type": memory_type
        }
        graph_service.process_text(
            text=memory_text,
            user_id=user_id,
            source_node=source_node,
            context=context
        )
    except Exception as e:
        print(f"[update_graph_from_memory] Error: {e}")


def get_all_graph_nodes(user_id: str):
    """Wrapper to get all nodes from graph service."""
    service = get_graph_service()
    nodes = service.get_all_nodes(user_id)
    return [node.model_dump() for node in nodes]


def get_all_graph_edges(user_id: str):
    """Wrapper to get all edges from graph service."""
    service = get_graph_service()
    edges = service.get_all_edges(user_id)
    return [edge.model_dump() for edge in edges]


def get_graph_stats(user_id: str):
    """Wrapper to get stats from graph service."""
    service = get_graph_service()
    return service.get_stats(user_id)


def get_related_memories(entity_name: str, user_id: str):
    """Get related memories for an entity."""
    service = get_graph_service()
    node = None
    for n in service.get_all_nodes(user_id):
        if n.name.lower() == entity_name.lower():
            node = n
            break
    if not node:
        return {"node": None, "edges": [], "related_nodes": [], "memories": []}

    node_id_to_name = {n.id: n.name for n in service.get_all_nodes(user_id)}
    edges = []
    related_node_ids = set()
    for e in service.get_all_edges(user_id):
        if e.source_id == node.id or e.target_id == node.id:
            edge_dict = e.model_dump()
            edge_dict["source_name"] = node_id_to_name.get(e.source_id, "Unknown")
            edge_dict["target_name"] = node_id_to_name.get(e.target_id, "Unknown")
            edges.append(edge_dict)
            if e.source_id != node.id:
                related_node_ids.add(e.source_id)
            if e.target_id != node.id:
                related_node_ids.add(e.target_id)

    related_nodes = []
    for n in service.get_all_nodes(user_id):
        if n.id in related_node_ids:
            related_nodes.append(n.model_dump())

    memories = []
    try:
        from app.services.memory_store import get_relevant_memories
        memories = [m for m in get_relevant_memories("", limit=100, min_importance=0.0)]
    except Exception as e:
        print(f"Error getting memories: {e}")

    return {
        "node": node.model_dump(),
        "edges": edges,
        "related_nodes": related_nodes,
        "memories": memories
    }
