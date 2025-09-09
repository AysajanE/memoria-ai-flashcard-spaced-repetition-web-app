"""
Fallback configuration for model reliability patterns.

This module defines fallback chains and behavior for when AI models fail,
enabling automatic failover between different models based on error types.
"""

from typing import Dict, List, Optional
from app.config import settings
import logging

logger = logging.getLogger(__name__)


class FallbackConfig:
    """Configuration for model fallback behavior."""
    
    def __init__(self):
        # Define fallback chains - primary model -> fallback models in order of preference
        self.fallback_chains = {
            "claude-3-opus": ["claude-3-sonnet", "gpt-4o", "gpt-4o-mini"],
            "claude-3-sonnet": ["claude-3-haiku", "gpt-4o-mini", "gpt-3.5-turbo"],
            "claude-3-haiku": ["gpt-4o-mini", "gpt-3.5-turbo"],
            "claude-haiku-3-5-latest": ["gpt-4o-mini", "gpt-3.5-turbo"],
            "gpt-4o": ["gpt-4o-mini", "claude-3-sonnet", "claude-3-haiku"],
            "gpt-4o-mini": ["gpt-3.5-turbo", "claude-3-haiku"],
            "gpt-4": ["gpt-4o-mini", "gpt-3.5-turbo", "claude-3-sonnet"],
            "gpt-3.5-turbo": ["claude-3-haiku", "gpt-4o-mini"]
        }
        
        # Error types that should trigger fallback
        self.fallback_triggers = [
            "rate_limit_error",
            "quota_exceeded", 
            "service_unavailable",
            "timeout",
            "network_error",
            "ai_service_error"
        ]
    
    def get_fallback_models(self, primary_model: str) -> List[str]:
        """Get fallback models for the given primary model."""
        return self.fallback_chains.get(primary_model, [])
    
    def should_fallback(self, error_category: str) -> bool:
        """Check if error category should trigger fallback."""
        return error_category.lower() in self.fallback_triggers
    
    def get_all_models_to_try(self, primary_model: str) -> List[str]:
        """Get complete list of models to try including the primary."""
        models = [primary_model]
        if settings.ENABLE_FALLBACK:
            fallback_models = self.get_fallback_models(primary_model)
            models.extend(fallback_models)
        return models


# Global fallback config instance
fallback_config = FallbackConfig()


def log_fallback_attempt(primary_model: str, fallback_model: str, error_type: str):
    """Log fallback attempt for monitoring and debugging."""
    logger.warning(
        "Model fallback triggered",
        extra={
            "primary_model": primary_model,
            "fallback_model": fallback_model,
            "error_type": error_type,
            "fallback_enabled": settings.ENABLE_FALLBACK
        }
    )
    
    # Record metrics (avoid circular imports by using lazy import)
    try:
        from app.api.v1.admin import record_fallback_attempt
        record_fallback_attempt(primary_model, error_type)
    except ImportError:
        # Gracefully handle if admin module isn't available
        pass


def log_fallback_success(primary_model: str, successful_model: str, attempt_number: int):
    """Log successful fallback for monitoring."""
    logger.info(
        "Fallback successful",
        extra={
            "primary_model": primary_model,
            "successful_model": successful_model,
            "attempt_number": attempt_number,
            "was_fallback": attempt_number > 1
        }
    )
    
    # Record metrics (avoid circular imports by using lazy import)
    try:
        from app.api.v1.admin import record_fallback_success
        record_fallback_success(successful_model)
    except ImportError:
        # Gracefully handle if admin module isn't available
        pass


def log_all_models_failed(primary_model: str, attempted_models: List[str]):
    """Log when all models in the fallback chain have failed."""
    logger.error(
        "All models in fallback chain failed",
        extra={
            "primary_model": primary_model,
            "attempted_models": attempted_models,
            "total_attempts": len(attempted_models)
        }
    )