"""
SQLAlchemy ORM models for EVOLVE AI.
All relational data lives here — PostgreSQL via Supabase.
"""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Integer, Float, Boolean, DateTime, ForeignKey,
    JSON, Index, CheckConstraint,
)
from sqlalchemy.orm import relationship
from app.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


# ─────────────────────────────────────────────────────────────────────────────
# Users
# ─────────────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, nullable=True, unique=True)
    display_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    documents = relationship("Document", back_populates="user", cascade="all, delete-orphan")
    chats = relationship("Chat", back_populates="user", cascade="all, delete-orphan")
    memories = relationship("Memory", back_populates="user", cascade="all, delete-orphan")
    timeline_events = relationship("TimelineEventModel", back_populates="user", cascade="all, delete-orphan")
    google_credentials = relationship("GoogleCredential", back_populates="user", cascade="all, delete-orphan")
    uploads = relationship("Upload", back_populates="user", cascade="all, delete-orphan")



# ─────────────────────────────────────────────────────────────────────────────
# Documents
# ─────────────────────────────────────────────────────────────────────────────

class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=True)
    source = Column(String, default="upload")  # upload, gmail, drive, calendar
    page_count = Column(Integer, default=0)
    chunk_count = Column(Integer, default=0)
    file_size = Column(Integer, default=0)
    status = Column(String, default="ready")
    metadata_json = Column(JSON, default=dict)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_documents_source", "source"),
        Index("ix_documents_uploaded_at", "uploaded_at"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Document Chunks (metadata only — embeddings stay in FAISS)
# ─────────────────────────────────────────────────────────────────────────────

class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(String, primary_key=True, default=generate_uuid)
    document_id = Column(String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    page_number = Column(Integer, nullable=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    document = relationship("Document", back_populates="chunks")


# ─────────────────────────────────────────────────────────────────────────────
# Chats
# ─────────────────────────────────────────────────────────────────────────────

class Chat(Base):
    __tablename__ = "chats"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    document_id = Column(String, ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="chats")
    messages = relationship("ChatMessage", back_populates="chat", cascade="all, delete-orphan",
                            order_by="ChatMessage.created_at")


# ─────────────────────────────────────────────────────────────────────────────
# Chat Messages
# ─────────────────────────────────────────────────────────────────────────────

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, default=generate_uuid)
    chat_id = Column(String, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String, nullable=False)  # "user" or "ai"
    content = Column(Text, nullable=False)
    sources = Column(JSON, nullable=True)
    confidence = Column(Float, nullable=True)
    document_name = Column(String, nullable=True)
    processing_time = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    chat = relationship("Chat", back_populates="messages")


# ─────────────────────────────────────────────────────────────────────────────
# Memories (long-term)
# ─────────────────────────────────────────────────────────────────────────────

MEMORY_TYPES = [
    "personal", "goal", "project", "preference", "skill",
    "deadline", "task", "education", "career", "custom",
]


class Memory(Base):
    __tablename__ = "memories"

    id = Column(String, primary_key=True, default=generate_uuid)
    chat_id = Column(String, nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String, nullable=False)
    memory = Column(Text, nullable=False)
    importance = Column(Float, default=0.5)
    recency = Column(Float, default=0.0)
    frequency = Column(Integer, default=0)
    last_accessed = Column(DateTime, nullable=True)
    access_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="memories")

    __table_args__ = (
        Index("ix_memories_importance", "importance"),
        Index("ix_memories_type", "type"),
        Index("ix_memories_chat_id", "chat_id"),
        CheckConstraint("importance >= 0 AND importance <= 1", name="ck_memories_importance_range"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Timeline Events
# ─────────────────────────────────────────────────────────────────────────────

class TimelineEventModel(Base):
    __tablename__ = "timeline_events"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    event_type = Column(String, nullable=False)
    color = Column(String, nullable=True)
    related_document = Column(String, nullable=True)
    related_memory = Column(String, nullable=True)
    related_graph_node = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="timeline_events")

    __table_args__ = (
        Index("ix_timeline_events_created_at", "created_at"),
        Index("ix_timeline_events_event_type", "event_type"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Knowledge Graph Nodes
# ─────────────────────────────────────────────────────────────────────────────

class GraphNodeModel(Base):
    __tablename__ = "graph_nodes"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    importance = Column(Float, default=0.5)
    metadata_json = Column(JSON, default=dict)
    access_count = Column(Integer, default=0)
    last_accessed = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships (as source)
    outgoing_edges = relationship(
        "GraphEdgeModel", foreign_keys="GraphEdgeModel.source_id",
        back_populates="source_node", cascade="all, delete-orphan"
    )
    incoming_edges = relationship(
        "GraphEdgeModel", foreign_keys="GraphEdgeModel.target_id",
        back_populates="target_node", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_graph_nodes_name", "name"),
        Index("ix_graph_nodes_type", "type"),
        Index("ix_graph_nodes_importance", "importance"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Knowledge Graph Edges
# ─────────────────────────────────────────────────────────────────────────────

class GraphEdgeModel(Base):
    __tablename__ = "graph_edges"

    id = Column(String, primary_key=True, default=generate_uuid)
    source_id = Column(String, ForeignKey("graph_nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    target_id = Column(String, ForeignKey("graph_nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    strength = Column(Float, default=1.0)
    access_count = Column(Integer, default=0)
    last_accessed = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    source_node = relationship("GraphNodeModel", foreign_keys=[source_id], back_populates="outgoing_edges")
    target_node = relationship("GraphNodeModel", foreign_keys=[target_id], back_populates="incoming_edges")

    __table_args__ = (
        Index("ix_graph_edges_type", "type"),
        Index("ix_graph_edges_source_target", "source_id", "target_id"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Google OAuth Credentials
# ─────────────────────────────────────────────────────────────────────────────

class GoogleCredential(Base):
    __tablename__ = "google_credentials"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True, unique=True)
    provider = Column(String, default="google")
    token = Column(Text, nullable=True)
    refresh_token = Column(Text, nullable=True)
    token_uri = Column(String, nullable=True)
    client_id = Column(String, nullable=True)
    client_secret = Column(String, nullable=True)
    scopes = Column(JSON, nullable=True)
    expiry = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="google_credentials")


# ─────────────────────────────────────────────────────────────────────────────
# Uploads
# ─────────────────────────────────────────────────────────────────────────────

class Upload(Base):
    __tablename__ = "uploads"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=True)
    file_size = Column(Integer, default=0)
    mime_type = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="uploads")

