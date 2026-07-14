
"""
Timeline Router
"""
from fastapi import APIRouter, Query
from app.models.schemas import TimelineResponse
from app.services.timeline_service import get_timeline_events


router = APIRouter(prefix="/api/timeline", tags=["timeline"])


@router.get("", response_model=TimelineResponse)
async def get_timeline(limit: int = Query(100, ge=1, le=500)):
    """Get timeline events grouped by date, newest first."""
    grouped = get_timeline_events(limit=limit)
    return {"events_by_date": grouped}

