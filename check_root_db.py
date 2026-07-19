
import os
from pathlib import Path
from dotenv import load_dotenv

# Try loading .env from root and from backend directory
load_dotenv()

# Let's get database url the same way app.database.get_database_url does!
def get_database_url():
    url = os.getenv("DATABASE_URL")
    if url:
        return url
    return "sqlite:///./memory_db.sqlite"


database_url = get_database_url()
print(f"DATABASE_URL: {database_url}")

# Extract file path if it's SQLite
if database_url.startswith("sqlite:///"):
    db_path_str = database_url.replace("sqlite:///", "")
    # Check if it's relative to current working dir (project root)
    if db_path_str.startswith("./"):
        # Check from project root (this script's dir)
        db_path_root = Path(__file__).parent / db_path_str[2:]
        # Check from backend dir
        db_path_backend = Path(__file__).parent / "backend" / db_path_str[2:]
        
        print(f"\nChecking possible database locations:")
        print(f"  Project root: {db_path_root.absolute()}")
        print(f"  Exists: {db_path_root.exists()}, size: {db_path_root.stat().st_size if db_path_root.exists() else 'N/A'}")
        
        print(f"\n  Backend dir: {db_path_backend.absolute()}")
        print(f"  Exists: {db_path_backend.exists()}, size: {db_path_backend.stat().st_size if db_path_backend.exists() else 'N/A'}")


from sqlalchemy import create_engine, text

print("\n--- Checking project root database ---")
if database_url.startswith("sqlite:///"):
    # Create engine with root cwd
    engine_root = create_engine(database_url, echo=False)
    with engine_root.connect() as conn:
        print("\nPRAGMA table_info(users):")
        result = conn.execute(text("PRAGMA table_info(users);"))
        for row in result:
            print(row)
            
        print("\nAlembic version:")
        try:
            result = conn.execute(text("SELECT version_num FROM alembic_version;"))
            for row in result:
                print(f"  {row[0]}")
        except Exception as e:
            print(f"  Error: {e}")
