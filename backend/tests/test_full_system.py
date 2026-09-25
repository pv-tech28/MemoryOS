"""
Comprehensive System Integration Tests.
Verifies all features and endpoints in MemoryOS are working and connected.
"""

import io
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

from app.main import app
from app.dependencies import get_current_user
from app.models.db_models import User
from app.database import SessionLocal
from app.services.memory_store import create_memory, delete_memory
from app.services.timeline_service import add_timeline_event


@pytest.fixture
def mock_user():
    return User(
        id="demo-user-id",
        email="demo@evolve.ai",
        username="demouser",
        full_name="Demo User",
        plan="pro",
        memory_health=98.5,
    )


@pytest.fixture
def client(mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    db = SessionLocal()
    try:
        user_in_db = db.query(User).filter(User.id == mock_user.id).first()
        if not user_in_db:
            db.add(User(
                id=mock_user.id,
                email=mock_user.email,
                username=mock_user.username,
                full_name=mock_user.full_name,
                plan=mock_user.plan,
            ))
            db.commit()
    finally:
        db.close()

    yield TestClient(app)
    app.dependency_overrides.clear()


# ── 1. Health & Root ──────────────────────────────────────────────────────────

def test_health_and_root(client):
    r_health = client.get("/api/health")
    assert r_health.status_code == 200
    assert r_health.json()["status"] == "healthy"

    r_root = client.get("/")
    assert r_root.status_code == 200
    assert r_root.json()["docs"] == "/docs"


# ── 2. Documents Lifecycle ───────────────────────────────────────────────────

def test_documents_lifecycle(client):
    # Upload a sample text document
    file_content = b"MemoryOS is an AI-powered personal digital memory vault that indexes documents into knowledge graphs."
    files = {"file": ("test_doc.txt", io.BytesIO(file_content), "text/plain")}

    resp_upload = client.post("/api/documents/upload", files=files)
    assert resp_upload.status_code == 200, resp_upload.text
    data = resp_upload.json()
    assert "id" in data
    doc_id = data["id"]
    assert data["filename"] == "test_doc.txt"
    assert data["status"] == "ready"

    # List documents
    resp_list = client.get("/api/documents")
    assert resp_list.status_code == 200
    docs = resp_list.json()["documents"]
    assert any(d["id"] == doc_id for d in docs)

    # Get single document
    resp_single = client.get(f"/api/documents/{doc_id}")
    assert resp_single.status_code == 200
    assert resp_single.json()["id"] == doc_id

    # Delete document
    resp_del = client.delete(f"/api/documents/{doc_id}")
    assert resp_del.status_code == 200

    # Verify deleted
    resp_gone = client.get(f"/api/documents/{doc_id}")
    assert resp_gone.status_code == 404


# ── 3. Chat & Memory Intelligence ─────────────────────────────────────────────

def test_chat_pipeline(client):
    # Mock LLM provider to ensure test passes deterministically without live API key
    with patch("app.services.rag_engine.get_llm_provider") as mock_get_llm:
        mock_llm = mock_get_llm.return_value
        mock_llm.generate.return_value = {
            "text": "MemoryOS uses semantic knowledge graphs and vector embeddings to answer queries.",
            "usage": {"total_tokens": 50},
        }

        resp = client.post("/api/chat", json={"question": "What is MemoryOS?"})
        assert resp.status_code == 200
        chat_data = resp.json()
        assert "answer" in chat_data
        assert "chat_id" in chat_data
        assert chat_data["confidence"] > 0
        chat_id = chat_data["chat_id"]

        # Clear conversation
        resp_clear = client.post(f"/api/chat/clear/{chat_id}")
        assert resp_clear.status_code == 200
        assert resp_clear.json()["success"] is True

        # Delete conversation
        resp_delete = client.delete(f"/api/chat/{chat_id}")
        assert resp_delete.status_code == 200
        assert resp_delete.json()["success"] is True


# ── 4. Memory Graph Endpoints ────────────────────────────────────────────────

def test_memory_graph_endpoints(client):
    # Full graph
    resp_graph = client.get("/api/memory-graph")
    assert resp_graph.status_code == 200
    graph_data = resp_graph.json()
    assert "nodes" in graph_data
    assert "edges" in graph_data

    # Recommendations
    resp_rec = client.get("/api/memory-graph/recommendations")
    assert resp_rec.status_code == 200
    assert "recommendations" in resp_rec.json()

    # Graph stats
    resp_stats = client.get("/api/memory-graph/stats")
    assert resp_stats.status_code == 200
    assert "total_nodes" in resp_stats.json()

    # Search entities
    resp_search = client.get("/api/memory-graph/search?query=MemoryOS")
    assert resp_search.status_code == 200
    assert isinstance(resp_search.json(), list)

    # Decay
    resp_decay = client.post("/api/memory-graph/decay?decay_rate=0.01")
    assert resp_decay.status_code == 200
    assert resp_decay.json()["status"] == "success"


# ── 5. Memories Endpoints ────────────────────────────────────────────────────

def test_memories_crud_and_stats(client):
    # Create memory
    mem_id = create_memory(
        chat_id="test-chat",
        memory_type="skill",
        memory_text="Expert in full-stack Python and React AI architectures.",
        importance=0.9,
        user_id="demo-user-id"
    )
    assert mem_id is not None

    # List memories
    resp_list = client.get("/api/memories")
    assert resp_list.status_code == 200
    mems = resp_list.json()["memories"]
    assert any(m["id"] == mem_id for m in mems)

    # Relevant memories
    resp_rel = client.get("/api/memories/relevant?query=Python")
    assert resp_rel.status_code == 200
    assert "memories" in resp_rel.json()

    # Graph stats
    resp_stats = client.get("/api/memories/stats")
    assert resp_stats.status_code == 200

    # Delete memory
    resp_del = client.delete(f"/api/memories/{mem_id}")
    assert resp_del.status_code == 200


# ── 6. Timeline Endpoints ────────────────────────────────────────────────────

def test_timeline_endpoints(client):
    # Add timeline event
    event = add_timeline_event(
        title="Test Event Integration",
        description="Verifying timeline connectivity.",
        event_type="chat",
        user_id="demo-user-id",
    )
    assert event.id is not None

    # Get timeline
    resp = client.get("/api/timeline?limit=50")
    assert resp.status_code == 200
    events_by_date = resp.json()["events_by_date"]
    assert isinstance(events_by_date, dict)

    # Delete timeline event
    resp_del = client.delete(f"/api/timeline/{event.id}")
    assert resp_del.status_code == 200
    assert resp_del.json()["success"] is True


# ── 7. Dashboard Endpoints ───────────────────────────────────────────────────

def test_dashboard_stats_and_daily_summary(client):
    # Dashboard stats
    resp_stats = client.get("/api/dashboard/stats")
    assert resp_stats.status_code == 200
    data = resp_stats.json()
    assert "total_memories" in data
    assert "total_documents" in data
    assert "todays_focus" in data
    assert "connected_sources" in data

    # Daily summary
    resp_summary = client.get("/api/dashboard/daily-summary")
    assert resp_summary.status_code == 200
    summary = resp_summary.json()
    assert "stats" in summary
    assert "highlights" in summary
    assert "insights" in summary


# ── 8. Settings Endpoints ────────────────────────────────────────────────────

def test_settings_all_endpoints(client):
    # Profile
    resp_prof = client.get("/api/settings/profile")
    assert resp_prof.status_code == 200
    assert "email" in resp_prof.json()

    # Update profile
    resp_up = client.put("/api/settings/profile", json={"display_name": "EVOLVE Architect", "bio": "AI Engineer"})
    assert resp_up.status_code == 200
    assert resp_up.json()["display_name"] == "EVOLVE Architect"

    # Email
    resp_email = client.get("/api/settings/email")
    assert resp_email.status_code == 200

    # 2FA
    resp_2fa = client.put("/api/settings/security/two-factor", json={"enabled": True})
    assert resp_2fa.status_code == 200

    # All settings
    resp_all = client.get("/api/settings/all")
    assert resp_all.status_code == 200

    # Update all settings
    resp_up_all = client.put("/api/settings/all?ai_provider=deepseek&response_length=concise&auto_memory_extraction=true")
    assert resp_up_all.status_code == 200

    # Connected sources
    resp_sources = client.get("/api/settings/connected-sources")
    assert resp_sources.status_code == 200
    assert "gmail" in resp_sources.json()

    # Storage stats
    resp_storage = client.get("/api/settings/storage/stats")
    assert resp_storage.status_code == 200
    assert "memories_stored" in resp_storage.json()


# ── 9. Auth Status & Me ──────────────────────────────────────────────────────

def test_auth_status_and_me(client):
    resp_status = client.get("/api/auth/status")
    assert resp_status.status_code == 200
    assert "authenticated" in resp_status.json()

    resp_me = client.get("/api/auth/me")
    assert resp_me.status_code == 200
    assert resp_me.json()["id"] == "demo-user-id"
