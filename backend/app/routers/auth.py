"""
Authentication Router
Handles local FastAPI JWT authentication and Google OAuth2 flow,
providing full fallback independence from external Supabase auth.
"""

import os
import uuid
import hashlib
from datetime import datetime, timedelta
from typing import Optional
import secrets
import json
import base64
import urllib.parse

import jwt
from fastapi import APIRouter, Request, HTTPException, Depends, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from google_auth_oauthlib.flow import Flow
import google.oauth2.id_token
from google.auth.transport import requests as google_requests

from app.database import get_db, SessionLocal
from app.dependencies import get_current_user
from app.models.db_models import User, GraphNodeModel
from app.repositories.auth_repo import AuthRepository
from app.supabase import supabase

load_dotenv()

router = APIRouter(prefix="/api/auth", tags=["authentication"])

SESSION_SECRET_KEY = os.getenv("SESSION_SECRET_KEY", "your-secret-key-change-in-production")

def get_google_oauth_credentials():
    load_dotenv(override=True)
    client_id = os.getenv("GOOGLE_CLIENT_ID", "")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "")
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")
    is_valid = bool(
        client_id
        and client_secret
        and client_id.strip() != "your_google_client_id_here"
        and client_secret.strip() != "your_google_client_secret_here"
        and not client_id.strip().startswith("your_")
    )
    return client_id.strip(), client_secret.strip(), redirect_uri.strip(), is_valid

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")

GOOGLE_SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/calendar.readonly",
]


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


def hash_password(password: str) -> str:
    """Hash password with secret key salt."""
    return hashlib.sha256((password + SESSION_SECRET_KEY).encode("utf-8")).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against hashed password."""
    return hash_password(plain_password) == hashed_password


def create_access_token(user: User) -> str:
    """Create signed JWT access token for user."""
    payload = {
        "sub": user.id,
        "email": user.email,
        "user_metadata": {
            "full_name": user.full_name or "",
            "username": user.username or "",
            "avatar_url": user.avatar_url or "",
        },
        "exp": datetime.utcnow() + timedelta(days=30),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, SESSION_SECRET_KEY, algorithm="HS256")


# Backward compatibility: user_credentials dict for sources.py
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


user_credentials = DatabaseUserCredentialsDict()


def initialize_user_workspace(db: Session, user: User):
    """Initialize a new user's workspace with root node."""
    existing_root = db.query(GraphNodeModel).filter(
        GraphNodeModel.user_id == user.id,
        GraphNodeModel.type == "root"
    ).first()
    if not existing_root:
        root_node = GraphNodeModel(
            user_id=user.id,
            name=f"{user.full_name or user.username or 'User'}'s Memory Graph",
            type="root",
            description="Root node of your knowledge graph",
        )
        db.add(root_node)
        db.commit()


@router.post("/signup")
async def signup(data: SignupRequest, db: Session = Depends(get_db)):
    """Sign up a new user with email and password."""
    # Check if user already exists
    existing = db.query(User).filter(
        (User.email == data.email) | (User.username == data.username)
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email or username already exists",
        )

    user = User(
        id=str(uuid.uuid4()),
        auth_id=str(uuid.uuid4()),
        email=data.email,
        full_name=data.full_name,
        username=data.username,
        password_hash=hash_password(data.password),
        last_login=datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    initialize_user_workspace(db, user)

    token = create_access_token(user)
    return {
        "message": "Signup successful",
        "access_token": token,
        "token_type": "bearer",
        "expires_in": 604800,
        "user": {
            "id": user.id,
            "email": user.email,
            "user_metadata": {
                "full_name": user.full_name,
                "username": user.username,
                "avatar_url": user.avatar_url,
            },
        },
    }


@router.post("/login")
async def login(data: LoginRequest, db: Session = Depends(get_db)):
    """Login user with email and password."""
    user = db.query(User).filter(User.email == data.email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # If user has a password set, verify it
    if user.password_hash:
        if not verify_password(data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
    else:
        # First time login with password for an existing OAuth or seed user
        user.password_hash = hash_password(data.password)

    user.last_login = datetime.utcnow()
    db.commit()

    token = create_access_token(user)
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": 604800,
        "user": {
            "id": user.id,
            "email": user.email,
            "user_metadata": {
                "full_name": user.full_name or "",
                "username": user.username or "",
                "avatar_url": user.avatar_url or "",
            },
        },
    }


@router.get("/status")
async def get_auth_status(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Check authentication status."""
    has_google = AuthRepository.has_credentials(db, current_user.id)
    return {
        "authenticated": current_user.id not in ("demo-user-id", "default_user"),
        "user_id": current_user.id,
        "has_google": has_google,
    }


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
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
    }


@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest):
    """Forgot password stub."""
    return {"message": "If that email exists, password reset instructions have been sent."}


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Reset password for current user."""
    current_user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"message": "Password reset successfully"}


@router.post("/logout")
async def logout():
    """Logout user."""
    return {"message": "Logged out"}


@router.get("/google/login")
async def google_login(
    request: Request,
    redirect_to: str = "http://localhost:3000/dashboard",
    user_id: Optional[str] = None,
):
    """Initiate Google OAuth2 flow using native Google credentials."""
    client_id, client_secret, redirect_uri, is_valid = get_google_oauth_credentials()
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail="Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env"
        )

    # Sanitize redirect_to: only allow localhost (frontend) URLs for security
    frontend_origins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
    ]
    is_safe = False
    normalized_redirect = redirect_to
    for origin in frontend_origins:
        if redirect_to.startswith(origin) or redirect_to == origin:
            is_safe = True
            break
        if redirect_to.startswith("/"):
            # Allow absolute paths (e.g. "/sources") — rewrite to origin 3000
            normalized_redirect = f"http://localhost:3000{redirect_to}"
            is_safe = True
            break
    if not is_safe:
        normalized_redirect = "http://localhost:3000/dashboard"

    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": client_id,
                "client_secret": client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [redirect_uri],
            }
        },
        scopes=GOOGLE_SCOPES,
        redirect_uri=redirect_uri,
        autogenerate_code_verifier=False,
    )

    state_payload = {
        "nonce": secrets.token_hex(16),
        "redirect_to": normalized_redirect,
    }
    if user_id:
        state_payload["user_id"] = user_id
    state_str = base64.urlsafe_b64encode(json.dumps(state_payload).encode()).decode()

    authorization_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state_str,
    )

    request.session["oauth_state"] = state_str
    request.session["oauth_redirect_to"] = normalized_redirect
    if user_id:
        request.session["oauth_user_id"] = user_id

    return RedirectResponse(url=authorization_url)


