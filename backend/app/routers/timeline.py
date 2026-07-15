
"""
Timeline Router
"""
from fastapi import APIRouter, Query, HTTPException
from app.models.schemas import TimelineResponse
from app.services.timeline_service import get_timeline_events, delete_timeline_event


router = APIRouter(prefix="/api/timeline", tags=["timeline"])


@router.get("", response_model=TimelineResponse)
async def get_timeline(limit: int = Query(100, ge=1, le=500)):
    """Get timeline events grouped by date, newest first."""
    grouped = get_timeline_events(limit=limit)
    return {"events_by_date": grouped}


@router.delete("/{event_id}")
async def delete_timeline(event_id: str):
    """Delete a timeline event by ID."""
    success = delete_timeline_event(event_id)
    if not success:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"success": True}

