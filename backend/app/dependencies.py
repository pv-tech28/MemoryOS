from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from datetime import datetime
from app.database import get_db
from app.supabase import supabase
from app.models.db_models import User

security = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """Get the current authenticated user from Supabase JWT token."""
    try:
        # Verify the JWT with Supabase
        auth_response = supabase.auth.get_user(credentials.credentials)
        supabase_user = auth_response.user
        
        if not supabase_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Get or create our local User record
        user = db.query(User).filter(User.auth_id == supabase_user.id).first()
        
        if not user:
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
            
            # TODO: Create initial workspace, default folders, graph root node, etc.
            # We'll implement this later
        else:
            # Update last login
            user.last_login = datetime.utcnow()
            db.commit()
            db.refresh(user)
        
        return user
        
    except Exception as e:
        print(f"[Auth] Error verifying token: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
