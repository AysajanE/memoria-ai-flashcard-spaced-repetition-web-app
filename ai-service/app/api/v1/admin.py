from fastapi import APIRouter, Depends
from app.core.metrics import concurrency_tracker
from app.config import settings
from app.dependencies import verify_internal_api_key

router = APIRouter(
    prefix="/api/v1/admin",
    tags=["admin"],
    dependencies=[Depends(verify_internal_api_key)]
)

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