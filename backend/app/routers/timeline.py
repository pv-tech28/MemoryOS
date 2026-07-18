
"""
Timeline Router
"""
from fastapi import APIRouter, Query, HTTPException, Depends
from app.models.schemas import TimelineResponse
from app.services.timeline_service import get_timeline_events, delete_timeline_event
from app.dependencies import get_current_user
from app.models.db_models import User


router = APIRouter(prefix="/api/timeline", tags=["timeline"])


@router.get("", response_model=TimelineResponse)
async def get_timeline(
    limit: int = Query(100, ge=1, le=500),
    current_user: User = Depends(get_current_user)
):
    """Get timeline events grouped by date, newest first."""
    grouped = get_timeline_events(limit=limit, user_id=current_user.id)
    return {"events_by_date": grouped}


@router.delete("/{event_id}")
async def delete_timeline(
    event_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a timeline event by ID."""
    success = delete_timeline_event(event_id, user_id=current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"success": True}

