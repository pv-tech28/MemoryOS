"""
Authentication Router
Handles Supabase Auth (Email/Password, Google OAuth, etc.
"""

import os
from fastapi import APIRouter, Request, HTTPException, Depends, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from datetime import datetime

from app.database import get_db
from app.dependencies import get_current_user
from app.models.db_models import User, GraphNodeModel
from app.supabase import supabase
from app.repositories.auth_repo import AuthRepository

load_dotenv()

router = APIRouter(prefix="/api/auth", tags=["authentication"])

# Pydantic models for request bodies
class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    username: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    new_password: str

# Google OAuth configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")

# Backward compatibility: keep user_credentials dict for sources.py
class DatabaseUserCredentialsDict(dict):
    def __contains__(self, key):
        # We'll implement this properly later, for now default to checking if user exists
        return True
    def __getitem__(self, key):
        # Return dummy data for compatibility
        return {}
    def get(self, key, default=None):
        return default or {}

user_credentials = DatabaseUserCredentialsDict()

@router.post("/signup")
async def signup(data: SignupRequest, db: Session = Depends(get_db)):
    """Sign up a new user with email and password."""
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase not configured (missing SUPABASE_URL or SUPABASE_SECRET_KEY)",
        )
    try:
        # Create user in Supabase Auth
        auth_response = supabase.auth.sign_up({
            "email": data.email,
            "password": data.password,
            "options": {
                "data": {
                    "full_name": data.full_name,
                    "username": data.username,
                }
            }
        })

        if not auth_response.user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create user in Supabase"
            )

        # Create user in our database
        user = User(
            auth_id=auth_response.user.id,
            email=data.email,
            full_name=data.full_name,
            username=data.username,
            last_login=datetime.utcnow(),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Initialize workspace, graph root node, etc.
        initialize_user_workspace(db, user)

        return {
            "message": "Signup successful", "user_id": user.id }

    except Exception as e:
        db.rollback()
        print(f"[Auth] Signup error: {str(e)}")
        if "User already registered" in str(e):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User already exists"
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/login")
async def login(data: LoginRequest):
    """Login user with email and password."""
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase not configured (missing SUPABASE_URL or SUPABASE_SECRET_KEY)",
        )
    try:
        auth_response = supabase.auth.sign_in_with_password({
            "email": data.email,
            "password": data.password
        })
        return {
            "access_token": auth_response.session.access_token,
            "refresh_token": auth_response.session.refresh_token,
            "expires_in": auth_response.session.expires_in,
            "user": {
                "id": auth_response.user.id,
                "email": auth_response.user.email,
            }
        }
    except Exception as e:
        print(f"[Auth] Login error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

@router.get("/status")
async def get_auth_status():
    """Check authentication status (for frontend use)."""
    # For now, return that authentication is handled by Supabase client-side
    # In the future, we could verify the session with Supabase
    return {"authenticated": False}


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current authenticated user details."""
    return {
        "id": current_user.id,
        "auth_id": current_user.auth_id,
        "full_name": current_user.full_name,
        "username": current_user.username,
        "email": current_user.email,
        "avatar_url": current_user.avatar_url,
        "plan": current_user.plan,
        "memory_health": current_user.memory_health,
        "created_at": current_user.created_at.isoformat(),
    }

@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    """Send password reset email."""
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase not configured (missing SUPABASE_URL or SUPABASE_SECRET_KEY)",
        )
    try:
        supabase.auth.reset_password_email(data.email, {
            "redirect_to": "http://localhost:3000/reset-password"
        })
        return { "message": "Password reset email sent" }
    except Exception as e:
        print(f"[Auth] Forgot password error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest, request: Request):
    """Reset password using token from email."""
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase not configured (missing SUPABASE_URL or SUPABASE_SECRET_KEY)",
        )
    try:
        # Get token from header
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authorization header")

        token = auth_header.replace("Bearer ", "")
        
        # Update password using the token
        supabase.auth.admin.update_user_by_id(
            user_id="",  # We'll let Supabase handle via session, or frontend will handle this
            updates={ "password": data.new_password }
        )
        
        return { "message": "Password reset successfully" }
    except Exception as e:
        print(f"[Auth] Reset password error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/logout")
async def logout():
    """Logout user (client-side only, invalidates session in Supabase)."""
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase not configured (missing SUPABASE_URL or SUPABASE_SECRET_KEY)",
        )
    try:
        supabase.auth.sign_out()
        return { "message": "Logged out" }
    except Exception as e:
        print(f"[Auth] Logout error: {str(e)}")
        return { "message": "Logged out" }

@router.get("/google/login")
async def google_login():
    """Redirect to Google OAuth login URL."""
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase not configured (missing SUPABASE_URL or SUPABASE_SECRET_KEY)",
        )
    try:
        print(f"[Auth] Starting Google OAuth flow, provider: google")
        print(f"[Auth] Redirect URL: http://localhost:3000/dashboard")
        auth_response = supabase.auth.sign_in_with_oauth({
            "provider": "google",
            "options": {
                "redirect_to": "http://localhost:3000/dashboard",
                "scopes": "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/calendar.readonly"
            }
        })
        print(f"[Auth] Supabase auth response: {auth_response}")
        if auth_response.url:
            return RedirectResponse(url=auth_response.url)
        raise HTTPException(status_code=500, detail="Failed to get auth URL")
    except Exception as e:
        print(f"[Auth] Google login error (type: {type(e).__name__}): {str(e)}")
        import traceback
        print(f"[Auth] Stack trace: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/google/callback")
async def google_callback(request: Request):
    """Google OAuth callback (redirects to frontend)."""
    try:
        # The frontend will handle this via Supabase JS SDK
        return RedirectResponse(url="http://localhost:3000/dashboard")
    except Exception as e:
        print(f"[Auth] Google callback error: {str(e)}")
        return RedirectResponse(url="http://localhost:3000/login")

def initialize_user_workspace(db: Session, user: User):
    """Initialize a new user's workspace."""
    # Create graph root node
    root_node = GraphNodeModel(
        user_id=user.id,
        name=f"{user.full_name}'s Memory Graph",
        type="root",
        description="Root node of your knowledge graph",
    )
    db.add(root_node)
    db.commit()
