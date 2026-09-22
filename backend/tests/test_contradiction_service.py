"""
Tests for Contradiction Detection, Belief Versioning, and Resolution Workflow.
"""

import pytest
import uuid
from datetime import datetime
from unittest.mock import patch, MagicMock

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models.db_models import User, Memory, MemoryConflict
from app.repositories.memory_repo import MemoryRepository
from app.services.contradiction_service import ContradictionService


@pytest.fixture
def db_session():
    """Create an isolated in-memory SQLite database session for tests."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Create test user
    user = User(
        id="test-user-id",
        email="test@example.com",
        username="tester",
        plan="free",
    )
    session.add(user)
    session.commit()

    yield session
    session.close()


def test_similarity_computation():
    """Test cosine similarity between contradictory/overlapping facts."""
    sim_high = ContradictionService.compute_similarity(
        "User lives in Berlin",
        "User lives in San Francisco"
    )
    assert sim_high > 0.65, f"Expected high semantic overlap, got {sim_high}"

    sim_low = ContradictionService.compute_similarity(
        "Cooking Italian marinara pasta recipes",
        "Astrophysics stellar nuclear fusion equations"
    )
    assert sim_low < 0.50, f"Expected low similarity, got {sim_low}"
    assert (sim_high - sim_low) > 0.25, "Expected significant difference between overlapping and non-overlapping facts"


def test_active_memory_query_isolation(db_session):
    """Verify that only status='active' memories are returned for RAG/retrieval."""
    user_id = "test-user-id"

    # Active memory
    m1 = MemoryRepository.create(
        db_session, chat_id="c1", memory_type="personal",
        memory_text="User works as a software engineer",
        user_id=user_id, status="active", importance=0.8
    )
    # Superseded memory
    m2 = MemoryRepository.create(
        db_session, chat_id="c1", memory_type="personal",
        memory_text="User is a university student",
        user_id=user_id, status="superseded", importance=0.9
    )
    # Disputed memory
    m3 = MemoryRepository.create(
        db_session, chat_id="c1", memory_type="personal",
        memory_text="User lives on Mars",
        user_id=user_id, status="disputed", importance=0.7
    )
    db_session.commit()

    relevant = MemoryRepository.get_relevant(db_session, query_text="occupation", user_id=user_id)
    ids = [r["id"] for r in relevant]

    assert m1 in ids
    assert m2 not in ids
    assert m3 not in ids


def test_auto_supersede_temporal_update_high_confidence(db_session):
    """Constraint 1: When TEMPORAL_UPDATE confidence > 0.85, auto-supersede old memory."""
    user_id = "test-user-id"

    # Existing memory
    old_id = MemoryRepository.create(
        db_session, chat_id="c1", memory_type="personal",
        memory_text="User lives in San Francisco",
        user_id=user_id, status="active", importance=0.8
    )

    # Incoming pending memory
    new_id = MemoryRepository.create(
        db_session, chat_id="c2", memory_type="personal",
        memory_text="User relocated to Berlin last week",
        user_id=user_id, status="pending_review", importance=0.8,
        source_ref="chat:c2"
    )
    db_session.commit()

    # Mock LLM response with high confidence temporal update
    mock_llm_eval = {
        "classification": "TEMPORAL_UPDATE",
        "confidence": 0.95,
        "explanation": "Relocating from SF to Berlin is a state change over time.",
        "temporal_aspect": True,
    }

    with patch.object(ContradictionService, "evaluate_with_llm", return_value=mock_llm_eval), \
         patch("app.services.contradiction_service.SessionLocal", return_value=db_session):
        result = ContradictionService.process_incoming_memory(new_id, user_id, source_ref="chat:c2")

    assert result["status"] == "auto_superseded"

    # Verify old memory is superseded with timestamp and link
    old_mem = MemoryRepository.get_by_id(db_session, old_id)
    new_mem = MemoryRepository.get_by_id(db_session, new_id)

    assert old_mem.status == "superseded"
    assert old_mem.valid_until is not None
    assert old_mem.superseded_by_id == new_id

    # Verify new memory is active
    assert new_mem.status == "active"
    assert new_mem.confidence == 0.95

    # Verify no conflicts were queued
    conflicts = MemoryRepository.get_pending_conflicts(db_session, user_id)
    assert len(conflicts) == 0


def test_low_confidence_temporal_update_queued_for_review(db_session):
    """Constraint 1: When TEMPORAL_UPDATE confidence <= 0.85, queue for review instead of auto-superseding."""
    user_id = "test-user-id"

    old_id = MemoryRepository.create(
        db_session, chat_id="c1", memory_type="project",
        memory_text="Working on project Alpha as frontend lead",
        user_id=user_id, status="active"
    )
    new_id = MemoryRepository.create(
        db_session, chat_id="c2", memory_type="project",
        memory_text="Maybe shifting focus towards project Beta",
        user_id=user_id, status="pending_review",
        source_ref="chat:c2"
    )
    db_session.commit()

    mock_llm_eval = {
        "classification": "TEMPORAL_UPDATE",
        "confidence": 0.72,  # <= 0.85 threshold!
        "explanation": "Tentative project shift statement.",
        "temporal_aspect": True,
    }

    with patch.object(ContradictionService, "evaluate_with_llm", return_value=mock_llm_eval), \
         patch("app.services.contradiction_service.SessionLocal", return_value=db_session):
        result = ContradictionService.process_incoming_memory(new_id, user_id, source_ref="chat:c2")

    assert result["conflict_created"] is True

    # Old memory remains active until reviewed
    old_mem = MemoryRepository.get_by_id(db_session, old_id)
    assert old_mem.status == "active"

    # Incoming memory marked disputed
    new_mem = MemoryRepository.get_by_id(db_session, new_id)
    assert new_mem.status == "disputed"

    # Queued in memory_conflicts
    conflicts = MemoryRepository.get_pending_conflicts(db_session, user_id)
    assert len(conflicts) == 1
    assert conflicts[0]["conflict_type"] == "temporal_update_low_confidence"
    assert conflicts[0]["existing_memory_id"] == old_id


def test_direct_contradiction_queued_for_review(db_session):
    """When CONTRADICTION detected, mark new fact disputed and queue conflict for review."""
    user_id = "test-user-id"

    old_id = MemoryRepository.create(
        db_session, chat_id="c1", memory_type="preference",
        memory_text="Favorite programming language is Python",
        user_id=user_id, status="active"
    )
    new_id = MemoryRepository.create(
        db_session, chat_id="c2", memory_type="preference",
        memory_text="Hates Python, favorite language is Rust",
        user_id=user_id, status="pending_review"
    )
    db_session.commit()

    mock_llm_eval = {
        "classification": "CONTRADICTION",
        "confidence": 0.98,
        "explanation": "Contradictory favorite language claim.",
        "temporal_aspect": False,
    }

    with patch.object(ContradictionService, "evaluate_with_llm", return_value=mock_llm_eval), \
         patch("app.services.contradiction_service.SessionLocal", return_value=db_session):
        result = ContradictionService.process_incoming_memory(new_id, user_id)

    assert result["conflict_created"] is True

    # Check database status
    old_mem = MemoryRepository.get_by_id(db_session, old_id)
    new_mem = MemoryRepository.get_by_id(db_session, new_id)
    assert old_mem.status == "active"
    assert new_mem.status == "disputed"

    conflicts = MemoryRepository.get_pending_conflicts(db_session, user_id)
    assert len(conflicts) == 1
    assert conflicts[0]["conflict_type"] == "contradiction"


def test_dedup_guard_skips_processed_source_ref(db_session):
    """Constraint 4: Skip re-evaluation if source_ref has already been processed."""
    user_id = "test-user-id"
    source_ref = "doc:invoice-12345"

    # Already processed memory
    m1 = MemoryRepository.create(
        db_session, chat_id="d1", memory_type="task",
        memory_text="Invoice 12345 paid on Friday",
        user_id=user_id, status="active", source_ref=source_ref
    )

    # Re-trigger attempt on retry/re-upload
    m2 = MemoryRepository.create(
        db_session, chat_id="d1", memory_type="task",
        memory_text="Invoice 12345 paid on Friday",
        user_id=user_id, status="pending_review", source_ref=source_ref
    )
    db_session.commit()

    with patch("app.services.contradiction_service.SessionLocal", return_value=db_session):
        result = ContradictionService.process_incoming_memory(m2, user_id, source_ref=source_ref)

    assert result["status"] == "dedup_skipped"


def test_conflict_resolution_actions(db_session):
    """Constraint 3: Support accept_new and keep_existing; reject unsupported actions."""
    user_id = "test-user-id"

    old_id = MemoryRepository.create(
        db_session, chat_id="c1", memory_type="career",
        memory_text="Works at Google", user_id=user_id, status="active"
    )
    incoming_id = MemoryRepository.create(
        db_session, chat_id="c2", memory_type="career",
        memory_text="Works at OpenAI", user_id=user_id, status="disputed"
    )
    conflict_id = MemoryRepository.create_conflict(
        db_session, user_id=user_id, existing_memory_id=old_id,
        incoming_memory_text="Works at OpenAI", incoming_memory_type="career",
        conflict_type="contradiction", confidence=0.9
    )
    db_session.commit()

    # Test Action A: accept_new
    res = MemoryRepository.resolve_conflict(db_session, conflict_id, user_id, action="accept_new")
    assert res["resolution_status"] == "accepted_new"

    old_mem = MemoryRepository.get_by_id(db_session, old_id)
    new_mem = MemoryRepository.get_by_id(db_session, incoming_id)
    assert old_mem.status == "superseded"
    assert new_mem.status == "active"

    # Test Action B: keep_existing on a new conflict
    old_id_2 = MemoryRepository.create(
        db_session, chat_id="c3", memory_type="career",
        memory_text="Role is Engineering Manager", user_id=user_id, status="active"
    )
    incoming_id_2 = MemoryRepository.create(
        db_session, chat_id="c4", memory_type="career",
        memory_text="Role is Staff Engineer", user_id=user_id, status="disputed"
    )
    conflict_id_2 = MemoryRepository.create_conflict(
        db_session, user_id=user_id, existing_memory_id=old_id_2,
        incoming_memory_text="Role is Staff Engineer", incoming_memory_type="career",
        conflict_type="contradiction", confidence=0.88
    )
    db_session.commit()

    res2 = MemoryRepository.resolve_conflict(db_session, conflict_id_2, user_id, action="keep_existing")
    assert res2["resolution_status"] == "kept_existing"

    old_mem_2 = MemoryRepository.get_by_id(db_session, old_id_2)
    new_mem_2 = MemoryRepository.get_by_id(db_session, incoming_id_2)
    assert old_mem_2.status == "active"
    assert new_mem_2.status == "archived"

    # Test Action C: Unsupported action 'merge' must raise ValueError
    with pytest.raises(ValueError, match="Unsupported action: merge"):
        MemoryRepository.resolve_conflict(db_session, conflict_id_2, user_id, action="merge")
