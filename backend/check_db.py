
import os
from pathlib import Path
from dotenv import load_dotenv
from app.database import get_database_url, engine
from alembic.config import Config
from alembic.runtime.environment import EnvironmentContext
from alembic.script import ScriptDirectory

# Load env vars
load_dotenv()

# Get database URL
database_url = get_database_url()
print(f"DATABASE_URL: {database_url}")

# Extract file path if it's SQLite
if database_url.startswith("sqlite:///"):
    # sqlite:///./memory_db.sqlite
    db_path_str = database_url.replace("sqlite:///", "")
    if db_path_str.startswith("./"):
        db_path = Path(__file__).parent / db_path_str[2:]
    else:
        db_path = Path(db_path_str)
    print(f"Actual database file path: {db_path.absolute()}")
    print(f"Database file exists: {db_path.exists()}")
    if db_path.exists():
        print(f"Database file size: {db_path.stat().st_size} bytes")
else:
    print("Not an SQLite database; skipping file path info")


from sqlalchemy import text

# Test the connection and get table info
with engine.connect() as conn:
    print("\n--- PRAGMA table_info(users) ---")
    result = conn.execute(text("PRAGMA table_info(users);"))
    for row in result:
        print(row)

    # Check Alembic version
    print("\n--- Alembic version ---")
    try:
        result = conn.execute(text("SELECT version_num FROM alembic_version;"))
        for row in result:
            print(f"Current version: {row[0]}")
    except Exception as e:
        print(f"Could not get Alembic version: {e}")

print("\n--- Done ---")
