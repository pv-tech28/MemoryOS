"""
Auth Repository — replaces google_credentials.json file operations.
"""

import uuid
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.db_models import GoogleCredential


DEFAULT_USER_ID = "default_user"


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
        import os
        from app.models.db_models import User

        target_uid = user_id
        # Resolve to valid users.id to satisfy foreign key constraint
        if user_id:
            user = db.query(User).filter((User.id == user_id) | (User.auth_id == user_id)).first()
            if user:
                target_uid = user.id

        cid = client_id or os.getenv("GOOGLE_CLIENT_ID")
        csecret = client_secret or os.getenv("GOOGLE_CLIENT_SECRET")
        turi = token_uri or "https://oauth2.googleapis.com/token"

        cred = (
            db.query(GoogleCredential)
            .filter(GoogleCredential.user_id == target_uid)
            .first()
        )
        now = datetime.utcnow()
        if cred:
            cred.token = token
            cred.refresh_token = refresh_token or cred.refresh_token
            cred.token_uri = turi or cred.token_uri
            cred.client_id = cid or cred.client_id
            cred.client_secret = csecret or cred.client_secret
            cred.scopes = scopes or cred.scopes
            cred.expiry = expiry
            cred.updated_at = now
        else:
            cred = GoogleCredential(
                id=str(uuid.uuid4()),
                user_id=target_uid,
                provider="google",
                token=token,
                refresh_token=refresh_token,
                token_uri=turi,
                client_id=cid,
                client_secret=csecret,
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
        from app.models.db_models import User
        target_uid = user_id
        user = None
        if user_id:
            user = db.query(User).filter((User.id == user_id) | (User.auth_id == user_id)).first()
            if user:
                target_uid = user.id

        cred = (
            db.query(GoogleCredential)
            .filter(GoogleCredential.user_id == target_uid)
            .first()
        )
        if not cred and user and user.auth_id:
            cred = (
                db.query(GoogleCredential)
                .filter(GoogleCredential.user_id == user.auth_id)
                .first()
            )
        if not cred and target_uid in (DEFAULT_USER_ID, "demo-user-id"):
            cred = (
                db.query(GoogleCredential)
                .filter(GoogleCredential.user_id == DEFAULT_USER_ID)
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
        from app.models.db_models import User
        target_uid = user_id
        user = None
        if user_id:
            user = db.query(User).filter((User.id == user_id) | (User.auth_id == user_id)).first()
            if user:
                target_uid = user.id

        has = (
            db.query(GoogleCredential)
            .filter(GoogleCredential.user_id == target_uid)
            .first()
            is not None
        )
        if not has and user and user.auth_id:
            has = (
                db.query(GoogleCredential)
                .filter(GoogleCredential.user_id == user.auth_id)
                .first()
                is not None
            )
        if not has and target_uid in (DEFAULT_USER_ID, "demo-user-id"):
            has = (
                db.query(GoogleCredential)
                .filter(GoogleCredential.user_id == DEFAULT_USER_ID)
                .first()
                is not None
            )
        return has

    @staticmethod
    def delete_credentials(db: Session, user_id: str = DEFAULT_USER_ID) -> bool:
        """Delete Google credentials for a user."""
        from app.models.db_models import User
        target_uid = user_id
        user = None
        if user_id:
            user = db.query(User).filter((User.id == user_id) | (User.auth_id == user_id)).first()
            if user:
                target_uid = user.id

        deleted = False
        creds = db.query(GoogleCredential).filter(
            (GoogleCredential.user_id == target_uid) |
            (GoogleCredential.user_id == (user.auth_id if user else None))
        ).all()
        for cred in creds:
            db.delete(cred)
            deleted = True
        db.flush()
        return deleted
