from pydantic import BaseModel
from typing import Optional
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


class ChatResponse(BaseModel):
    """Response from the RAG pipeline."""
    chat_id: str  # Always returned, whether new or existing
    answer: str
    sources: list[SourceReference]
    confidence: float  # 0.0 - 1.0
    document_name: str
    processing_time: float  # seconds


class Memory(BaseModel):
    """Model representing a long-term memory."""
    id: str
    chat_id: str
    user_id: str
    type: str
    memory: str
    importance: float
    created_at: str
    updated_at: str


class MemoryListResponse(BaseModel):
    """Response model for listing memories."""
    memories: list[Memory]
    total: int
