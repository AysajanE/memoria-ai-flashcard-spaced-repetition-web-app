import logging
from typing import List
from app.config import settings

logger = logging.getLogger(__name__)

def validate_configuration() -> List[str]:
    """Validate configuration and return list of warnings/errors."""
    issues = []
    
    # Queue configuration
    if settings.USE_QUEUE:
        if not settings.REDIS_URL:
            issues.append("ERROR: USE_QUEUE=true but REDIS_URL not set")
        else:
            try:
                import redis
                r = redis.from_url(settings.REDIS_URL)
                r.ping()
                logger.info("Redis connection verified")
            except ImportError:
                issues.append("ERROR: Redis dependency not installed but USE_QUEUE=true")
            except Exception as e:
                issues.append(f"ERROR: Redis connection failed: {e}")

    # API keys
    if not settings.OPENAI_API_KEY and not settings.ANTHROPIC_API_KEY:
        issues.append("WARNING: No AI provider API keys configured")

    # HMAC security
    if settings.ENABLE_INBOUND_HMAC and not settings.INTERNAL_WEBHOOK_HMAC_SECRET:
        issues.append("ERROR: ENABLE_INBOUND_HMAC=true but INTERNAL_WEBHOOK_HMAC_SECRET not set")

    # CORS
    if settings.ENVIRONMENT != "development" and "*" in settings.CORS_ORIGINS:
        issues.append("WARNING: Wildcard CORS origins in non-development environment")

    return issues


def log_configuration():
    """Log current configuration (without secrets)."""
    config_summary = {
        "environment": settings.ENVIRONMENT,
        "use_queue": settings.USE_QUEUE,
        "enable_fallback": settings.ENABLE_FALLBACK,
        "enable_progress_updates": settings.ENABLE_PROGRESS_UPDATES,
        "enable_cost_accounting": settings.ENABLE_COST_ACCOUNTING,
        "enable_inbound_hmac": settings.ENABLE_INBOUND_HMAC,
        "openai_max_concurrency": settings.OPENAI_MAX_CONCURRENCY,
        "anthropic_max_concurrency": settings.ANTHROPIC_MAX_CONCURRENCY,
        "tokens_per_card_budget": settings.TOKENS_PER_CARD_BUDGET,
        "cors_origins": settings.CORS_ORIGINS,
        "has_redis_url": bool(settings.REDIS_URL),
        "has_openai_key": bool(settings.OPENAI_API_KEY),
        "has_anthropic_key": bool(settings.ANTHROPIC_API_KEY),
        "ai_models_count": len(settings.AI_MODELS)
    }
    
    logger.info("Configuration loaded", extra=config_summary)