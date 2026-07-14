from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class DocumentResponse(BaseModel):
    """Response model for a single uploaded document."""
    id: str
    filename: str
    page_count: int
    chunk_count: int
    file_size: int  # bytes
    status: str  # "processing", "ready", "error"
    uploaded_at: str
    metadata: dict = {}


class DocumentListResponse(BaseModel):
    """Response model for listing all documents."""
    documents: list[DocumentResponse]
    total: int


class UploadResponse(BaseModel):
    """Response after uploading a PDF."""
    id: str
    filename: str
    status: str
    message: str


class SourceReference(BaseModel):
    """A single source chunk referenced in the answer."""
    content: str
    page_number: Optional[int] = None
    chunk_index: int
    relevance_score: float
    document_name: str


class ChatMessage(BaseModel):
    """A single message in the chat history."""
    role: str  # "user" or "ai"
    content: str
    timestamp: str
    sources: Optional[list[SourceReference]] = None
    confidence: Optional[float] = None
    document_name: Optional[str] = None
    processing_time: Optional[float] = None


class ChatRequest(BaseModel):
    """Request body for chatting with a document."""
    chat_id: Optional[str] = None  # Optional, if not provided, new chat is created
    document_id: Optional[str] = None  # None = search all documents
    question: str


class RelatedEntity(BaseModel):
    """A related entity from the knowledge graph."""
    name: str
    type: str


class ChatResponse(BaseModel):
    """Response from the RAG pipeline with Memory Intelligence features."""
    chat_id: str  # Always returned, whether new or existing
    answer: str
    sources: list[SourceReference]
    confidence: float  # 0.0 - 1.0
    document_name: str
    processing_time: float  # seconds
    related_entities: Optional[List[RelatedEntity]] = None
    graph_node_ids: Optional[List[str]] = None
    memory_ids: Optional[List[str]] = None
    related_documents: Optional[List[dict]] = None
    related_emails: Optional[List[dict]] = None
    related_calendar_events: Optional[List[dict]] = None


class Memory(BaseModel):
    """Model representing a long-term memory with tracking fields."""
    id: str
    chat_id: str
    user_id: str
    type: str
    memory: str
    importance: float
    recency: Optional[float] = 0.0
    frequency: Optional[int] = 0
    last_accessed: Optional[str] = None
    access_count: Optional[int] = 0
    created_at: str
    updated_at: str


class TimelineEvent(BaseModel):
    """Model for a single timeline event."""
    id: str
    title: str
    description: str
    timestamp: str
    event_type: str
    icon: Optional[str] = None
    color: Optional[str] = None
    related_document: Optional[str] = None
    related_memory: Optional[str] = None
    related_graph_node: Optional[str] = None


class TimelineResponse(BaseModel):
    """Response model for timeline events grouped by date."""
    events_by_date: dict[str, list[TimelineEvent]]


class MemoryListResponse(BaseModel):
    """Response model for listing memories."""
    memories: list[Memory]
    total: int


class GraphNode(BaseModel):
    id: str
    name: str
    type: str
    description: Optional[str] = None
    created_at: str
    updated_at: str


class GraphEdge(BaseModel):
    id: str
    source_node_id: str
    target_node_id: str
    type: str
    description: Optional[str] = None
    created_at: str


class GraphData(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class RelatedMemoriesResponse(BaseModel):
    node: Optional[GraphNode]
    edges: list[dict]
    related_nodes: list[GraphNode]
    memories: list[Memory]

