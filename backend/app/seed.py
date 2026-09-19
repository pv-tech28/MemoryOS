"""
Seed script to pre-populate initial demo data for local/hackathon testing.
"""
import os
import json
from datetime import datetime
from pathlib import Path
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.db_models import (
    User, Document, Memory, TimelineEventModel, GraphNodeModel, GraphEdgeModel
)

def seed_demo_data_if_needed():
    """Populates seed data for default_user if database is empty."""
    db = SessionLocal()
    try:
        # Ensure default user exists
        demo_user = db.query(User).filter(
            (User.id == "demo-user-id") |
            (User.id == "default_user") |
            (User.username == "demouser") |
            (User.email == "demo@evolve.ai")
        ).first()
        if not demo_user:
            demo_user = User(
                id="demo-user-id",
                auth_id="demo_auth_id",
                email="demo@evolve.ai",
                full_name="Demo User",
                username="demouser",
                plan="pro",
                memory_health=98.5,
                last_login=datetime.utcnow(),
            )
            db.add(demo_user)
            db.commit()
            db.refresh(demo_user)

        user_id = demo_user.id


        # 1. Seed Knowledge Graph Nodes and Edges if empty
        node_count = db.query(GraphNodeModel).filter(GraphNodeModel.user_id == user_id).count()
        if node_count == 0:
            kg_path = Path(__file__).parent.parent / "knowledge_graph.json"
            if kg_path.exists():
                print(f"[Seed] Loading knowledge graph from {kg_path}")
                with open(kg_path, "r", encoding="utf-8") as f:
                    kg_data = json.load(f)

                nodes_dict = {}
                for n in kg_data.get("nodes", []):
                    n_id = n.get("id")
                    if not n_id:
                        continue
                    db_node = GraphNodeModel(
                        id=n_id,
                        user_id=user_id,
                        name=n.get("name", "Unnamed Node"),
                        type=n.get("type", "Concept"),
                        description=n.get("description", ""),
                        importance=n.get("importance", 0.5),
                        metadata_json=n.get("metadata", {}),
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow(),
                    )
                    db.add(db_node)
                    nodes_dict[n_id] = db_node

                db.commit()

                # Add edges
                links = kg_data.get("links", []) or kg_data.get("edges", [])
                for edge in links:
                    src = edge.get("source") or edge.get("source_id")
                    tgt = edge.get("target") or edge.get("target_id")
                    if src in nodes_dict and tgt in nodes_dict:
                        db_edge = GraphEdgeModel(
                            id=edge.get("id", f"edge-{src[:8]}-{tgt[:8]}"),
                            source_id=src,
                            target_id=tgt,
                            type=edge.get("type", "RELATED_TO"),
                            description=edge.get("description", ""),
                            strength=edge.get("strength", 1.0),
                            created_at=datetime.utcnow(),
                        )
                        db.add(db_edge)
                db.commit()
                print(f"[Seed] Created {len(nodes_dict)} nodes and edges for demo user.")

        # 2. Seed Timeline Events if empty
        timeline_count = db.query(TimelineEventModel).filter(TimelineEventModel.user_id == user_id).count()
        if timeline_count == 0:
            tl_path = Path(__file__).parent.parent / "timeline_events.json"
            if tl_path.exists():
                print(f"[Seed] Loading timeline events from {tl_path}")
                with open(tl_path, "r", encoding="utf-8") as f:
                    events = json.load(f)
                for ev in events:
                    db_ev = TimelineEventModel(
                        id=ev.get("id"),
                        user_id=user_id,
                        title=ev.get("title", "Event"),
                        description=ev.get("description", ""),
                        event_type=ev.get("event_type", "chat"),
                        color=ev.get("color", "#6c5ce7"),
                        related_document=ev.get("related_document"),
                        related_memory=ev.get("related_memory"),
                        related_graph_node=ev.get("related_graph_node"),
                        created_at=datetime.utcnow(),
                    )
                    db.add(db_ev)
                db.commit()
                print(f"[Seed] Created timeline events.")

        # 3. Seed Sample Memories if empty
        memory_count = db.query(Memory).filter(Memory.user_id == user_id).count()
        if memory_count == 0:
            sample_memories = [
                {"type": "skill", "memory": "Proficient in Python, FastAPI, React, and Next.js for full-stack AI development.", "importance": 0.9},
                {"type": "project", "memory": "Building EVOLVE AI: An AI-powered digital memory operating system with knowledge graphs.", "importance": 1.0},
                {"type": "goal", "memory": "Win the AI Hackathon by delivering a flawless semantic memory vault experience.", "importance": 0.95},
                {"type": "preference", "memory": "Prefers dark mode glassmorphism UI with smooth micro-animations.", "importance": 0.8},
            ]
            for m in sample_memories:
                db_mem = Memory(
                    chat_id="demo-chat-id",
                    user_id=user_id,
                    type=m["type"],
                    memory=m["memory"],
                    importance=m["importance"],
                    recency=1.0,
                    created_at=datetime.utcnow(),
                )
                db.add(db_mem)
            db.commit()
            print(f"[Seed] Created sample memories.")

        # 4. Seed Sample Document record if empty
        doc_count = db.query(Document).filter(Document.user_id == user_id).count()
        if doc_count == 0:
            sample_doc = Document(
                id="doc-demo-resume",
                user_id=user_id,
                filename="MemoryOS_Architecture.pdf",
                source="upload",
                page_count=5,
                chunk_count=12,
                file_size=1048576,
                status="ready",
                uploaded_at=datetime.utcnow(),
            )
            db.add(sample_doc)
            db.commit()
            print(f"[Seed] Created sample document.")

    except Exception as e:
        print(f"[Seed] Error during seeding: {e}")
        db.rollback()
    finally:
        db.close()
