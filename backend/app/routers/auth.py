"""
Authentication Router
Handles Google OAuth2 for Gmail, Drive, and Calendar integrations.
"""

import os
import json
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

# Credentials storage file path
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
CREDENTIALS_FILE = Path(UPLOAD_DIR) / "google_credentials.json"

def load_user_credentials():
    """Load credentials from file."""
    if CREDENTIALS_FILE.exists():
        with open(CREDENTIALS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_user_credentials(credentials):
    """Save credentials to file."""
    with open(CREDENTIALS_FILE, "w", encoding="utf-8") as f:
        json.dump(credentials, f, indent=2)

# Load credentials on startup
user_credentials = load_user_credentials()

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
    
    flow = get_flow()
    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",  # Ensure we get a refresh token
    )
    
    # Store state and code verifier in session
    request.session["oauth_state"] = state
    request.session["oauth_code_verifier"] = flow.code_verifier
    
    return RedirectResponse(url=authorization_url)

@router.get("/google/callback")
async def google_callback(request: Request):
    """Handle OAuth2 callback and store credentials."""
    try:
        # Validate state
        returned_state = request.query_params.get("state")
        stored_state = request.session.get("oauth_state")
        if not returned_state or not stored_state or returned_state != stored_state:
            raise HTTPException(status_code=400, detail="Invalid state parameter")
        
        # Get code and stored code verifier
        code = request.query_params.get("code")
        code_verifier = request.session.get("oauth_code_verifier")
        if not code or not code_verifier:
            raise HTTPException(status_code=400, detail="Missing code or code verifier")
        
        # Recreate flow and use stored code verifier
        flow = get_flow()
        flow.code_verifier = code_verifier
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        # Clear session data
        request.session.pop("oauth_state", None)
        request.session.pop("oauth_code_verifier", None)
        
        # For now, use a default user ID
        user_id = "default_user"
        creds_dict = {
            "token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "token_uri": credentials.token_uri,
            "client_id": credentials.client_id,
            "client_secret": credentials.client_secret,
            "scopes": credentials.scopes,
            "expiry": credentials.expiry.isoformat() if credentials.expiry else None,
        }
        user_credentials[user_id] = creds_dict
        
        # Save credentials to file
        save_user_credentials(user_credentials)
        
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
    return {"authenticated": user_id in user_credentials}
