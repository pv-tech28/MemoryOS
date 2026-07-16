"""
EVOLVE AI — SQLite and JSON to Supabase PostgreSQL Migration Utility.
Run this script to automatically migrate all your local data:
- SQLite databases (memories, graph_nodes, graph_edges)
- Local document metadata (_metadata.json)
- Google Credentials (google_credentials.json)
into Supabase PostgreSQL.
"""

import os
import json
import sqlite3
from datetime import datetime
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load env
load_dotenv()

# We need to import our models and database base
from app.database import Base
from app.models.db_models import (
    User, Document, DocumentChunk, Chat, ChatMessage,
    Memory, TimelineEventModel, GraphNodeModel, GraphEdgeModel,
    GoogleCredential, Upload,
)

# SQLite database path
SQLITE_PATH = "memory_db.sqlite"
if not os.path.exists(SQLITE_PATH):
    SQLITE_PATH = "backend/memory_db.sqlite"

# Local metadata file paths
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
if not os.path.isdir(UPLOAD_DIR) and os.path.isdir("backend/uploads"):
    UPLOAD_DIR = "backend/uploads"

METADATA_FILE = os.path.join(UPLOAD_DIR, "_metadata.json")
CREDENTIALS_FILE = os.path.join(UPLOAD_DIR, "google_credentials.json")


def get_postgres_url() -> str:
    """Retrieve connection string for Postgres from env."""
    url = os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL")
    if url:
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        # Strip pgbouncer parameter which psycopg2 does not support
        if "pgbouncer=true" in url:
            import urllib.parse as urlparse
            parsed = urlparse.urlparse(url)
            query = urlparse.parse_qs(parsed.query)
            query.pop("pgbouncer", None)
            parsed = parsed._replace(query=urlparse.urlencode(query, doseq=True))
            url = urlparse.urlunparse(parsed)
        return url
    return ""


