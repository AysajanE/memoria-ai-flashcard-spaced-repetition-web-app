from fastapi import APIRouter
from fastapi.responses import JSONResponse
from app.queue import get_queue_info, r, HAS_REDIS
from app.config import settings
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/ready")
async def ready_check():
    """Readiness check including Redis connectivity."""
    checks = {"status": "ready"}
    
    try:
        # Check Redis if available
        if HAS_REDIS and r:
            r.ping()
            checks["redis"] = "connected"
        else:
            checks["redis"] = "not available"
        
        if settings.USE_QUEUE:
            if HAS_REDIS:
                queue_info = get_queue_info()
                checks["queue"] = queue_info
            else:
                checks["queue"] = {"error": "Redis/RQ not available"}
        
    except Exception as e:
        checks["error"] = str(e)
        return JSONResponse(
            status_code=503, 
            content={"status": "not ready", "checks": checks}
        )
    
    return {"status": "ready", "checks": checks}