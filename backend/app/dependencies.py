from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from datetime import datetime
from app.database import get_db
from app.supabase import supabase
from app.models.db_models import User
from typing import Optional
import json
import base64

security = HTTPBearer(auto_error=False)

def get_demo_user(db: Session) -> User:
    """Get or create a default demo user for local operation / fallback."""
    user = db.query(User).filter(
        (User.id == "demo-user-id") |
        (User.id == "default_user") |
        (User.username == "demouser") |
        (User.email == "demo@evolve.ai")
    ).first()
    if not user:
        user = User(
            id="demo-user-id",
            auth_id="demo_auth_id",
            email="demo@evolve.ai",
            full_name="Demo User",
            username="demouser",
            plan="pro",
            memory_health=98.5,
            last_login=datetime.utcnow(),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """Get the current authenticated user from Supabase JWT token, with fallback to Demo User."""
    if not credentials or not credentials.credentials:
        print("[Auth] No credentials provided, falling back to Demo User")
        return get_demo_user(db)
        
    token = credentials.credentials
    if token in ("demo-token", "null", "undefined"):
        print("[Auth] Demo token provided, returning Demo User")
        return get_demo_user(db)

    if not supabase:
        print("[Auth] Supabase not configured, returning Demo User")
        return get_demo_user(db)

    try:
        # Verify the JWT with Supabase
        print(f"[Auth] Calling supabase.auth.get_user()")
        auth_response = supabase.auth.get_user(token)
        print(f"[Auth] supabase.auth.get_user() succeeded! User: {auth_response.user}")
        supabase_user = auth_response.user
        
        if not supabase_user:
            print("[Auth] ERROR: auth_response.user is None")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        print(f"[Auth] Supabase User ID (auth_id): {supabase_user.id}")
        
        # Get or create our local User record
        print(f"[Auth] Querying DB for user with auth_id = {supabase_user.id}")
        user = db.query(User).filter(User.auth_id == supabase_user.id).first()
        
        print(f"[Auth] DB query result: user exists = {user is not None}")
        
        if not user:
            print("[Auth] No local user found, creating new user...")
            # Create new user if not exists
            user = User(
                auth_id=supabase_user.id,
                email=supabase_user.email or "",
                full_name=supabase_user.user_metadata.get("full_name"),
                username=supabase_user.user_metadata.get("username"),
                avatar_url=supabase_user.user_metadata.get("avatar_url"),
                last_login=datetime.utcnow(),
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"[Auth] Created new local user with id={user.id}, email={user.email}")
            
            # TODO: Create initial workspace, default folders, graph root node, etc.
            # We'll implement this later
        else:
            # Update last login
            print(f"[Auth] Found existing local user: id={user.id}, auth_id={user.auth_id}, email={user.email}")
            user.last_login = datetime.utcnow()
            db.commit()
            db.refresh(user)
        
        print(f"[Auth] Token verification successful! User: {user.email}")
        print("=" * 50)
        return user
        
    except Exception as e:
        print(f"[Auth] Notice: Token verification failed ({type(e).__name__}: {e}). Using Demo User fallback.")
        return get_demo_user(db)