@router.get("/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    """Handle Google OAuth2 callback, persist credentials, and redirect to frontend."""
    client_id, client_secret, redirect_uri, is_valid = get_google_oauth_credentials()
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail="Google OAuth credentials not configured in backend/.env"
        )

    redirect_target = "http://localhost:3000/dashboard"
    target_user_id = None
    state_param = request.query_params.get("state")
    if state_param:
        try:
            decoded = json.loads(base64.urlsafe_b64decode(state_param.encode()).decode())
            if isinstance(decoded, dict):
                redirect_target = decoded.get("redirect_to") or redirect_target
                target_user_id = decoded.get("user_id")
        except Exception:
            pass

    if not target_user_id:
        target_user_id = request.session.get("oauth_user_id")
    if redirect_target == "http://localhost:3000/dashboard":
        redirect_target = request.session.get("oauth_redirect_to") or redirect_target

    try:
        code = request.query_params.get("code")
        if not code:
            raise HTTPException(status_code=400, detail="Missing authorization code")

        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [redirect_uri],
                }
            },
            scopes=GOOGLE_SCOPES,
            redirect_uri=redirect_uri,
            autogenerate_code_verifier=False,
        )

        flow.fetch_token(code=code)
        credentials = flow.credentials

        user_email = None
        user_name = None
        user_picture = None

        if credentials.id_token:
            try:
                id_info = google.oauth2.id_token.verify_oauth2_token(
                    credentials.id_token,
                    google_requests.Request(),
                    client_id,
                    clock_skew_in_seconds=10,
                )
                user_email = id_info.get("email")
                user_name = id_info.get("name")
                user_picture = id_info.get("picture")
            except Exception as e:
                print(f"[Auth] id_token verification notice: {e}")

        if not user_email:
            import httpx
            resp = httpx.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {credentials.token}"},
            )
            if resp.status_code == 200:
                info = resp.json()
                user_email = info.get("email")
                user_name = info.get("name")
                user_picture = info.get("picture")

        user = None
        if target_user_id:
            user = db.query(User).filter(
                (User.id == target_user_id) | (User.auth_id == target_user_id)
            ).first()

        if not user and user_email:
            user = db.query(User).filter(User.email == user_email).first()

        if not user:
            username = user_email.split("@")[0] if user_email else "google_user"
            user = User(
                id=str(uuid.uuid4()),
                auth_id=str(uuid.uuid4()),
                email=user_email or "google_user@evolve.ai",
                full_name=user_name or username,
                username=username,
                avatar_url=user_picture,
                last_login=datetime.utcnow(),
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            initialize_user_workspace(db, user)
        else:
            user.last_login = datetime.utcnow()
            if user_picture and not user.avatar_url:
                user.avatar_url = user_picture
            if user_name and not user.full_name:
                user.full_name = user_name
            db.commit()
            db.refresh(user)

        # Save Google tokens in GoogleCredential table under user.id
        AuthRepository.save_credentials(
            db=db,
            user_id=user.id,
            token=credentials.token,
            refresh_token=credentials.refresh_token,
            token_uri=credentials.token_uri,
            client_id=client_id,
            client_secret=client_secret,
            scopes=credentials.scopes,
            expiry=credentials.expiry,
        )
        db.commit()
        print(f"[Auth] Google OAuth credentials saved for user id={user.id} email={user.email} (scopes={credentials.scopes})")
        if credentials.refresh_token:
            print("[Auth]   (refresh token received)")
        else:
            print("[Auth]   WARNING: no refresh_token returned by Google. Re-authorization may be needed after access token expires.")

        token = create_access_token(user)
        request.session.pop("oauth_state", None)
        request.session.pop("oauth_redirect_to", None)
        request.session.pop("oauth_user_id", None)

        # Redirect to the caller-specified page if present; fall back to dashboard
        sep = "&" if "?" in redirect_target else "?"
        response = RedirectResponse(url=f"{redirect_target}{sep}google_connected=1")
        response.set_cookie(
            key="evolve_auth_token",
            value=token,
            max_age=604800,
            path="/",
            httponly=False,
            samesite="lax",
        )
        return response

    except Exception as e:
        print(f"[Auth] Google callback error: {e}")
        import traceback
        traceback.print_exc()
        err_msg = urllib.parse.quote(str(e))
        if "/sources" in redirect_target or "/settings" in redirect_target:
            sep = "&" if "?" in redirect_target else "?"
            return RedirectResponse(url=f"{redirect_target}{sep}error={err_msg}")
        return RedirectResponse(url=f"http://localhost:3000/login?error={err_msg}")
