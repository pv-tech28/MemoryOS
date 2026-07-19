
import os
from sqlalchemy import create_engine, inspect
from dotenv import load_dotenv

load_dotenv()

from app.database import get_database_url

DATABASE_URL = get_database_url()
print(f"Using database URL: {DATABASE_URL}")
print(f"Is SQLite: {DATABASE_URL.startswith('sqlite')}")

engine = create_engine(DATABASE_URL, echo=False)
insp = inspect(engine)

print("\n--- Tables ---")
print(insp.get_table_names())

print("\n--- Users table schema ---")
for col in insp.get_columns("users"):
    print(f"  {col['name']} - {col['type']} - nullable: {col['nullable']}")

print("\n--- Users table indices ---")
print(insp.get_indexes("users"))
