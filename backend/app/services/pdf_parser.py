"""
PDF Parser Service
Extracts text and metadata from PDF files using PyMuPDF (fitz).
"""

import fitz  # PyMuPDF
import os
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class ParsedPage:
    """A single page extracted from a PDF."""
    page_number: int
    text: str


@dataclass
class ParsedDocument:
    """Complete parsed output from a PDF file."""
    filename: str
    pages: list[ParsedPage]
    full_text: str
    page_count: int
    metadata: dict = field(default_factory=dict)


def parse_pdf(file_path: str) -> ParsedDocument:
    """
    Parse a PDF file and extract text from all pages.
    
    Args:
        file_path: Path to the PDF file on disk.
        
    Returns:
        ParsedDocument with extracted text, pages, and metadata.
        
    Raises:
        FileNotFoundError: If the file doesn't exist.
        ValueError: If the file is not a valid PDF or has no extractable text.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"PDF file not found: {file_path}")

    doc = fitz.open(file_path)

    # Extract metadata
    meta = doc.metadata or {}
    metadata = {
        "title": meta.get("title", ""),
        "author": meta.get("author", ""),
        "subject": meta.get("subject", ""),
        "creator": meta.get("creator", ""),
        "creation_date": meta.get("creationDate", ""),
        "modification_date": meta.get("modDate", ""),
        "file_size": os.path.getsize(file_path),
        "parsed_at": datetime.now().isoformat(),
    }

    # Extract text from each page
    pages: list[ParsedPage] = []
    full_text_parts: list[str] = []

    for page_num in range(doc.page_count):
        page = doc[page_num]
        text = page.get_text("text").strip()

        if text:
            pages.append(ParsedPage(page_number=page_num + 1, text=text))
            full_text_parts.append(text)

    page_count = doc.page_count
    doc.close()

    full_text = "\n\n".join(full_text_parts)

    if not full_text.strip():
        raise ValueError(
            f"No extractable text found in {os.path.basename(file_path)}. "
            "The PDF may be image-based — OCR support coming in Phase 4."
        )

    return ParsedDocument(
        filename=os.path.basename(file_path),
        pages=pages,
        full_text=full_text,
        page_count=page_count,
        metadata=metadata,
    )


def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    """Extract text from PDF bytes."""
    doc = fitz.open("pdf", pdf_bytes)
    full_text_parts: list[str] = []
    for page_num in range(doc.page_count):
        page = doc[page_num]
        text = page.get_text("text").strip()
        if text:
            full_text_parts.append(text)
    doc.close()
    return "\n\n".join(full_text_parts)
