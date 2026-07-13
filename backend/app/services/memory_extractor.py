
"""
Memory Extraction Engine
Extracts, classifies and stores important memories from conversations
"""
import os
import json
from typing import Optional, List, Dict, Any
from google import genai
from .memory_store import (
    create_memory,
    get_relevant_memories
)

# Initialize Gemini client (reusing same config from rag_engine)
_gemini_client: Optional[genai.Client] = None

def get_gemini_client() -> genai.Client:
    global _gemini_client
    if _gemini_client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not set")
        _gemini_client = genai.Client(api_key=api_key)
    return _gemini_client

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
  {{"type": "personal", "memory": "User's name is Siddh", "importance": 0.9}},
  {{"type": "goal", "memory": "User is preparing for software placements", "importance": 0.8}},
  {{"type": "preference", "memory": "User's favorite language is Python", "importance": 0.7}}
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

    # Use Gemini to extract memories
    client = get_gemini_client()
    model_name = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")

    try:
        response = client.models.generate_content(
            model=model_name,
            contents=f"{EXTRACTION_PROMPT}\n{conv_text}",
            config=genai.types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=1024
            )
        )

        # Parse response
        text_response = response.text
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
                memory_id = create_memory(
                    chat_id=chat_id,
                    memory_type=memory_obj["type"],
                    memory_text=memory_obj["memory"],
                    importance=importance,
                    user_id=user_id
                )
                stored_ids.append(memory_id)

        return stored_ids

    except Exception as e:
        print(f"[MemoryExtractor] Error extracting memories: {e}")
        return []
