import logging
from typing import Optional
from app.queue import r, HAS_REDIS

logger = logging.getLogger(__name__)

class JobDeduplicator:
    """Handles job deduplication using Redis."""
    
    def __init__(self, redis_client = None):
        self.redis = redis_client or r
        self.key_prefix = "inflight"
        self.default_ttl = 3600  # 1 hour
        self.has_redis = HAS_REDIS and self.redis is not None
    
    def is_duplicate(self, job_id: str) -> bool:
        """Check if job is already in progress."""
        if not self.has_redis:
            return False  # No deduplication without Redis
        
        key = f"{self.key_prefix}:{job_id}"
        return self.redis.exists(key) > 0
    
    def mark_started(self, job_id: str, ttl: Optional[int] = None) -> bool:
        """
        Mark job as started. Returns True if successfully marked, False if duplicate.
        """
        if not self.has_redis:
            logger.info(f"Job marked as started (no Redis)", extra={"jobId": job_id})
            return True  # Allow job to proceed without Redis
        
        key = f"{self.key_prefix}:{job_id}"
        ttl = ttl or self.default_ttl
        
        # Use SETNX for atomic check-and-set
        if self.redis.setnx(key, "1"):
            self.redis.expire(key, ttl)
            logger.info(f"Job marked as started", extra={"jobId": job_id})
            return True
        else:
            logger.info(f"Duplicate job ignored", extra={"jobId": job_id})
            return False
    
    def mark_completed(self, job_id: str):
        """Mark job as completed (remove from inflight)."""
        if not self.has_redis:
            logger.info(f"Job marked as completed (no Redis)", extra={"jobId": job_id})
            return
        
        key = f"{self.key_prefix}:{job_id}"
        self.redis.delete(key)
        logger.info(f"Job marked as completed", extra={"jobId": job_id})
    
    def cleanup_expired(self):
        """Clean up expired inflight keys (called periodically)."""
        if not self.has_redis:
            logger.info("Cannot cleanup expired keys: Redis not available")
            return
            
        pattern = f"{self.key_prefix}:*"
        keys = self.redis.keys(pattern)
        expired = 0
        
        for key in keys:
            if self.redis.ttl(key) == -1:  # No expiration set
                self.redis.expire(key, self.default_ttl)
            elif self.redis.ttl(key) <= 0:  # Expired
                self.redis.delete(key)
                expired += 1
        
        if expired > 0:
            logger.info(f"Cleaned up {expired} expired inflight keys")

# Global instance
deduplicator = JobDeduplicator()