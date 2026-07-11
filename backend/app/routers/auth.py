"""
Authentication Router
Handles Google OAuth2 for Gmail, Drive, and Calendar integrations.
"""

import os
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

# In-memory storage for user credentials (replace with database in production)
user_credentials = {}

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
async def google_login():
    """Redirect user to Google OAuth login page."""
    if not all([GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET]):
        raise HTTPException(status_code=500, detail="Google OAuth credentials not configured")
    
    flow = get_flow()
    authorization_url, state = flow.authorization_url(access_type="offline", include_granted_scopes="true")
    return RedirectResponse(url=authorization_url)

@router.get("/google/callback")
async def google_callback(request: Request):
    """Handle OAuth2 callback and store credentials."""
    try:
        flow = get_flow()
        flow.fetch_token(code=request.query_params.get("code"))
        credentials = flow.credentials
        
        # For now, use a default user ID
        user_id = "default_user"
        user_credentials[user_id] = {
            "token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "token_uri": credentials.token_uri,
            "client_id": credentials.client_id,
            "client_secret": credentials.client_secret,
            "scopes": credentials.scopes,
            "expiry": credentials.expiry.isoformat() if credentials.expiry else None,
        }
        
        # Redirect back to frontend sources page
        return RedirectResponse(url="http://localhost:3000/sources")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OAuth callback failed: {str(e)}")

@router.get("/status")
async def auth_status():
    """Check if user is authenticated with Google."""
    user_id = "default_user"
    return {"authenticated": user_id in user_credentials}
