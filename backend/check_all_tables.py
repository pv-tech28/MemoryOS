
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from app.database import get_database_url
from pathlib import Path

load_dotenv()

print(f"[Database] DATABASE_URL: {get_database_url()}")
engine = create_engine(get_database_url(), echo=False)
with engine.connect() as conn:
    # List all tables
    print("\n--- [Database] All tables ---")
    tables = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table';"))
    for t in tables:
        print(f"  {t[0]}")

    # Check google_credentials specifically
    print("\n--- [Database] PRAGMA table_info(google_credentials) ---")
    try:
        gc_info = conn.execute(text("PRAGMA table_info(google_credentials);"))
        for col in gc_info:
            print(f"  {col}")
    except Exception as e:
        print(f"  Error: {e}")

    # Check row count for google_credentials
    print("\n--- [Database] google_credentials row count ---")
    try:
        gc_count = conn.execute(text("SELECT COUNT(*) FROM google_credentials;"))
        print(f"  {gc_count.fetchone()[0]}")
    except Exception as e:
        print(f"  Error: {e}")

    # Check if user 724df8d1-a1e2-4357-af7b-1761d7a3d3d3 has any credentials
    print("\n--- [Database] Check for user 724df8d1-a1e2-4357-af7b-1761d7a3d3d3 in google_credentials ---")
    try:
        gc_user = conn.execute(text("SELECT * FROM google_credentials WHERE user_id = '724df8d1-a1e2-4357-af7b-1761d7a3d3d3';"))
        has_creds = False
        for cred in gc_user:
            has_creds = True
            print(f"  Found credentials: {cred}")
        if not has_creds:
            print("  No credentials found for that user_id!")
    except Exception as e:
        print(f"  Error: {e}")

    # Also check what users we have
    print("\n--- [Database] All users ---")
    try:
        users = conn.execute(text("SELECT id, email, auth_id FROM users;"))
        for u in users:
            print(f"  User id: {u[0]}, email: {u[1]}, auth_id: {u[2]}")
    except Exception as e:
        print(f"  Error: {e}")
