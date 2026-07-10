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


class ChatRequest(BaseModel):
    """Request body for chatting with a document."""
    document_id: Optional[str] = None  # None = search all documents
    question: str


class SourceReference(BaseModel):
    """A single source chunk referenced in the answer."""
    content: str
    page_number: Optional[int] = None
    chunk_index: int
    relevance_score: float
    document_name: str


class ChatResponse(BaseModel):
    """Response from the RAG pipeline."""
    answer: str
    sources: list[SourceReference]
    confidence: float  # 0.0 - 1.0
    document_name: str
    processing_time: float  # seconds
