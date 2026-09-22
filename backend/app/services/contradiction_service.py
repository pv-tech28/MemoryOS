"""
Contradiction Detection & Belief Versioning Service for MemoryOS.

Evaluates incoming facts against existing memories to detect:
1. Direct contradictions (flagged for review)
2. Temporal updates (auto-superseded if confidence > 0.85, else queued)
3. Compatible facts and refinements (activated)
"""

import json
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
import numpy as np

from app.database import SessionLocal
from app.models.db_models import Memory
from app.repositories.memory_repo import MemoryRepository
from app.services.llm import get_llm_provider

logger = logging.getLogger("contradiction_service")

# Singleton fastembed model
_embed_model = None


def get_embedding_model():
    global _embed_model
    if _embed_model is None:
        try:
            from fastembed import TextEmbedding
            _embed_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
        except Exception as e:
            logger.warning(f"FastEmbed initialization fallback: {e}")
            _embed_model = False
    return _embed_model if _embed_model is not False else None


CONTRADICTION_PROMPT = """You are a precision epistemic logic judge for a personal memory system.
Your job is to determine whether a NEW incoming fact conflicts with, updates, or is compatible with an EXISTING active memory.

EXISTING MEMORY:
"{existing_fact}"

NEW INCOMING FACT:
"{new_fact}"

CONTEXT / MEMORY TYPE:
"{memory_type}"

Analyze the two statements:
1. "CONTRADICTION": The new fact directly and logically contradicts the existing fact in the same time/context (e.g. "Favorite language is Python" vs "Hates Python and only uses Go").
2. "TEMPORAL_UPDATE": The new fact describes a state change, relocation, job change, completed project, or new preference over time that makes the existing fact obsolete (e.g. "Lives in San Francisco" vs "Relocated to Berlin").
3. "REFINEMENT": The new fact provides more detail, nuance, or clarification to the existing fact without contradicting it (e.g. "Lives in Berlin" vs "Lives in Kreuzberg, Berlin").
4. "COMPATIBLE": Both facts can easily be true at the same time without any conflict (e.g. "Software engineer" vs "Enjoys rock climbing").

Respond ONLY with a valid JSON object matching this exact schema:
{{
  "classification": "CONTRADICTION" | "TEMPORAL_UPDATE" | "REFINEMENT" | "COMPATIBLE",
  "confidence": <float between 0.0 and 1.0>,
  "explanation": "<one sentence explanation of why they conflict or update>",
  "temporal_aspect": <true if this represents a change over time, false otherwise>
}}
"""


