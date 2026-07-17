"""
Document Repository — replaces _metadata.json read/write operations.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from app.models.db_models import Document, DocumentChunk, Upload


DEFAULT_USER_ID = "default_user"


class DocumentRepository:

    @staticmethod
    def create(
        db: Session,
        doc_id: str,
        filename: str,
        file_path: Optional[str] = None,
        source: str = "upload",
        page_count: int = 0,
        chunk_count: int = 0,
        file_size: int = 0,
        status: str = "ready",
        metadata: Optional[dict] = None,
        user_id: str = DEFAULT_USER_ID,
    ) -> Document:
        """Create a new document record."""
        doc = Document(
            id=doc_id,
            user_id=user_id,
            filename=filename,
            file_path=file_path,
            source=source,
            page_count=page_count,
            chunk_count=chunk_count,
            file_size=file_size,
            status=status,
            metadata_json=metadata or {},
            uploaded_at=datetime.utcnow(),
        )
        db.add(doc)
        db.flush()
        return doc

    @staticmethod
    def get(db: Session, doc_id: str) -> Optional[Document]:
        """Get a single document by ID."""
        return db.query(Document).filter(Document.id == doc_id).first()

    @staticmethod
    def list_all(db: Session, user_id: str = DEFAULT_USER_ID) -> List[Document]:
        """List all documents for a user, newest first."""
        return (
            db.query(Document)
            .filter(Document.user_id == user_id)
            .order_by(Document.uploaded_at.desc())
            .all()
        )

    @staticmethod
    def delete(db: Session, doc_id: str) -> bool:
        """Delete a document by ID."""
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if not doc:
            return False
        db.delete(doc)
        db.flush()
        return True

    @staticmethod
    def get_by_source(db: Session, source: str, user_id: str = DEFAULT_USER_ID) -> List[Document]:
        """Get all documents from a specific source (gmail, drive, calendar, upload)."""
        return (
            db.query(Document)
            .filter(Document.user_id == user_id, Document.source == source)
            .all()
        )

    @staticmethod
    def count_by_source(db: Session, user_id: str = DEFAULT_USER_ID) -> Dict[str, int]:
        """Count documents grouped by source."""
        docs = db.query(Document).filter(Document.user_id == user_id).all()
        counts = {"document": 0, "gmail": 0, "calendar": 0}
        for doc in docs:
            src = doc.source or "document"
            if src == "upload":
                src = "document"
            counts[src] = counts.get(src, 0) + 1
        return counts

    @staticmethod
    def to_dict(doc: Document) -> Dict[str, Any]:
        """Convert a Document ORM object to a dict matching the old _metadata.json format."""
        return {
            "id": doc.id,
            "filename": doc.filename,
            "file_path": doc.file_path,
            "source": doc.source or "upload",
            "page_count": doc.page_count,
            "chunk_count": doc.chunk_count,
            "file_size": doc.file_size,
            "status": doc.status,
            "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else "",
            "metadata": doc.metadata_json or {},
        }

    @staticmethod
    def to_metadata_dict(db: Session, user_id: str = DEFAULT_USER_ID) -> Dict[str, Dict[str, Any]]:
        """
        Build a dict keyed by doc_id — exact replacement for the old
        _load_metadata() that returned {doc_id: {…}} from _metadata.json.
        """
        docs = DocumentRepository.list_all(db, user_id)
        return {doc.id: DocumentRepository.to_dict(doc) for doc in docs}

    # ── Chunk helpers (for document_chunks table) ────────────────────────

    @staticmethod
    def create_chunks(
        db: Session,
        document_id: str,
        chunks: List[Dict[str, Any]],
    ) -> int:
        """Bulk-create chunk metadata rows. Returns count created."""
        for c in chunks:
            db.add(DocumentChunk(
                document_id=document_id,
                chunk_index=c.get("chunk_index", 0),
                page_number=c.get("page_number"),
                content=c.get("content", ""),
            ))
        db.flush()
        return len(chunks)

    # ── Upload helpers ──────────────────────────────────────────────────

    @staticmethod
    def create_upload(
        db: Session,
        upload_id: str,
        filename: str,
        file_path: str,
        file_size: int,
        mime_type: Optional[str] = None,
        user_id: str = DEFAULT_USER_ID,
    ) -> Upload:
        """Create a new upload record."""
        upload = Upload(
            id=upload_id,
            user_id=user_id,
            filename=filename,
            file_path=file_path,
            file_size=file_size,
            mime_type=mime_type,
            created_at=datetime.utcnow(),
        )
        db.add(upload)
        db.flush()
        return upload

    @staticmethod
    def get_upload(db: Session, upload_id: str) -> Optional[Upload]:
        """Get an upload by ID."""
        return db.query(Upload).filter(Upload.id == upload_id).first()

    @staticmethod
    def list_uploads(db: Session, user_id: str = DEFAULT_USER_ID) -> List[Upload]:
        """List all uploads for a user."""
        return db.query(Upload).filter(Upload.user_id == user_id).order_by(Upload.created_at.desc()).all()

