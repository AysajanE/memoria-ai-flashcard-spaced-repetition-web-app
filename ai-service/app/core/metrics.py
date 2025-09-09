import time
import asyncio
from collections import defaultdict
from typing import Dict, Any

class ConcurrencyTracker:
    """Track concurrent requests per provider."""
    
    def __init__(self):
        self.active_requests = defaultdict(int)
        self.total_requests = defaultdict(int)
        self.total_wait_time = defaultdict(float)
        self._lock = asyncio.Lock()
    
    async def track_request(self, provider: str):
        """Context manager to track request concurrency."""
        return ConcurrencyContext(self, provider)
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get current concurrency statistics."""
        async with self._lock:
            return {
                "active_requests": dict(self.active_requests),
                "total_requests": dict(self.total_requests),
                "avg_wait_time": {
                    provider: self.total_wait_time[provider] / max(self.total_requests[provider], 1)
                    for provider in self.total_requests
                }
            }

class ConcurrencyContext:
    """Context manager for tracking individual requests."""
    
    def __init__(self, tracker: ConcurrencyTracker, provider: str):
        self.tracker = tracker
        self.provider = provider
        self.start_time = None
    
    async def __aenter__(self):
        self.start_time = time.time()
        async with self.tracker._lock:
            self.tracker.active_requests[self.provider] += 1
            self.tracker.total_requests[self.provider] += 1
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        wait_time = time.time() - self.start_time
        async with self.tracker._lock:
            self.tracker.active_requests[self.provider] -= 1
            self.tracker.total_wait_time[self.provider] += wait_time

# Global tracker instance
concurrency_tracker = ConcurrencyTracker()