"""
Database configuration for EVOLVE AI.
Uses SQLAlchemy 2.0 with PostgreSQL (Supabase).
"""

import os
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session, DeclarativeBase
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env file


def get_database_url() -> str:
    """Get database URL from environment, with fallback to SQLite for local dev."""
    url = os.getenv("DATABASE_URL")
    if url:
        # Supabase often provides postgres:// but SQLAlchemy needs postgresql://
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
    # Fallback: local SQLite (for development without Supabase)
    # Resolve the path relative to this file (app/database.py) to avoid CWD issues!
    db_file_path = Path(__file__).parent.parent / "memory_db.sqlite"
    return f"sqlite:///{db_file_path.absolute()}"


DATABASE_URL = get_database_url()
IS_SQLITE = DATABASE_URL.startswith("sqlite")

# Engine configuration
engine_kwargs = {}
if IS_SQLITE:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_size"] = 5
    engine_kwargs["max_overflow"] = 10
    engine_kwargs["pool_timeout"] = 30
    engine_kwargs["pool_recycle"] = 1800
    engine_kwargs["pool_pre_ping"] = True

engine = create_engine(DATABASE_URL, echo=False, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base class for all ORM models."""
    pass


def get_db():
    """
    FastAPI dependency that provides a database session.
    Automatically commits on success, rolls back on error, and closes.
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def log_database_info():
    """Log database info on startup: path, users table columns, alembic version."""
    print("=" * 50)
    print("[Database Startup]")
    print(f"DATABASE_URL: {DATABASE_URL}")
    
    if IS_SQLITE:
        db_path = DATABASE_URL.replace("sqlite:///", "")
        print(f"Database file path: {db_path}")
    
    # Print users table columns
    print("\n[Database] Users table columns (PRAGMA table_info(users)):")
    try:
        with engine.connect() as conn:
            result = conn.execute(text("PRAGMA table_info(users);"))
            for row in result:
                print(f"  {row}")
    except Exception as e:
        print(f"  Could not get users table info: {e}")
    
    # Print alembic version
    print("\n[Database] Alembic version:")
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version_num FROM alembic_version;"))
            for row in result:
                print(f"  {row[0]}")
    except Exception as e:
        print(f"  Could not get alembic version: {e}")
    print("=" * 50)


def init_database():
    """Create all tables if they don't exist."""
    from app.models.db_models import (  # noqa: F401 — force model registration
        User, Document, DocumentChunk, Chat, ChatMessage,
        Memory, TimelineEventModel, GraphNodeModel, GraphEdgeModel,
        GoogleCredential, Upload,
    )
    Base.metadata.create_all(bind=engine)
    print("[Database] Tables created / verified.")
