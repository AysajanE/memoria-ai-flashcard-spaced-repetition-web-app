from fastapi import APIRouter, Depends, HTTPException
from app.queue import q, get_queue_info
from app.core.deduplication import deduplicator
from app.core.metrics import concurrency_tracker
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
    
    return {
        **info,
        "queue_enabled": settings.USE_QUEUE,
        "redis_available": deduplicator.has_redis
    }

@router.post("/cleanup-inflight")
async def cleanup_inflight():
    """Clean up expired inflight job markers."""
    deduplicator.cleanup_expired()
    return {"message": "Cleanup completed"}

@router.get("/concurrency-stats")
async def concurrency_stats():
    """Get current concurrency statistics."""
    stats = await concurrency_tracker.get_stats()
    
    return {
        "concurrency_limits": {
            "openai": settings.OPENAI_MAX_CONCURRENCY,
            "anthropic": settings.ANTHROPIC_MAX_CONCURRENCY
        },
        "current_stats": stats
    }