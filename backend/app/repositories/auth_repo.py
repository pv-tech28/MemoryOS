"""
Auth Repository — replaces google_credentials.json file operations.
"""

import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.db_models import GoogleCredential


DEFAULT_USER_ID = "default"


class AuthRepository:

    @staticmethod
    def save_credentials(
        db: Session,
        user_id: str = DEFAULT_USER_ID,
        token: Optional[str] = None,
        refresh_token: Optional[str] = None,
        token_uri: Optional[str] = None,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        scopes: Optional[list] = None,
        expiry: Optional[datetime] = None,
    ) -> GoogleCredential:
        """Create or update Google OAuth credentials for a user."""
        cred = (
            db.query(GoogleCredential)
            .filter(GoogleCredential.user_id == user_id)
            .first()
        )
        now = datetime.utcnow()
        if cred:
            cred.token = token
            cred.refresh_token = refresh_token or cred.refresh_token
            cred.token_uri = token_uri or cred.token_uri
            cred.client_id = client_id or cred.client_id
            cred.client_secret = client_secret or cred.client_secret
            cred.scopes = scopes or cred.scopes
            cred.expiry = expiry
            cred.updated_at = now
        else:
            cred = GoogleCredential(
                id=str(uuid.uuid4()),
                user_id=user_id,
                provider="google",
                token=token,
                refresh_token=refresh_token,
                token_uri=token_uri,
                client_id=client_id,
                client_secret=client_secret,
                scopes=scopes,
                expiry=expiry,
                created_at=now,
                updated_at=now,
            )
            db.add(cred)
        db.flush()
        return cred

    @staticmethod
    def get_credentials(
        db: Session, user_id: str = DEFAULT_USER_ID
    ) -> Optional[Dict[str, Any]]:
        """Get Google credentials for a user as a dict."""
        cred = (
            db.query(GoogleCredential)
            .filter(GoogleCredential.user_id == user_id)
            .first()
        )
        if not cred:
            return None
        return {
            "token": cred.token,
            "refresh_token": cred.refresh_token,
            "token_uri": cred.token_uri,
            "client_id": cred.client_id,
            "client_secret": cred.client_secret,
            "scopes": cred.scopes,
            "expiry": cred.expiry.isoformat() if cred.expiry else None,
        }

    @staticmethod
    def has_credentials(db: Session, user_id: str = DEFAULT_USER_ID) -> bool:
        """Check if user has stored Google credentials."""
        return (
            db.query(GoogleCredential)
            .filter(GoogleCredential.user_id == user_id)
            .first()
            is not None
        )

    @staticmethod
    def delete_credentials(db: Session, user_id: str = DEFAULT_USER_ID) -> bool:
        """Delete Google credentials for a user."""
        cred = (
            db.query(GoogleCredential)
            .filter(GoogleCredential.user_id == user_id)
            .first()
        )
        if not cred:
            return False
        db.delete(cred)
        db.flush()
        return True
