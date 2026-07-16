"""
Database configuration for EVOLVE AI.
Uses SQLAlchemy 2.0 with PostgreSQL (Supabase).
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, DeclarativeBase
from dotenv import load_dotenv

load_dotenv()


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
    return "sqlite:///./memory_db.sqlite"


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


def init_database():
    """Create all tables if they don't exist."""
    from app.models.db_models import (  # noqa: F401 — force model registration
        User, Document, DocumentChunk, Chat, ChatMessage,
        Memory, TimelineEventModel, GraphNodeModel, GraphEdgeModel,
        GoogleCredential, Upload,
    )
    Base.metadata.create_all(bind=engine)
    print("[Database] Tables created / verified.")
