"""
Lightweight circuit breaker implementation with Redis persistence.

This module implements the circuit breaker pattern to prevent cascade failures
when AI providers are experiencing issues. The circuit breaker maintains state
in Redis to persist across service restarts and worker instances.
"""

import asyncio
import time
from enum import Enum
from typing import Dict, Any, Optional, Callable, Union
import logging
from functools import wraps

from app.config import settings

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    """Circuit breaker states."""
    CLOSED = "closed"      # Normal operation - requests allowed
    OPEN = "open"          # Blocking requests due to failures
    HALF_OPEN = "half_open"  # Testing if service has recovered


class CircuitBreakerOpenError(Exception):
    """Raised when circuit breaker is open and blocking requests."""
    def __init__(self, service_name: str, message: str = None):
        self.service_name = service_name
        super().__init__(message or f"Circuit breaker is OPEN for {service_name}")


class CircuitBreaker:
    """Lightweight circuit breaker using Redis for state persistence."""
    
    def __init__(
        self,
        service_name: str,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        success_threshold: int = 2,
        redis_client: Optional[Any] = None
    ):
        self.service_name = service_name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout  # seconds
        self.success_threshold = success_threshold
        
        # Redis keys for state persistence
        self.state_key = f"circuit_breaker:{service_name}:state"
        self.failure_count_key = f"circuit_breaker:{service_name}:failures"
        self.last_failure_key = f"circuit_breaker:{service_name}:last_failure"
        self.success_count_key = f"circuit_breaker:{service_name}:successes"
        
        # Redis client (will be initialized lazily)
        self._redis_client = redis_client
        self._redis_available = False
        
        # Fallback in-memory state when Redis is not available
        self._local_state = {
            "state": CircuitState.CLOSED,
            "failure_count": 0,
            "last_failure": 0,
            "success_count": 0
        }
    
    @property
    def redis_client(self):
        """Lazy initialization of Redis client."""
        if self._redis_client is None and settings.REDIS_URL:
            try:
                import redis
                self._redis_client = redis.from_url(
                    settings.REDIS_URL, 
                    decode_responses=True,
                    socket_connect_timeout=2,
                    socket_timeout=2
                )
                # Test connection
                self._redis_client.ping()
                self._redis_available = True
                logger.info(f"Circuit breaker {self.service_name}: Redis connection established")
            except Exception as e:
                logger.warning(f"Circuit breaker {self.service_name}: Redis unavailable, using local state: {e}")
                self._redis_available = False
        
        return self._redis_client
    
    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """Execute function with circuit breaker protection."""
        
        if not settings.ENABLE_CIRCUIT_BREAKER:
            # Circuit breaker disabled, call function directly
            return await func(*args, **kwargs)
        
        state = await self._get_state()
        
        if state == CircuitState.OPEN:
            if await self._should_attempt_reset():
                await self._set_state(CircuitState.HALF_OPEN)
                logger.info(f"Circuit breaker {self.service_name}: OPEN -> HALF_OPEN")
            else:
                raise CircuitBreakerOpenError(
                    self.service_name,
                    f"Circuit breaker is OPEN for {self.service_name}"
                )
        
        try:
            # Execute the function
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)
            
            await self._on_success()
            return result
            
        except Exception as e:
            await self._on_failure()
            raise
    
    async def _get_state(self) -> CircuitState:
        """Get current circuit breaker state."""
        if self._redis_available and self.redis_client:
            try:
                state_str = self.redis_client.get(self.state_key)
                if state_str:
                    return CircuitState(state_str)
            except Exception as e:
                logger.warning(f"Failed to get circuit breaker state from Redis: {e}")
                self._redis_available = False
        
        # Fallback to local state
        return self._local_state["state"]
    
    async def _set_state(self, state: CircuitState):
        """Set circuit breaker state."""
        if self._redis_available and self.redis_client:
            try:
                self.redis_client.set(self.state_key, state.value, ex=3600)  # Expire in 1 hour
            except Exception as e:
                logger.warning(f"Failed to set circuit breaker state in Redis: {e}")
                self._redis_available = False
        
        # Always update local state as fallback
        self._local_state["state"] = state
    
    async def _get_failure_count(self) -> int:
        """Get current failure count."""
        if self._redis_available and self.redis_client:
            try:
                count = self.redis_client.get(self.failure_count_key)
                return int(count) if count else 0
            except Exception as e:
                logger.warning(f"Failed to get failure count from Redis: {e}")
                self._redis_available = False
        
        # Fallback to local state
        return self._local_state["failure_count"]
    
    async def _increment_failure_count(self) -> int:
        """Increment and return failure count."""
        current_time = int(time.time())
        
        if self._redis_available and self.redis_client:
            try:
                count = self.redis_client.incr(self.failure_count_key)
                self.redis_client.expire(self.failure_count_key, 3600)
                self.redis_client.set(self.last_failure_key, current_time, ex=3600)
                return count
            except Exception as e:
                logger.warning(f"Failed to increment failure count in Redis: {e}")
                self._redis_available = False
        
        # Fallback to local state
        self._local_state["failure_count"] += 1
        self._local_state["last_failure"] = current_time
        return self._local_state["failure_count"]
    
    async def _reset_failure_count(self):
        """Reset failure count and success count."""
        if self._redis_available and self.redis_client:
            try:
                self.redis_client.delete(self.failure_count_key)
                self.redis_client.delete(self.success_count_key)
                self.redis_client.delete(self.last_failure_key)
            except Exception as e:
                logger.warning(f"Failed to reset counts in Redis: {e}")
                self._redis_available = False
        
        # Always reset local state
        self._local_state["failure_count"] = 0
        self._local_state["success_count"] = 0
        self._local_state["last_failure"] = 0
    
    async def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset."""
        if self._redis_available and self.redis_client:
            try:
                last_failure = self.redis_client.get(self.last_failure_key)
                if not last_failure:
                    return True
                
                time_since_failure = time.time() - int(last_failure)
                return time_since_failure >= self.recovery_timeout
            except Exception as e:
                logger.warning(f"Failed to check reset condition in Redis: {e}")
                self._redis_available = False
        
        # Fallback to local state
        if self._local_state["last_failure"] == 0:
            return True
        
        time_since_failure = time.time() - self._local_state["last_failure"]
        return time_since_failure >= self.recovery_timeout
    
    async def _on_success(self):
        """Handle successful operation."""
        current_state = await self._get_state()
        
        if current_state == CircuitState.HALF_OPEN:
            # Increment success count in half-open state
            success_count = 0
            if self._redis_available and self.redis_client:
                try:
                    success_count = self.redis_client.incr(self.success_count_key)
                    self.redis_client.expire(self.success_count_key, 3600)
                except Exception as e:
                    logger.warning(f"Failed to increment success count in Redis: {e}")
                    self._redis_available = False
            
            if not self._redis_available:
                # Fallback to local state
                self._local_state["success_count"] += 1
                success_count = self._local_state["success_count"]
            
            # Check if we have enough successes to close the circuit
            if success_count >= self.success_threshold:
                await self._set_state(CircuitState.CLOSED)
                await self._reset_failure_count()
                logger.info(f"Circuit breaker {self.service_name}: HALF_OPEN -> CLOSED")
        
        elif current_state == CircuitState.OPEN:
            # Should not happen, but handle it gracefully
            await self._set_state(CircuitState.CLOSED)
            await self._reset_failure_count()
            logger.info(f"Circuit breaker {self.service_name}: OPEN -> CLOSED (unexpected)")
    
    async def _on_failure(self):
        """Handle failed operation."""
        failure_count = await self._increment_failure_count()
        current_state = await self._get_state()
        
        logger.warning(
            f"Circuit breaker {self.service_name}: failure {failure_count}/{self.failure_threshold}",
            extra={
                "service": self.service_name,
                "failure_count": failure_count,
                "failure_threshold": self.failure_threshold,
                "current_state": current_state.value
            }
        )
        
        # Check if we should open the circuit
        if failure_count >= self.failure_threshold and current_state != CircuitState.OPEN:
            await self._set_state(CircuitState.OPEN)
            logger.error(
                f"Circuit breaker {self.service_name}: {current_state.value} -> OPEN (threshold exceeded)",
                extra={
                    "service": self.service_name,
                    "failure_count": failure_count,
                    "failure_threshold": self.failure_threshold
                }
            )
    
    async def get_status(self) -> Dict[str, Any]:
        """Get current circuit breaker status."""
        current_state = await self._get_state()
        failure_count = await self._get_failure_count()
        
        status = {
            "service": self.service_name,
            "state": current_state.value,
            "failure_count": failure_count,
            "failure_threshold": self.failure_threshold,
            "recovery_timeout": self.recovery_timeout,
            "success_threshold": self.success_threshold,
            "redis_available": self._redis_available,
            "enabled": settings.ENABLE_CIRCUIT_BREAKER
        }
        
        # Add timing information if available
        if self._redis_available and self.redis_client:
            try:
                last_failure = self.redis_client.get(self.last_failure_key)
                if last_failure:
                    time_since_failure = int(time.time()) - int(last_failure)
                    status["time_since_last_failure"] = time_since_failure
            except:
                pass
        elif self._local_state["last_failure"] > 0:
            time_since_failure = int(time.time()) - self._local_state["last_failure"]
            status["time_since_last_failure"] = time_since_failure
        
        return status


# Global circuit breakers for each provider
openai_circuit = CircuitBreaker("openai", failure_threshold=5, recovery_timeout=60)
anthropic_circuit = CircuitBreaker("anthropic", failure_threshold=5, recovery_timeout=60)


def circuit_breaker(service_name: str):
    """Decorator for applying circuit breaker to functions."""
    def decorator(func):
        if service_name == "openai":
            cb = openai_circuit
        elif service_name == "anthropic":
            cb = anthropic_circuit
        else:
            raise ValueError(f"Unknown service: {service_name}")
        
        if asyncio.iscoroutinefunction(func):
            @wraps(func)
            async def async_wrapper(*args, **kwargs):
                return await cb.call(func, *args, **kwargs)
            return async_wrapper
        else:
            @wraps(func)
            def sync_wrapper(*args, **kwargs):
                return asyncio.run(cb.call(func, *args, **kwargs))
            return sync_wrapper
    return decorator