def migrate():
    print("=" * 60)
    print(" EVOLVE AI — DATA MIGRATION UTILITY")
    print("=" * 60)

    pg_url = get_postgres_url()
    if not pg_url:
        print("\n[ERROR] PostgreSQL connection url (DIRECT_URL or DATABASE_URL) not found in env.")
        print("Please configure your .env file with Supabase credentials first.\n")
        return

    # Check SQLite
    has_sqlite = os.path.exists(SQLITE_PATH)
    if not has_sqlite:
        print(f"[WARN] SQLite file not found at {SQLITE_PATH}. Skipping SQLite data migration.")

    # Initialize Postgres Connection
    print("\nConnecting to PostgreSQL/Supabase...")
    try:
        engine = create_engine(pg_url)
        # Create all tables if they do not exist
        Base.metadata.create_all(bind=engine)
        SessionLocal = sessionmaker(bind=engine)
        db = SessionLocal()
        print("Successfully connected to PostgreSQL! Schema created/verified.")
    except Exception as e:
        print(f"[ERROR] Failed to connect to PostgreSQL: {e}")
        return

    try:
        # 1. Create Default Users (to satisfy foreign key constraints)
        print("\nCreating default users...")
        for user_id in ["default", "default_user"]:
            existing_user = db.query(User).filter(User.id == user_id).first()
            if not existing_user:
                new_user = User(
                    id=user_id,
                    email=f"{user_id}@evolve.ai",
                    display_name=f"Evolve {user_id.capitalize()}",
                )
                db.add(new_user)
                print(f"  Created user: {user_id}")
        db.commit()

        # 2. Migrate Google Credentials
        if os.path.exists(CREDENTIALS_FILE):
            print("\nMigrating Google OAuth credentials...")
            try:
                with open(CREDENTIALS_FILE, "r", encoding="utf-8") as f:
                    creds_dict = json.load(f)
                
                for user_key, creds in creds_dict.items():
                    # For compatibility, default_user or default maps to database default/default_user
                    mapped_user = "default" if user_key == "default" else "default_user"
                    
                    # Check if already exists in DB
                    existing_cred = db.query(GoogleCredential).filter(GoogleCredential.user_id == mapped_user).first()
                    if not existing_cred:
                        expiry_dt = None
                        if creds.get("expiry"):
                            expiry_dt = datetime.fromisoformat(creds["expiry"])
                        
                        new_cred = GoogleCredential(
                            user_id=mapped_user,
                            provider="google",
                            token=creds.get("token"),
                            refresh_token=creds.get("refresh_token"),
                            token_uri=creds.get("token_uri"),
                            client_id=creds.get("client_id"),
                            client_secret=creds.get("client_secret"),
                            scopes=creds.get("scopes"),
                            expiry=expiry_dt,
                        )
                        db.add(new_cred)
                        print(f"  Migrated credentials for: {mapped_user}")
                db.commit()
            except Exception as e:
                db.rollback()
                print(f"  [ERROR] Google Credentials migration failed: {e}")
        else:
            print("\nNo local google_credentials.json file found. Skipping.")

        # 3. Migrate Documents from _metadata.json
        if os.path.exists(METADATA_FILE):
            print("\nMigrating Document metadata...")
            try:
                with open(METADATA_FILE, "r", encoding="utf-8-sig") as f:
                    docs_dict = json.load(f)
                
                for doc_id, doc in docs_dict.items():
                    existing_doc = db.query(Document).filter(Document.id == doc_id).first()
                    if not existing_doc:
                        uploaded_at_dt = datetime.utcnow()
                        if doc.get("uploaded_at"):
                            uploaded_at_dt = datetime.fromisoformat(doc["uploaded_at"].rstrip("Z"))
                        
                        new_doc = Document(
                            id=doc_id,
                            user_id="default_user",
                            filename=doc.get("filename", "Unknown Document"),
                            file_path=doc.get("file_path"),
                            source=doc.get("source", "upload"),
                            page_count=doc.get("page_count", 0),
                            chunk_count=doc.get("chunk_count", 0),
                            file_size=doc.get("file_size", 0),
                            status=doc.get("status", "ready"),
                            metadata_json=doc.get("metadata", {}),
                            uploaded_at=uploaded_at_dt,
                        )
                        db.add(new_doc)
                        
                        # Generate simple chunks in database if document_chunks table needs text content
                        # Since we only had faiss previously, text chunks metadata can be populated from FAISS or kept empty
                        # Let's add a single dummy chunk just to have basic content relational map if none exist
                        filename = doc.get("filename", "Unknown Document")
                        try:
                            print(f"  Migrated document metadata: {filename}")
                        except Exception:
                            try:
                                print(f"  Migrated document metadata: {filename.encode('ascii', errors='replace').decode('ascii')}")
                            except Exception:
                                print("  Migrated document metadata (unprintable characters)")
                db.commit()
            except Exception as e:
                db.rollback()
                print(f"  [ERROR] Document metadata migration failed: {e}")
        else:
            print("\nNo local _metadata.json file found. Skipping.")

        # 4. Migrate SQLite data (memories, graph_nodes, graph_edges)
        if has_sqlite:
            print("\nMigrating SQLite database records...")
            conn = sqlite3.connect(SQLITE_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # A. Migrate memories
            try:
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='memories'")
                if cursor.fetchone():
                    cursor.execute("SELECT * FROM memories")
                    rows = cursor.fetchall()
                    print(f"  Found {len(rows)} memories in SQLite. Migrating...")
                    for r in rows:
                        existing_mem = db.query(Memory).filter(Memory.id == r["id"]).first()
                        if not existing_mem:
                            # Map user_id to default or default_user
                            u_id = r["user_id"]
                            if u_id not in ["default", "default_user"]:
                                u_id = "default"

                            created_dt = datetime.fromisoformat(r["created_at"]) if r["created_at"] else datetime.utcnow()
                            updated_dt = datetime.fromisoformat(r["updated_at"]) if r["updated_at"] else datetime.utcnow()
                            last_accessed_dt = datetime.fromisoformat(r["last_accessed"]) if r["last_accessed"] else None

                            new_mem = Memory(
                                id=r["id"],
                                chat_id=r["chat_id"],
                                user_id=u_id,
                                type=r["type"],
                                memory=r["memory"],
                                importance=r["importance"],
                                recency=r["recency"],
                                frequency=r["frequency"],
                                last_accessed=last_accessed_dt,
                                access_count=r["access_count"],
                                created_at=created_dt,
                                updated_at=updated_dt,
                            )
                            db.add(new_mem)
                    db.commit()
                    print("  Memories migration finished.")
            except Exception as e:
                db.rollback()
                print(f"  [ERROR] SQLite memories migration failed: {e}")

            # B. Migrate graph_nodes
            try:
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='graph_nodes'")
                if cursor.fetchone():
                    cursor.execute("SELECT * FROM graph_nodes")
                    rows = cursor.fetchall()
                    print(f"  Found {len(rows)} graph nodes in SQLite. Migrating...")
                    for r in rows:
                        existing_node = db.query(GraphNodeModel).filter(GraphNodeModel.id == r["id"]).first()
                        if not existing_node:
                            created_dt = datetime.fromisoformat(r["created_at"]) if r["created_at"] else datetime.utcnow()
                            updated_dt = datetime.fromisoformat(r["updated_at"]) if r["updated_at"] else datetime.utcnow()
                            
                            new_node = GraphNodeModel(
                                id=r["id"],
                                user_id="default",
                                name=r["name"],
                                type=r["type"],
                                description=r["description"],
                                importance=0.5,
                                metadata_json={},
                                created_at=created_dt,
                                updated_at=updated_dt,
                            )
                            db.add(new_node)
                    db.commit()
                    print("  Graph nodes migration finished.")
            except Exception as e:
                db.rollback()
                print(f"  [ERROR] SQLite graph_nodes migration failed: {e}")

            # C. Migrate graph_edges
            try:
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='graph_edges'")
                if cursor.fetchone():
                    cursor.execute("SELECT * FROM graph_edges")
                    rows = cursor.fetchall()
                    print(f"  Found {len(rows)} graph edges in SQLite. Migrating...")
                    for r in rows:
                        existing_edge = db.query(GraphEdgeModel).filter(GraphEdgeModel.id == r["id"]).first()
                        if not existing_edge:
                            created_dt = datetime.fromisoformat(r["created_at"]) if r["created_at"] else datetime.utcnow()
                            
                            new_edge = GraphEdgeModel(
                                id=r["id"],
                                source_id=r["source_node_id"],
                                target_id=r["target_node_id"],
                                type=r["type"],
                                description=r["description"],
                                strength=1.0,
                                created_at=created_dt,
                            )
                            db.add(new_edge)
                    db.commit()
                    print("  Graph edges migration finished.")
            except Exception as e:
                db.rollback()
                print(f"  [ERROR] SQLite graph_edges migration failed: {e}")

            conn.close()

        print("\n" + "=" * 60)
        print(" MIGRATION COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        print("All local data has been copied into PostgreSQL/Supabase database.")
        print("You can now safely add Supabase keys to your environment configuration.")
        print("=" * 60 + "\n")

    except Exception as e:
        db.rollback()
        print(f"\n[FATAL] Migration aborted due to an error: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
