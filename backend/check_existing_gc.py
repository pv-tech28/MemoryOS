
from sqlalchemy import create_engine, text
from app.database import get_database_url
engine = create_engine(get_database_url(), echo=False)
with engine.connect() as conn:
    print("--- All google_credentials rows ---")
    res = conn.execute(text("SELECT * FROM google_credentials;"))
    for row in res:
        print(row)
