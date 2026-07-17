"""
Authentication Router
Handles Google OAuth2 for Gmail, Drive, and Calendar integrations.
"""

import os
import json
import secrets
import hashlib
import base64
from pathlib import Path
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api/auth", tags=["authentication"])

# OAuth2 Scopes
SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/calendar.readonly",
]

# Load environment variables
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")

from app.database import SessionLocal
from app.repositories.auth_repo import AuthRepository

class DatabaseUserCredentialsDict(dict):
    def __contains__(self, key):
        db = SessionLocal()
        try:
            return AuthRepository.has_credentials(db, key)
        finally:
            db.close()

    def __getitem__(self, key):
        db = SessionLocal()
        try:
            creds = AuthRepository.get_credentials(db, key)
            if creds is None:
                raise KeyError(key)
            return creds
        finally:
            db.close()

    def get(self, key, default=None):
        try:
            return self[key]
        except KeyError:
            return default

# Expose user_credentials for backward compatibility with sources.py
user_credentials = DatabaseUserCredentialsDict()

def generate_code_verifier() -> str:
    """Generate a cryptographically secure code verifier for PKCE."""
    return secrets.token_urlsafe(96)

def generate_code_challenge(code_verifier: str) -> str:
    """Generate a code challenge from a code verifier using S256 method."""
    code_challenge = hashlib.sha256(code_verifier.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(code_challenge).rstrip(b"=").decode("utf-8")

def get_flow() -> Flow:
    """Create OAuth2 flow instance."""
    return Flow.from_client_config(
        {
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [GOOGLE_REDIRECT_URI],
            }
        },
        scopes=SCOPES,
        redirect_uri=GOOGLE_REDIRECT_URI,
    )

@router.get("/google/login")
async def google_login(request: Request):
    """Redirect user to Google OAuth login page."""
    if not all([GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET]):
        raise HTTPException(status_code=500, detail="Google OAuth credentials not configured")
    
    # Generate PKCE code verifier and challenge manually
    code_verifier = generate_code_verifier()
    code_challenge = generate_code_challenge(code_verifier)
    
    flow = get_flow()
    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",  # Ensure we get a refresh token
        code_challenge=code_challenge,
        code_challenge_method="S256",
    )
    
    # Store state and code verifier in session
    request.session["oauth_state"] = state
    request.session["oauth_code_verifier"] = code_verifier
    
    # Detailed logging
    print(f"[GoogleOAuth] Generated state: {state}")
    print(f"[GoogleOAuth] Generated code_verifier: {code_verifier}")
    print(f"[GoogleOAuth] Session contents after login: {dict(request.session)}")
    
    return RedirectResponse(url=authorization_url)

@router.get("/google/callback")
async def google_callback(request: Request):
    """Handle OAuth2 callback and store credentials."""
    try:
        # Detailed logging of callback
        print(f"[GoogleOAuth] Callback query params: {dict(request.query_params)}")
        print(f"[GoogleOAuth] Session contents at callback: {dict(request.session)}")
        
        # Validate state
        returned_state = request.query_params.get("state")
        stored_state = request.session.get("oauth_state")
        print(f"[GoogleOAuth] Returned state: {returned_state}")
        print(f"[GoogleOAuth] Stored state: {stored_state}")
        
        if not returned_state or not stored_state or returned_state != stored_state:
            raise HTTPException(status_code=400, detail="Invalid state parameter")
        
        # Get code and stored code verifier
        code = request.query_params.get("code")
        code_verifier = request.session.get("oauth_code_verifier")
        print(f"[GoogleOAuth] Callback code: {code}")
        print(f"[GoogleOAuth] Retrieved code_verifier: {code_verifier}")
        
        if not code or not code_verifier:
            raise HTTPException(status_code=400, detail="Missing code or code verifier")
        
        # Recreate flow and use stored code verifier
        flow = get_flow()
        flow.code_verifier = code_verifier
        flow.fetch_token(code=code, code_verifier=code_verifier)
        credentials = flow.credentials
        
        # Clear session data
        request.session.pop("oauth_state", None)
        request.session.pop("oauth_code_verifier", None)
        
        # For now, use a default user ID
        user_id = "default_user"
        
        # Save credentials to database via AuthRepository
        db = SessionLocal()
        try:
            AuthRepository.save_credentials(
                db=db,
                user_id=user_id,
                token=credentials.token,
                refresh_token=credentials.refresh_token,
                token_uri=credentials.token_uri,
                client_id=credentials.client_id,
                client_secret=credentials.client_secret,
                scopes=credentials.scopes,
                expiry=credentials.expiry,
            )
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Database save failed: {str(e)}")
        finally:
            db.close()
        
        # Redirect back to frontend sources page
        return RedirectResponse(url="http://localhost:3000/sources")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OAuth callback failed: {str(e)}")

@router.get("/status")
async def auth_status():
    """Check if user is authenticated with Google."""
    user_id = "default_user"
    db = SessionLocal()
    try:
        authenticated = AuthRepository.has_credentials(db, user_id)
        return {"authenticated": authenticated}
    finally:
        db.close()
