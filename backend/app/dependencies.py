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

security = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """Get the current authenticated user from Supabase JWT token."""
    print("=" * 50)
    print("[Auth] Starting token verification")
    print(f"[Auth] Supabase configured: {supabase is not None}")
    
    # Log token details (without full token)
    token = credentials.credentials
    print(f"[Auth] Token received (first 50 chars): {token[:50]}...")
    
    # Try to decode token header to check kid, iss, aud
    try:
        token_parts = token.split('.')
        if len(token_parts) == 3:
            header_b64 = token_parts[0]
            header_bytes = base64.urlsafe_b64decode(header_b64 + '=' * (4 - len(header_b64) % 4))
            header = json.loads(header_bytes.decode('utf-8'))
            print(f"[Auth] Token header: {header}")
            
            payload_b64 = token_parts[1]
            payload_bytes = base64.urlsafe_b64decode(payload_b64 + '=' * (4 - len(payload_b64) % 4))
            payload = json.loads(payload_bytes.decode('utf-8'))
            print(f"[Auth] Token payload (iss, aud, exp): iss={payload.get('iss')}, aud={payload.get('aud')}, exp={payload.get('exp')}")
            print(f"[Auth] Token payload full: {payload}")
    except Exception as e:
        print(f"[Auth] Error decoding token parts: {e}")
    
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase not configured (missing SUPABASE_URL or SUPABASE_SECRET_KEY)",
        )
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
        print("=" * 50)
        print(f"[Auth] ERROR verifying token: {type(e).__name__} - {str(e)}")
        import traceback
        print(f"[Auth] Full traceback:")
        traceback.print_exc()
        print("=" * 50)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {type(e).__name__} - {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
