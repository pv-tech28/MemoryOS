
"""
Conversation Memory Service
Stores and retrieves chat history for the EVOLVE AI chat.
"""
import os
import json
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

# Memory storage (in-memory for now, can switch to DB later)
# Structure: { chat_id: { document_id: str | None, messages: [ ... ] } }
_chat_memory: Dict[str, Dict[str, Any]] = {}


def create_chat(document_id: Optional[str] = None) -> str:
    """Create a new chat session and return its ID."""
    chat_id = str(uuid.uuid4())
    _chat_memory[chat_id] = {
        "document_id": document_id,
        "messages": [],
        "created_at": datetime.now().isoformat(),
    }
    return chat_id


def save_message(
    chat_id: str,
    role: str,
    content: str,
    sources: Optional[List[Dict[str, Any]]] = None,
    confidence: Optional[float] = None,
    document_name: Optional[str] = None,
    processing_time: Optional[float] = None,
) -> None:
    """Save a message to the chat history."""
    if chat_id not in _chat_memory:
        # Create chat if it doesn't exist
        create_chat()

    message = {
        "role": role,
        "content": content,
        "timestamp": datetime.now().isoformat(),
        "sources": sources or [],
        "confidence": confidence,
        "document_name": document_name,
        "processing_time": processing_time,
    }
    _chat_memory[chat_id]["messages"].append(message)


def get_chat_history(chat_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Retrieve the last N messages from the chat history."""
    if chat_id not in _chat_memory:
        return []
    # Return the last 'limit' messages
    return _chat_memory[chat_id]["messages"][-limit:]


def get_full_chat(chat_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve the full chat object."""
    return _chat_memory.get(chat_id)


def clear_chat(chat_id: str) -> bool:
    """Clear all messages from a specific chat."""
    if chat_id in _chat_memory:
        _chat_memory[chat_id]["messages"] = []
        return True
    return False


def delete_chat(chat_id: str) -> bool:
    """Delete a chat entirely from memory."""
    if chat_id in _chat_memory:
        del _chat_memory[chat_id]
        return True
    return False
