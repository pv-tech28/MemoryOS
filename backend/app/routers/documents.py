"""
Documents Router
Handles PDF, DOCX, TXT, image (OCR), and audio (Whisper) upload, listing, and deletion.
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
from app.dependencies import get_current_user
from app.models.db_models import User

# New imports for additional file types (optional)
try:
    import docx
except ImportError:
    docx = None
try:
    from PIL import Image
except ImportError:
    Image = None
try:
    import pytesseract
except ImportError:
    pytesseract = None
try:
    import whisper
except ImportError:
    whisper = None

load_dotenv()

router = APIRouter(prefix="/api/documents", tags=["documents"])

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")

# Initialize Whisper model (load once, optional)
_whisper_model = None

def get_whisper_model():
    global _whisper_model
    if whisper is None:
        raise RuntimeError("whisper not installed, audio parsing unavailable")
    if _whisper_model is None:
        print("[Whisper] Loading Whisper model (base)...")
        _whisper_model = whisper.load_model("base")
    return _whisper_model

def _ensure_dirs():
    """Ensure upload directory exists."""
    os.makedirs(UPLOAD_DIR, exist_ok=True)

def parse_txt(file_path: str) -> tuple[str, dict]:
    """Parse plain text file."""
    with open(file_path, "r", encoding="utf-8") as f:
        text = f.read()
    return text, {}

def parse_docx(file_path: str) -> tuple[str, dict]:
    """Parse DOCX file."""
    if docx is None:
        raise RuntimeError("python-docx not installed, DOCX parsing unavailable")
    doc = docx.Document(file_path)
    full_text = []
    for para in doc.paragraphs:
        full_text.append(para.text)
    text = "\n".join(full_text)
    return text, {}

def parse_image(file_path: str) -> tuple[str, dict]:
    """Parse image using OCR (pytesseract)."""
    if Image is None or pytesseract is None:
        raise RuntimeError("Pillow or pytesseract not installed, image OCR unavailable")
    img = Image.open(file_path)
    text = pytesseract.image_to_string(img)
    return text, {}

def parse_audio(file_path: str) -> tuple[str, dict]:
    """Parse audio using Whisper speech to text."""
    if whisper is None:
        raise RuntimeError("whisper not installed, audio parsing unavailable")
    model = get_whisper_model()
    result = model.transcribe(file_path)
    return result["text"], {"language": result.get("language")}


@router.post("/upload", response_model=UploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a PDF, DOCX, TXT, image (JPG/JPEG/PNG/WEBP), or audio (MP3/WAV/M4A) file,
    parse it, generate embeddings, store in vector DB, and extract entities to knowledge graph.
    """
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")
    filename_lower = file.filename.lower()
    
    supported_extensions = (".pdf", ".docx", ".txt", ".jpg", ".jpeg", ".png", ".webp", ".mp3", ".wav", ".m4a")
    if not filename_lower.endswith(supported_extensions):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Please upload PDF, DOCX, TXT, image (JPG/JPEG/PNG/WEBP), or audio (MP3/WAV/M4A)."
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
        page_count = 1
        metadata = {}
        
        # Parse the file based on type
        print(f"[Upload] Parsing {file.filename}")
        if filename_lower.endswith(".pdf"):
            parsed = parse_pdf(file_path)
            full_text = "\n".join([p.text for p in parsed.pages if p.text.strip()])
            page_count = parsed.page_count
            metadata = parsed.metadata
        elif filename_lower.endswith(".docx"):
            full_text, metadata = parse_docx(file_path)
        elif filename_lower.endswith(".txt"):
            full_text, metadata = parse_txt(file_path)
        elif filename_lower.endswith((".jpg", ".jpeg", ".png", ".webp")):
            full_text, metadata = parse_image(file_path)
        elif filename_lower.endswith((".mp3", ".wav", ".m4a")):
            full_text, metadata = parse_audio(file_path)
        else:
            raise ValueError("Unsupported file type")

        if not full_text.strip():
            raise ValueError("No text content could be extracted from the file.")

        # Chunk the document
        print(f"[Upload] Chunking document...")
        pages_data = [{"page_number": 1, "text": full_text}]
        chunks = chunk_document_pages(pages_data)
        chunk_texts = [c.text for c in chunks]

        if not chunk_texts:
            raise ValueError("No text chunks could be extracted from the file.")

        # Generate embeddings
        print(f"[Upload] Generating embeddings for {len(chunk_texts)} chunks...")
        embeddings = embed_texts(chunk_texts)

        # Store in vector DB
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

        # Save metadata to DB
        DocumentRepository.create(
            db=db,
            doc_id=doc_id,
            filename=file.filename,
            file_path=file_path,
            source="upload",
            page_count=page_count,
            chunk_count=len(chunks),
            file_size=len(content),
            status="ready",
            metadata=metadata,
            user_id=current_user.id,
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
            user_id=current_user.id,
        )
        
        # Add to knowledge graph with enhanced document node
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
                "page_count": page_count,
                "chunk_count": len(chunks),
                "doc_id": doc_id,
                "title": metadata.get("title", ""),
                "author": metadata.get("author", ""),
                "file_size": len(content)
            },
            source_doc_ids=[doc_id]
        )
        graph_service.process_text(
            text=full_text,
            source_node=doc_node,
            context={"type": "document", "source": "upload"},
            doc_id=doc_id
        )

        # Determine event type for timeline
        event_type = "file_upload"
        if filename_lower.endswith(".pdf"):
            event_type = "pdf_upload"
        elif filename_lower.endswith((".jpg", ".jpeg", ".png", ".webp")):
            event_type = "image_upload"
        elif filename_lower.endswith((".mp3", ".wav", ".m4a")):
            event_type = "audio_upload"
        
        # Add timeline event
        add_timeline_event(
            title=f"File Uploaded: {file.filename}",
            description=f"Successfully processed into {len(chunks)} chunks.",
            event_type=event_type,
            related_document=doc_id
        )

        print(f"[Upload] Document '{file.filename}' processed successfully! ({len(chunks)} chunks)")

        return UploadResponse(
            id=doc_id,
            filename=file.filename,
            status="ready",
            message=f"Successfully processed into {len(chunks)} chunks.",
        )

    except Exception as e:
        # Clean up on failure
        print("[ERROR] Upload failed!")
        print(traceback.format_exc())
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=DocumentListResponse)
async def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all uploaded documents."""
    docs = DocumentRepository.list_all(db, user_id=current_user.id)
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
