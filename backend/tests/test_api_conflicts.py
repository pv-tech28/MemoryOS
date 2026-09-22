"""
API Integration tests for Memory Conflict Endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

from app.main import app
from app.dependencies import get_current_user
from app.models.db_models import User
from app.repositories.memory_repo import MemoryRepository
from app.database import SessionLocal


@pytest.fixture
def mock_user():
    return User(
        id="demo-user-id",
        email="demo@example.com",
        username="demouser",
        plan="free",
    )


@pytest.fixture
def client(mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_conflict_api_endpoints(client, mock_user):
    db = SessionLocal()
    try:
        # Ensure test user exists in DB to satisfy foreign key
        user_in_db = db.query(User).filter(User.id == mock_user.id).first()
        if not user_in_db:
            db.add(User(
                id=mock_user.id,
                email=mock_user.email,
                username=mock_user.username,
                plan=mock_user.plan,
            ))
            db.commit()

        user_id = mock_user.id

        # 1. Setup an existing memory and a conflict
        m_old = MemoryRepository.create(
            db, chat_id="chat-test", memory_type="preference",
            memory_text="User drinks black coffee", user_id=user_id, status="active"
        )
        m_incoming = MemoryRepository.create(
            db, chat_id="chat-test-2", memory_type="preference",
            memory_text="User drinks only green tea", user_id=user_id, status="disputed"
        )
        conflict_id = MemoryRepository.create_conflict(
            db, user_id=user_id, existing_memory_id=m_old,
            incoming_memory_text="User drinks only green tea",
            incoming_memory_type="preference", conflict_type="contradiction",
            confidence=0.92, explanation="Direct conflict regarding daily drink preference."
        )
        db.commit()

        # 2. Test GET /api/memories/conflicts
        response = client.get("/api/memories/conflicts")
        assert response.status_code == 200
        conflicts = response.json()
        assert any(c["id"] == conflict_id for c in conflicts)

        target = next(c for c in conflicts if c["id"] == conflict_id)
        assert target["existing_memory_text"] == "User drinks black coffee"
        assert target["incoming_memory_text"] == "User drinks only green tea"
        assert target["conflict_type"] == "contradiction"

        # 3. Test POST /api/memories/conflicts/{id}/resolve with invalid action
        bad_resp = client.post(f"/api/memories/conflicts/{conflict_id}/resolve", json={"action": "invalid_action"})
        assert bad_resp.status_code == 400

        # 4. Test POST /api/memories/conflicts/{id}/resolve with accept_new
        resolve_resp = client.post(f"/api/memories/conflicts/{conflict_id}/resolve", json={"action": "accept_new"})
        assert resolve_resp.status_code == 200
        assert resolve_resp.json()["resolution_status"] == "accepted_new"

        # Verify old memory is now superseded and incoming is active
        old_mem = MemoryRepository.get_by_id(db, m_old)
        new_mem = MemoryRepository.get_by_id(db, m_incoming)
        assert old_mem.status == "superseded"
        assert new_mem.status == "active"

        # 5. Test GET /api/memories/history/{memory_id}
        history_resp = client.get(f"/api/memories/history/{m_old}")
        assert history_resp.status_code == 200
        history_data = history_resp.json()
        assert "lineage" in history_data
        assert len(history_data["lineage"]) >= 2
        assert history_data["lineage"][0]["id"] == m_old
        assert history_data["lineage"][1]["id"] == m_incoming

    finally:
        db.close()
