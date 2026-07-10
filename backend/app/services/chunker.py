"""
Text Chunker Service
Splits parsed document text into overlapping chunks for embedding.
"""

import re
from dataclasses import dataclass


@dataclass
class TextChunk:
    """A single chunk of text with metadata."""
    text: str
    chunk_index: int
    page_number: int | None = None
    start_char: int = 0
    end_char: int = 0


def chunk_text(
    text: str,
    chunk_size: int = 500,
    chunk_overlap: int = 50,
    page_number: int | None = None,
) -> list[TextChunk]:
    """
    Split text into overlapping chunks, preserving sentence boundaries.
    
    Args:
        text: The text to split.
        chunk_size: Target character count per chunk.
        chunk_overlap: Number of overlapping characters between chunks.
        page_number: Optional page number for metadata.
        
    Returns:
        List of TextChunk objects.
    """
    if not text.strip():
        return []

    # Clean the text
    text = re.sub(r"\s+", " ", text).strip()

    # Split into sentences
    sentences = re.split(r"(?<=[.!?])\s+", text)

    chunks: list[TextChunk] = []
    current_chunk: list[str] = []
    current_length = 0
    chunk_start = 0
    char_pos = 0

    for sentence in sentences:
        sentence_length = len(sentence)

        # If adding this sentence exceeds chunk_size and we have content, flush
        if current_length + sentence_length > chunk_size and current_chunk:
            chunk_text_str = " ".join(current_chunk)
            chunks.append(
                TextChunk(
                    text=chunk_text_str,
                    chunk_index=len(chunks),
                    page_number=page_number,
                    start_char=chunk_start,
                    end_char=chunk_start + len(chunk_text_str),
                )
            )

            # Calculate overlap: keep sentences from end that fit within overlap
            overlap_text = ""
            overlap_sentences: list[str] = []
            for s in reversed(current_chunk):
                if len(overlap_text) + len(s) <= chunk_overlap:
                    overlap_sentences.insert(0, s)
                    overlap_text = " ".join(overlap_sentences)
                else:
                    break

            current_chunk = overlap_sentences
            current_length = len(overlap_text)
            chunk_start = char_pos - len(overlap_text)

        current_chunk.append(sentence)
        current_length += sentence_length + 1  # +1 for space
        char_pos += sentence_length + 1

    # Flush remaining
    if current_chunk:
        chunk_text_str = " ".join(current_chunk)
        chunks.append(
            TextChunk(
                text=chunk_text_str,
                chunk_index=len(chunks),
                page_number=page_number,
                start_char=chunk_start,
                end_char=chunk_start + len(chunk_text_str),
            )
        )

    return chunks


def chunk_document_pages(
    pages: list[dict],
    chunk_size: int = 500,
    chunk_overlap: int = 50,
) -> list[TextChunk]:
    """
    Chunk a multi-page document. Each page is chunked separately,
    then all chunks are combined with sequential indices.
    
    Args:
        pages: List of dicts with 'page_number' and 'text' keys.
        chunk_size: Target character count per chunk.
        chunk_overlap: Overlap between chunks.
        
    Returns:
        List of all TextChunks across all pages.
    """
    all_chunks: list[TextChunk] = []
    global_index = 0

    for page in pages:
        page_chunks = chunk_text(
            text=page["text"],
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            page_number=page.get("page_number"),
        )
        # Re-index with global indices
        for chunk in page_chunks:
            chunk.chunk_index = global_index
            global_index += 1
            all_chunks.append(chunk)

    return all_chunks
