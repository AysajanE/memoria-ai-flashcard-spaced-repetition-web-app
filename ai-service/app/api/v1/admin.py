from fastapi import APIRouter, Depends, HTTPException
from app.queue import q, get_queue_info
from app.core.deduplication import deduplicator
from app.dependencies import validate_internal_api_key
from app.config import settings

router = APIRouter(
    prefix="/api/v1/admin",
    tags=["admin"],
    dependencies=[Depends(validate_internal_api_key)]
)

@router.get("/queue-status")
async def queue_status():
    """Get current queue status."""
    info = get_queue_info()
    
    # Add inflight job count
    if deduplicator.has_redis:
        inflight_pattern = f"{deduplicator.key_prefix}:*"
        inflight_count = len(deduplicator.redis.keys(inflight_pattern))
    else:
        inflight_count = 0
    
    return {
        **info,
        "inflight_jobs": inflight_count,
        "queue_enabled": settings.USE_QUEUE,
        "redis_available": deduplicator.has_redis
    }

@router.post("/cleanup-inflight")
async def cleanup_inflight():
    """Clean up expired inflight job markers."""
    deduplicator.cleanup_expired()
    return {"message": "Cleanup completed"}