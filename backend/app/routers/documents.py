"""
Documents Router
Handles PDF upload, listing, and deletion.
"""

import os
import uuid
import json
from datetime import datetime
import traceback
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.models.schemas import DocumentResponse, DocumentListResponse, UploadResponse
from app.services.pdf_parser import parse_pdf
from app.services.chunker import chunk_document_pages
from app.services.embeddings import embed_texts
from app.services.vector_store import add_document, delete_document as vs_delete
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api/documents", tags=["documents"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
METADATA_FILE = os.path.join(UPLOAD_DIR, "_metadata.json")


def _ensure_dirs():
    """Ensure upload directory exists."""
    os.makedirs(UPLOAD_DIR, exist_ok=True)


def _load_metadata() -> dict:
    """Load document metadata from disk."""
    _ensure_dirs()
    if os.path.exists(METADATA_FILE):
        with open(METADATA_FILE, "r") as f:
            return json.load(f)
    return {}


def _save_metadata(metadata: dict):
    """Save document metadata to disk."""
    _ensure_dirs()
    with open(METADATA_FILE, "w") as f:
        json.dump(metadata, f, indent=2)


@router.post("/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...)):
    """
    Upload a PDF file, parse it, generate embeddings, and store in ChromaDB.
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

        # 4. Store in ChromaDB
        print(f"[Upload] Storing in ChromaDB...")
        metadatas = [
            {
                "document_name": file.filename,
                "page_number": c.page_number or 0,
                "chunk_index": c.chunk_index,
            }
            for c in chunks
        ]
        add_document(doc_id, chunk_texts, embeddings, metadatas)

        # 5. Save metadata
        all_metadata = _load_metadata()
        all_metadata[doc_id] = {
            "id": doc_id,
            "filename": file.filename,
            "file_path": file_path,
            "page_count": parsed.page_count,
            "chunk_count": len(chunks),
            "file_size": len(content),
            "status": "ready",
            "uploaded_at": datetime.now().isoformat(),
            "metadata": parsed.metadata,
        }
        _save_metadata(all_metadata)

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
async def list_documents():
    """List all uploaded documents."""
    all_metadata = _load_metadata()
    documents = [
        DocumentResponse(**doc_data)
        for doc_data in all_metadata.values()
    ]
    # Sort by upload date, newest first
    documents.sort(key=lambda d: d.uploaded_at, reverse=True)
    return DocumentListResponse(documents=documents, total=len(documents))


@router.get("/{doc_id}", response_model=DocumentResponse)
async def get_document(doc_id: str):
    """Get details for a single document."""
    all_metadata = _load_metadata()
    if doc_id not in all_metadata:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentResponse(**all_metadata[doc_id])


@router.delete("/{doc_id}")
async def delete_document(doc_id: str):
    """Delete a document and its embeddings."""
    all_metadata = _load_metadata()
    if doc_id not in all_metadata:
        raise HTTPException(status_code=404, detail="Document not found")

    doc = all_metadata[doc_id]

    # Delete file from disk
    if os.path.exists(doc.get("file_path", "")):
        os.remove(doc["file_path"])

    # Delete from ChromaDB
    vs_delete(doc_id)

    # Remove from metadata
    del all_metadata[doc_id]
    _save_metadata(all_metadata)

    return {"message": f"Document '{doc['filename']}' deleted successfully."}
