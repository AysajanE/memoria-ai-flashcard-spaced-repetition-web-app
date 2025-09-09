from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import validate_internal_api_key
from app.core.cost_calculator import cost_calculator
from app.core.webhook_sender import send_webhook_async
from app.config import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/admin",
    tags=["admin"],
    dependencies=[Depends(validate_internal_api_key)]
)

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
            "enable_cost_accounting": settings.ENABLE_COST_ACCOUNTING
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
            "card_retry": settings.ENABLE_CARD_RETRY
        }
    }