import os
import logging

try:
    import redis
    from rq import Queue
    from rq.registry import StartedJobRegistry, FinishedJobRegistry
    HAS_REDIS = True
except ImportError:
    redis = None
    Queue = None
    StartedJobRegistry = None
    FinishedJobRegistry = None
    HAS_REDIS = False

logger = logging.getLogger(__name__)

# Redis connection
redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

if HAS_REDIS:
    r = redis.from_url(redis_url, decode_responses=True)
    # Queue configuration
    q = Queue("memoria-ai", connection=r, default_timeout=600)
else:
    r = None
    q = None

def get_queue_info() -> dict:
    """Get current queue status."""
    if not HAS_REDIS or not q:
        return {
            "queue_length": 0,
            "started_jobs": 0,
            "finished_jobs": 0,
            "error": "Redis/RQ not available"
        }
    
    return {
        "queue_length": len(q),
        "started_jobs": len(StartedJobRegistry(queue=q)),
        "finished_jobs": len(FinishedJobRegistry(queue=q))
    }

def cleanup_old_jobs():
    """Clean up old finished jobs."""
    if not HAS_REDIS or not q:
        logger.warning("Cannot cleanup jobs: Redis/RQ not available")
        return
    
    try:
        finished_registry = FinishedJobRegistry(queue=q)
        finished_registry.cleanup(86400)  # 24 hours
        logger.info("Cleaned up old finished jobs")
    except Exception as e:
        logger.error(f"Failed to cleanup jobs: {e}")