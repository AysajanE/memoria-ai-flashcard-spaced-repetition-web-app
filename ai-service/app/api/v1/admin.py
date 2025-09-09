"""
Admin API endpoints for monitoring and management.

This module provides internal endpoints for monitoring fallback statistics,
system health, and other administrative functions.
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
import logging

from app.queue import q, get_queue_info
from app.core.deduplication import deduplicator
from app.core.metrics import concurrency_tracker
from app.core.cost_calculator import cost_calculator
from app.core.webhook_sender import send_webhook_async
from app.config import settings
from app.core.fallback_config import fallback_config
from app.core.circuit_breaker import openai_circuit, anthropic_circuit, CircuitState
from app.dependencies import verify_internal_api_key
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/admin",
    tags=["admin"],
    dependencies=[Depends(verify_internal_api_key)]
)

# Global statistics tracking (in production, this would be in Redis or a database)
fallback_stats = {
    "fallback_attempts": 0,
    "fallback_successes": 0,
    "model_failures": {},  # model_name -> failure_count
    "model_fallback_usage": {},  # fallback_model -> usage_count
    "error_categories": {}  # error_category -> count
}

# Existing Phase 2/3 Endpoints
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

@router.get("/pricing-info")
async def get_pricing_info():
    """Get current AI model pricing information."""
    return cost_calculator.get_pricing_info()

@router.get("/cost-estimate")
async def estimate_cost(
    model: str,
    input_tokens: int = 1000,
    output_tokens: int = 500
):
    """Estimate cost for given token usage."""
    usage = {
        "prompt_tokens": input_tokens,
        "completion_tokens": output_tokens,
        "total_tokens": input_tokens + output_tokens
    }
    
    cost = cost_calculator.calculate_cost(model, usage)
    
    return {
        "model": model,
        "estimated_cost_usd": cost,
        "usage": usage
    }

@router.post("/retry-webhook/{job_id}")
async def retry_webhook(job_id: str):
    """Retry webhook delivery for a specific job."""
    
    try:
        # Create a simple retry payload (in a real implementation, 
        # you'd need to store job results somewhere to retry them)
        retry_payload = {
            "jobId": job_id,
            "status": "completed",
            "message": "Webhook retry attempt"
        }
        
        await send_webhook_async(retry_payload)
        
        return {
            "success": True,
            "message": f"Webhook retry sent for job {job_id}",
            "payload": retry_payload
        }
        
    except Exception as e:
        logger.error(f"Webhook retry failed for {job_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/config")
async def get_config():
    """Get current service configuration (non-sensitive)."""
    return {
        "feature_flags": {
            "enable_progress_updates": settings.ENABLE_PROGRESS_UPDATES,
            "enable_card_retry": settings.ENABLE_CARD_RETRY,
            "enable_cost_accounting": settings.ENABLE_COST_ACCOUNTING,
            "enable_fallback": settings.ENABLE_FALLBACK,
            "enable_circuit_breaker": settings.ENABLE_CIRCUIT_BREAKER
        },
        "limits": {
            "max_input_tokens": settings.MAX_INPUT_TOKENS,
            "max_output_tokens": settings.MAX_OUTPUT_TOKENS,
            "tokens_per_card_budget": settings.TOKENS_PER_CARD_BUDGET,
            "min_card_yield_ratio": settings.MIN_CARD_YIELD_RATIO
        },
        "models": {
            "default_openai": settings.DEFAULT_OPENAI_MODEL,
            "default_anthropic": settings.DEFAULT_ANTHROPIC_MODEL,
            "available_models": list(settings.AI_MODELS.keys())
        },
        "environment": settings.ENVIRONMENT,
        "has_api_keys": {
            "openai": bool(settings.OPENAI_API_KEY),
            "anthropic": bool(settings.ANTHROPIC_API_KEY)
        }
    }

@router.get("/health-detailed")
async def detailed_health():
    """Detailed health check with service information."""
    return {
        "status": "healthy",
        "service": "memoria-ai-service",
        "version": "0.1.0",
        "environment": settings.ENVIRONMENT,
        "features_enabled": {
            "progress_updates": settings.ENABLE_PROGRESS_UPDATES,
            "cost_accounting": settings.ENABLE_COST_ACCOUNTING,
            "card_retry": settings.ENABLE_CARD_RETRY,
            "fallback": settings.ENABLE_FALLBACK,
            "circuit_breaker": settings.ENABLE_CIRCUIT_BREAKER
        }
    }

# Phase 4 Reliability Endpoints
@router.get("/fallback-stats")
async def get_fallback_stats() -> Dict[str, Any]:
    """Get fallback usage statistics."""
    
    success_rate = 0.0
    if fallback_stats["fallback_attempts"] > 0:
        success_rate = (fallback_stats["fallback_successes"] / fallback_stats["fallback_attempts"]) * 100
    
    return {
        "fallback_enabled": settings.ENABLE_FALLBACK,
        "stats": fallback_stats,
        "fallback_chains": fallback_config.fallback_chains,
        "success_rate_percentage": round(success_rate, 2),
        "total_requests_processed": fallback_stats["fallback_attempts"] + sum(
            1 for _ in fallback_stats.get("successful_primary_requests", [])
        )
    }

@router.post("/reset-fallback-stats")
async def reset_fallback_stats() -> Dict[str, str]:
    """Reset fallback statistics."""
    global fallback_stats
    
    fallback_stats = {
        "fallback_attempts": 0,
        "fallback_successes": 0,
        "model_failures": {},
        "model_fallback_usage": {},
        "error_categories": {}
    }
    
    logger.info("Fallback statistics reset by admin")
    return {"message": "Fallback statistics reset successfully"}

@router.get("/system-health")
async def get_system_health() -> Dict[str, Any]:
    """Get overall system health information."""
    
    health_info = {
        "service": "ai-service",
        "status": "healthy",
        "features": {
            "fallback_enabled": settings.ENABLE_FALLBACK,
            "circuit_breaker_enabled": settings.ENABLE_CIRCUIT_BREAKER
        },
        "configuration": {
            "max_input_tokens": settings.MAX_INPUT_TOKENS,
            "max_output_tokens": settings.MAX_OUTPUT_TOKENS,
            "default_openai_model": settings.DEFAULT_OPENAI_MODEL,
            "default_anthropic_model": settings.DEFAULT_ANTHROPIC_MODEL
        },
        "providers": {
            "openai_configured": bool(settings.OPENAI_API_KEY),
            "anthropic_configured": bool(settings.ANTHROPIC_API_KEY)
        }
    }
    
    return health_info

@router.get("/fallback-config")
async def get_fallback_config() -> Dict[str, Any]:
    """Get current fallback configuration."""
    
    return {
        "enabled": settings.ENABLE_FALLBACK,
        "chains": fallback_config.fallback_chains,
        "triggers": fallback_config.fallback_triggers,
        "available_models": list(settings.AI_MODELS.keys()) if settings.AI_MODELS else []
    }

@router.get("/circuit-breaker-status")
async def get_circuit_breaker_status() -> Dict[str, Any]:
    """Get status of all circuit breakers."""
    
    return {
        "circuit_breaker_enabled": settings.ENABLE_CIRCUIT_BREAKER,
        "redis_url_configured": bool(settings.REDIS_URL),
        "openai": await openai_circuit.get_status(),
        "anthropic": await anthropic_circuit.get_status()
    }

@router.post("/reset-circuit-breaker/{service}")
async def reset_circuit_breaker(service: str) -> Dict[str, str]:
    """Manually reset a circuit breaker."""
    
    if service.lower() == "openai":
        await openai_circuit._set_state(CircuitState.CLOSED)
        await openai_circuit._reset_failure_count()
        logger.info("OpenAI circuit breaker reset by admin")
        return {"message": f"Circuit breaker for {service} has been reset to CLOSED state"}
    elif service.lower() == "anthropic":
        await anthropic_circuit._set_state(CircuitState.CLOSED)
        await anthropic_circuit._reset_failure_count()
        logger.info("Anthropic circuit breaker reset by admin")
        return {"message": f"Circuit breaker for {service} has been reset to CLOSED state"}
    else:
        raise HTTPException(status_code=404, detail=f"Service '{service}' not found. Available services: openai, anthropic")

@router.get("/all-reliability-features")
async def get_all_reliability_features() -> Dict[str, Any]:
    """Get comprehensive status of all Phase 4 reliability features."""
    
    # Get circuit breaker status
    circuit_status = {
        "enabled": settings.ENABLE_CIRCUIT_BREAKER,
        "openai": await openai_circuit.get_status(),
        "anthropic": await anthropic_circuit.get_status()
    }
    
    # Get fallback status
    fallback_success_rate = 0.0
    if fallback_stats["fallback_attempts"] > 0:
        fallback_success_rate = (fallback_stats["fallback_successes"] / fallback_stats["fallback_attempts"]) * 100
    
    fallback_status = {
        "enabled": settings.ENABLE_FALLBACK,
        "stats": fallback_stats,
        "success_rate_percentage": round(fallback_success_rate, 2),
        "chains": fallback_config.fallback_chains
    }
    
    return {
        "service": "ai-service",
        "phase": "Phase 4 - Reliability Patterns & Fallbacks",
        "features": {
            "fallback": fallback_status,
            "circuit_breaker": circuit_status
        },
        "infrastructure": {
            "redis_configured": bool(settings.REDIS_URL),
            "providers_configured": {
                "openai": bool(settings.OPENAI_API_KEY),
                "anthropic": bool(settings.ANTHROPIC_API_KEY)
            }
        }
    }

# Utility functions for tracking fallback stats
def record_fallback_attempt(primary_model: str, error_category: str):
    """Record a fallback attempt for metrics."""
    fallback_stats["fallback_attempts"] += 1
    
    # Track model failures
    if primary_model not in fallback_stats["model_failures"]:
        fallback_stats["model_failures"][primary_model] = 0
    fallback_stats["model_failures"][primary_model] += 1
    
    # Track error categories
    if error_category not in fallback_stats["error_categories"]:
        fallback_stats["error_categories"][error_category] = 0
    fallback_stats["error_categories"][error_category] += 1

def record_fallback_success(successful_model: str):
    """Record a successful fallback for metrics."""
    fallback_stats["fallback_successes"] += 1
    
    # Track which models are used as fallbacks
    if successful_model not in fallback_stats["model_fallback_usage"]:
        fallback_stats["model_fallback_usage"][successful_model] = 0
    fallback_stats["model_fallback_usage"][successful_model] += 1