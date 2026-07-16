"""
Documents Router
Handles PDF upload, listing, and deletion.
"""

import os
import uuid
from datetime import datetime
import traceback
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.repositories.document_repo import DocumentRepository
from app.models.schemas import DocumentResponse, DocumentListResponse, UploadResponse
from app.services.pdf_parser import parse_pdf
from app.services.chunker import chunk_document_pages
from app.services.embeddings import embed_texts
from app.services.vector_store import add_document, delete_document as vs_delete
from app.services.memory_graph_builder import get_graph_service, EntityNode
from app.services.timeline_service import add_timeline_event
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api/documents", tags=["documents"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")


def _ensure_dirs():
    """Ensure upload directory exists."""
    os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Upload a PDF file, parse it, generate embeddings, store in vector DB, and extract entities to knowledge graph.
    """
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported. Please upload a .pdf file."
        )

    _ensure_dirs()

    # Generate unique ID
    doc_id = str(uuid.uuid4())[:8]
    
    # Save file to disk
    file_path = os.path.join(UPLOAD_DIR, f"{doc_id}_{file.filename}")
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    try:
        # 1. Parse PDF
        print(f"[Upload] Parsing PDF: {file.filename}")
        parsed = parse_pdf(file_path)
        
        # Collect all text for entity extraction
        full_text = "\n".join([p.text for p in parsed.pages if p.text.strip()])

        # 2. Chunk the document
        print(f"[Upload] Chunking {parsed.page_count} pages...")
        pages_data = [
            {"page_number": p.page_number, "text": p.text}
            for p in parsed.pages
        ]
        chunks = chunk_document_pages(pages_data)
        chunk_texts = [c.text for c in chunks]

        if not chunk_texts:
            raise ValueError("No text chunks could be extracted from the PDF.")

        # 3. Generate embeddings
        print(f"[Upload] Generating embeddings for {len(chunk_texts)} chunks...")
        embeddings = embed_texts(chunk_texts)

        # 4. Store in vector DB
        print(f"[Upload] Storing in vector DB...")
        metadatas = [
            {
                "document_name": file.filename,
                "page_number": c.page_number or 0,
                "chunk_index": c.chunk_index,
            }
            for c in chunks
        ]
        add_document(doc_id, chunk_texts, embeddings, metadatas)

        # 5. Save metadata to DB
        DocumentRepository.create(
            db=db,
            doc_id=doc_id,
            filename=file.filename,
            file_path=file_path,
            source="upload",
            page_count=parsed.page_count,
            chunk_count=len(chunks),
            file_size=len(content),
            status="ready",
            metadata=parsed.metadata,
            user_id="default_user",
        )
        
        # Save chunks to PostgreSQL document_chunks table
        db_chunks = [
            {
                "chunk_index": c.chunk_index,
                "page_number": c.page_number,
                "content": c.text,
            }
            for c in chunks
        ]
        DocumentRepository.create_chunks(db, doc_id, db_chunks)

        # Save an entry to Uploads table
        DocumentRepository.create_upload(
            db=db,
            upload_id=doc_id,
            filename=file.filename,
            file_path=file_path,
            file_size=len(content),
            mime_type=file.content_type,
            user_id="default_user",
        )
        
        # 6. Add to knowledge graph with enhanced document node
        print(f"[Upload] Extracting entities and adding to knowledge graph...")
        graph_service = get_graph_service()
        
        # Generate a short summary (first 500 chars of full text)
        summary = full_text[:500].strip()
        if len(full_text) > 500:
            summary += "..."
        
        doc_node = EntityNode(
            name=file.filename,
            type="Document",
            description=summary,
            metadata={
                "uploaded_at": datetime.now().isoformat(),
                "page_count": parsed.page_count,
                "chunk_count": len(chunks),
                "doc_id": doc_id,
                "title": parsed.metadata.get("title", ""),
                "author": parsed.metadata.get("author", ""),
                "file_size": len(content)
            }
        )
        graph_service.process_text(
            text=full_text,
            source_node=doc_node,
            context={"type": "document", "source": "upload"}
        )

        # Add timeline event
        add_timeline_event(
            title=f"PDF Uploaded: {file.filename}",
            description=f"Successfully processed {parsed.page_count} pages into {len(chunks)} chunks.",
            event_type="pdf_upload",
            related_document=doc_id
        )

        print(f"[Upload] Document '{file.filename}' processed successfully! "
              f"({parsed.page_count} pages, {len(chunks)} chunks)")

        return UploadResponse(
            id=doc_id,
            filename=file.filename,
            status="ready",
            message=f"Successfully processed {parsed.page_count} pages into {len(chunks)} chunks.",
        )

    except Exception as e:
        # Clean up on failure
        print("[ERROR] Upload failed!")
        print(traceback.format_exc())
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=DocumentListResponse)
async def list_documents(db: Session = Depends(get_db)):
    """List all uploaded documents."""
    docs = DocumentRepository.list_all(db, user_id="default_user")
    documents = [
        DocumentResponse(**DocumentRepository.to_dict(doc))
        for doc in docs
    ]
    return DocumentListResponse(documents=documents, total=len(documents))


@router.get("/{doc_id}", response_model=DocumentResponse)
async def get_document(doc_id: str, db: Session = Depends(get_db)):
    """Get details for a single document."""
    doc = DocumentRepository.get(db, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentResponse(**DocumentRepository.to_dict(doc))


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, db: Session = Depends(get_db)):
    """Delete a document and its embeddings."""
    doc = DocumentRepository.get(db, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete file from disk
    if doc.file_path and os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception as e:
            print(f"Error removing file: {e}")

    # Delete from FAISS vector store
    vs_delete(doc_id)

    # Remove from database (cascades chunks)
    DocumentRepository.delete(db, doc_id)

    return {"message": f"Document '{doc.filename}' deleted successfully."}
