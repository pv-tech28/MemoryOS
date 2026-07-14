
"""
Memory Extraction Engine
Extracts, classifies and stores important memories from conversations
"""
import os
import json
import traceback
from typing import Optional, List, Dict, Any
from .memory_store import (
    create_memory,
    get_relevant_memories,
    find_existing_memory,
    update_memory,
    increment_access
)
from .memory_graph_builder import (
    update_graph_from_memory
)
from .ai_provider import generate_response

EXTRACTION_PROMPT = """You are a memory extraction engine. Your task is to analyze conversations and extract only the IMPORTANT, MEMORABLE facts.

Important memories are things like:
- Personal information (name, age, location, etc.)
- Goals and plans (career, personal, future plans)
- Projects and work
- Preferences (favorite things, likes/dislikes)
- Skills and expertise
- Deadlines and important tasks
- Education and career details

DO NOT extract:
- Greetings, casual conversation
- Small talk
- Trivial or unimportant details

Respond ONLY with a JSON array of memory objects. Each memory must have:
- type: one of (personal, goal, project, preference, skill, deadline, task, education, career, custom)
- memory: the important fact in a concise sentence
- importance: a number between 0 and 1 (1 = most important)

Example output format:
[
  {"type": "personal", "memory": "User's name is Siddh", "importance": 0.9},
  {"type": "goal", "memory": "User is preparing for software placements", "importance": 0.8},
  {"type": "preference", "memory": "User's favorite language is Python", "importance": 0.7}
]

If there are NO important memories, output an empty array: []

Now analyze this conversation and extract memories:
"""

def extract_memories(
    chat_id: str,
    conversation_history: List[Dict[str, Any]],
    user_id: str = "default",
    importance_threshold: float = 0.4
) -> List[str]:
    """
    Extract and store important memories from a conversation
    Returns list of stored memory IDs
    """
    if len(conversation_history) == 0:
        return []

    # Prepare conversation text
    conv_text = ""
    for msg in conversation_history:
        role = "User" if msg["role"] == "user" else "Assistant"
        conv_text += f"{role}: {msg['content']}\n"

    # Use OpenRouter to extract memories
    try:
        text_response = generate_response(
            prompt=f"{EXTRACTION_PROMPT}\n{conv_text}",
            temperature=0.1,
            max_tokens=1024
        )
        # Clean up response to get valid JSON
        json_str = text_response.strip()
        if json_str.startswith("```json"):
            json_str = json_str[7:]
        if json_str.endswith("```"):
            json_str = json_str[:-3]
        json_str = json_str.strip()

        extracted = json.loads(json_str)
        stored_ids = []

        for memory_obj in extracted:
            # Validate the extracted memory
            if "type" not in memory_obj or "memory" not in memory_obj:
                continue

            importance = memory_obj.get("importance", 0.5)
            if importance >= importance_threshold:
                # Check for existing memory
                existing = find_existing_memory(
                    memory_text=memory_obj["memory"],
                    memory_type=memory_obj["type"],
                    user_id=user_id
                )

                if existing:
                    # Update existing memory: keep text, boost importance
                    new_importance = min(1.0, existing["importance"] + 0.1)
                    update_memory(
                        memory_id=existing["id"],
                        memory_text=memory_obj["memory"],  # Use latest version
                        importance=new_importance,
                        memory_type=memory_obj["type"]
                    )
                    stored_ids.append(existing["id"])
                else:
                    # Create new memory
                    memory_id = create_memory(
                        chat_id=chat_id,
                        memory_type=memory_obj["type"],
                        memory_text=memory_obj["memory"],
                        importance=importance,
                        user_id=user_id
                    )
                    stored_ids.append(memory_id)
                
                # Update memory graph (for both new and updated memories)
                try:
                    update_graph_from_memory(
                        memory_text=memory_obj["memory"],
                        memory_type=memory_obj["type"]
                    )
                except Exception as e:
                    print(f"[MemoryExtractor] Error updating graph: {e}")

        return stored_ids

    except Exception as e:
        print(f"[MemoryExtractor] Error extracting memories: {e}")
        traceback.print_exc()
        return []