class ContradictionService:

    @staticmethod
    def compute_similarity(text_a: str, text_b: str) -> float:
        """Compute cosine similarity between two texts using FastEmbed."""
        model = get_embedding_model()
        if model is not None:
            try:
                vecs = list(model.embed([text_a, text_b]))
                v1, v2 = vecs[0], vecs[1]
                dot = np.dot(v1, v2)
                norm = np.linalg.norm(v1) * np.linalg.norm(v2)
                if norm > 0:
                    return float(dot / norm)
            except Exception as e:
                logger.debug(f"Embedding computation error: {e}")

        # Lightweight fallback: word overlap Jaccard similarity
        words_a = set(text_a.lower().split())
        words_b = set(text_b.lower().split())
        union = len(words_a | words_b)
        if not union:
            return 0.0
        return len(words_a & words_b) / union

    @staticmethod
    def find_candidates(
        db,
        user_id: str,
        incoming_text: str,
        incoming_type: str,
        threshold: float = 0.65,
    ) -> List[Tuple[Memory, float]]:
        """Find active existing memories that semantically overlap with incoming text."""
        # 1. Fetch active memories for this user
        active_mems = MemoryRepository.get_active_memories(db, user_id=user_id, memory_type=incoming_type)
        if not active_mems:
            # Also check across all memory types if none found in same type
            active_mems = MemoryRepository.get_active_memories(db, user_id=user_id, memory_type=None, limit=50)

        candidates = []
        for mem in active_mems:
            # Avoid comparing identical texts
            if mem.memory.strip().lower() == incoming_text.strip().lower():
                candidates.append((mem, 1.0))
                continue

            sim = ContradictionService.compute_similarity(incoming_text, mem.memory)
            if sim >= threshold:
                candidates.append((mem, sim))

        # Sort by highest similarity
        candidates.sort(key=lambda x: x[1], reverse=True)
        return candidates

    @staticmethod
    def evaluate_with_llm(
        existing_text: str,
        incoming_text: str,
        memory_type: str,
    ) -> Dict[str, Any]:
        """Classify relationship between two facts using LLM."""
        try:
            llm = get_llm_provider()
            prompt = CONTRADICTION_PROMPT.format(
                existing_fact=existing_text,
                new_fact=incoming_text,
                memory_type=memory_type,
            )
            response = llm.generate(prompt=prompt, temperature=0.0, max_tokens=256)
            text_resp = response.get("text", "").strip()

            if text_resp.startswith("```json"):
                text_resp = text_resp[7:]
            if text_resp.endswith("```"):
                text_resp = text_resp[:-3]

            parsed = json.loads(text_resp.strip())
            return {
                "classification": parsed.get("classification", "COMPATIBLE"),
                "confidence": float(parsed.get("confidence", 0.5)),
                "explanation": parsed.get("explanation", ""),
                "temporal_aspect": bool(parsed.get("temporal_aspect", False)),
            }
        except Exception as e:
            logger.warning(f"LLM contradiction evaluation error: {e}")
            return {
                "classification": "COMPATIBLE",
                "confidence": 0.5,
                "explanation": f"Evaluation fallback: {e}",
                "temporal_aspect": False,
            }

    @staticmethod
    def process_incoming_memory(
        memory_id: str,
        user_id: str,
        source_ref: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Main worker function: processes a pending memory against existing active memories.
        Transitions status from 'pending_review' to 'active', 'superseded', or 'disputed'.
        """
        db = SessionLocal()
        try:
            # 1. Fetch the target memory
            mem = MemoryRepository.get_by_id(db, memory_id)
            if not mem:
                return {"status": "not_found", "memory_id": memory_id}

            # If already processed or no longer pending_review, skip
            if mem.status not in ("pending_review", "active"):
                return {"status": "skipped", "current_status": mem.status}

            # 2. Dedup guard: if source_ref is already processed by an active memory
            if source_ref:
                existing_ref = (
                    db.query(Memory)
                    .filter(
                        Memory.user_id == mem.user_id,
                        Memory.source_ref == source_ref,
                        Memory.id != memory_id,
                        Memory.status == "active",
                    )
                    .first()
                )
                if existing_ref:
                    # Same source already yielded an active memory; discard duplicate
                    mem.status = "superseded"
                    mem.superseded_by_id = existing_ref.id
                    mem.valid_until = datetime.utcnow()
                    db.commit()
                    return {"status": "dedup_skipped", "existing_id": existing_ref.id}

            # 3. Candidate Retrieval
            candidates = ContradictionService.find_candidates(
                db,
                user_id=mem.user_id,
                incoming_text=mem.memory,
                incoming_type=mem.type,
                threshold=0.65,
            )

            if not candidates:
                # No candidates found — completely compatible, activate
                mem.status = "active"
                db.commit()
                return {"status": "activated", "reason": "no_candidates"}

            # 4. Check candidates with LLM
            conflict_created = False
            for existing_mem, sim in candidates:
                # If exact same text, bump importance and supersede the newer duplicate
                if existing_mem.memory.strip().lower() == mem.memory.strip().lower():
                    existing_mem.importance = min(1.0, (existing_mem.importance or 0.5) + 0.1)
                    existing_mem.updated_at = datetime.utcnow()
                    mem.status = "superseded"
                    mem.superseded_by_id = existing_mem.id
                    mem.valid_until = datetime.utcnow()
                    db.commit()
                    return {"status": "merged_duplicate", "canonical_id": existing_mem.id}

                eval_result = ContradictionService.evaluate_with_llm(
                    existing_text=existing_mem.memory,
                    incoming_text=mem.memory,
                    memory_type=mem.type,
                )

                classification = eval_result["classification"]
                confidence = eval_result["confidence"]
                explanation = eval_result["explanation"]

                if classification == "TEMPORAL_UPDATE":
                    # Constraint 1: confidence > 0.85 gate
                    if confidence > 0.85:
                        # Auto-supersede old memory
                        MemoryRepository.supersede(db, old_memory_id=existing_mem.id, new_memory_id=mem.id)
                        mem.status = "active"
                        mem.confidence = confidence
                        db.commit()
                        return {
                            "status": "auto_superseded",
                            "superseded_memory_id": existing_mem.id,
                            "confidence": confidence,
                        }
                    else:
                        # Low confidence temporal update -> queue for user review
                        MemoryRepository.create_conflict(
                            db=db,
                            user_id=mem.user_id,
                            existing_memory_id=existing_mem.id,
                            incoming_memory_text=mem.memory,
                            incoming_memory_type=mem.type,
                            conflict_type="temporal_update_low_confidence",
                            confidence=confidence,
                            explanation=explanation,
                        )
                        mem.status = "disputed"
                        mem.confidence = confidence
                        conflict_created = True
                        break

                elif classification == "CONTRADICTION":
                    # Direct contradiction -> queue for user review
                    MemoryRepository.create_conflict(
                        db=db,
                        user_id=mem.user_id,
                        existing_memory_id=existing_mem.id,
                        incoming_memory_text=mem.memory,
                        incoming_memory_type=mem.type,
                        conflict_type="contradiction",
                        confidence=confidence,
                        explanation=explanation,
                    )
                    mem.status = "disputed"
                    mem.confidence = confidence
                    conflict_created = True
                    break

                elif classification == "REFINEMENT":
                    # Keep both, boost importance
                    existing_mem.importance = min(1.0, (existing_mem.importance or 0.5) + 0.05)
                    mem.status = "active"

            if not conflict_created and mem.status == "pending_review":
                mem.status = "active"

            db.commit()
            return {
                "status": "resolved",
                "final_status": mem.status,
                "conflict_created": conflict_created,
            }

        except Exception as e:
            db.rollback()
            logger.error(f"Error in process_incoming_memory: {e}", exc_info=True)
            return {"status": "error", "message": str(e)}
        finally:
            db.close()
