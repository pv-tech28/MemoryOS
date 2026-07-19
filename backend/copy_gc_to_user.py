
from sqlalchemy import create_engine, text
from app.database import get_database_url
from sqlalchemy.orm import Session

engine = create_engine(get_database_url(), echo=False)

with Session(engine) as session:
    print("[Script] Getting default_user's credentials...")
    default_creds = session.execute(
        text("SELECT * FROM google_credentials WHERE user_id = 'default_user'")
    ).fetchone()
    if default_creds:
        print(f"[Script] Found default_user's credentials: {default_creds}")
        
        # First, delete any existing (if any) for target user
        session.execute(
            text("DELETE FROM google_credentials WHERE user_id = '724df8d1-a1e2-4357-af7b-1761d7a3d3d3'")
        )
        
        # Insert new credentials for the target user
        insert_stmt = text(
            """
            INSERT INTO google_credentials 
                (id, user_id, provider, token, refresh_token, token_uri, client_id, client_secret, scopes, expiry, created_at, updated_at)
            VALUES
                (:id, :user_id, :provider, :token, :refresh_token, :token_uri, :client_id, :client_secret, :scopes, :expiry, :created_at, :updated_at)
            """
        )
        session.execute(insert_stmt, {
            "id": "new-gc-id-1234",
            "user_id": "724df8d1-a1e2-4357-af7b-1761d7a3d3d3",
            "provider": default_creds[2],
            "token": default_creds[3],
            "refresh_token": default_creds[4],
            "token_uri": default_creds[5],
            "client_id": default_creds[6],
            "client_secret": default_creds[7],
            "scopes": default_creds[8],
            "expiry": default_creds[9],
            "created_at": default_creds[10],
            "updated_at": default_creds[11]
        })
        session.commit()
        print("[Script] Successfully copied credentials to 724df8d1-a1e2-4357-af7b-1761d7a3d3d3")
    else:
        print("[Script] No credentials found for default_user!")
