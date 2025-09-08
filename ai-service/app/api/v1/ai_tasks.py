import logging
import time
import asyncio
from typing import Dict, Any
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, status, Request
from app.dependencies import validate_internal_api_key
from app.schemas.ai_tasks import GenerateCardsRequest
from app.core.logic import process_card_generation
from app.core.ai_caller import TokenLimitError, AIServiceError
from app.config import settings, get_model_config

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()

# In-flight job guard (in-process)
_IN_FLIGHT: set[str] = set()
_LOCK = asyncio.Lock()

# Naive per-IP rate limiter (in-process)
_RATE_BUCKETS: Dict[str, Dict[str, float]] = {}
_RATE_LIMIT = 30  # requests per minute

async def _rate_limit(ip: str) -> None:
    now = time.time()
    window = 60.0
    b = _RATE_BUCKETS.get(ip)
    if not b or now - b.get("start", 0) >= window:
        _RATE_BUCKETS[ip] = {"start": now, "count": 1.0}
        return
    if b["count"] >= _RATE_LIMIT:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded")
    b["count"] += 1.0

async def process_ai_job(job_id: str, input_data: Dict[str, Any]) -> None:
    """
    Process an AI job in the background and send results via webhook.
    
    Args:
        job_id: Unique identifier for the job
        input_data: Dictionary containing job input data
    """
    try:
        # Extract input text - required
        text = input_data.get("text")
        if not text:
            raise ValueError("No text provided in input data")
        
        # Extract other parameters, prioritizing direct fields over config
        model = input_data.get("model") or input_data.get("config", {}).get("model")
        card_type = input_data.get("cardType") or input_data.get("config", {}).get("cardType", "qa")
        num_cards = input_data.get("numCards") or input_data.get("config", {}).get("numCards", 10)
        
        # Get default provider model if none specified
        if not model:
            # Check if a provider preference was specified
            provider = input_data.get("config", {}).get("provider", "openai")
            if provider == "anthropic":
                model = settings.DEFAULT_ANTHROPIC_MODEL
            else:
                model = settings.DEFAULT_OPENAI_MODEL
        
        # Ensure num_cards is within reasonable limits
        num_cards = max(1, min(int(num_cards), 50))
            
        # Process card generation with all parameters
        await process_card_generation(
            job_id=job_id,
            input_text=text,
            model=model,
            card_type=card_type,
            num_cards=num_cards,
            start_time=time.time()
        )

        logger.info(f"Successfully processed job {job_id}")
    except Exception as e:
        # Do not raise HTTPException here; background errors are delivered via webhook in process_card_generation
        logger.error(f"Background job error for {job_id}: {e}")
    finally:
        async with _LOCK:
            _IN_FLIGHT.discard(job_id)

@router.post(
    "/generate-cards",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(validate_internal_api_key)]
)
async def trigger_generate_cards(request: GenerateCardsRequest, background_tasks: BackgroundTasks, http_request: Request):
    """Trigger card generation process."""
    client_ip = http_request.client.host if http_request.client else "unknown"
    await _rate_limit(client_ip)

    logger.info(f"Received card generation request for jobId: {request.jobId}", extra={"jobId": request.jobId, "ip": client_ip})
    logger.debug(f"Input text length: {len(request.text)}", extra={"jobId": request.jobId})
    
    # Add background task for card generation (idempotent)
    async with _LOCK:
        if request.jobId in _IN_FLIGHT:
            logger.info("Duplicate job submission ignored (in-flight)", extra={"jobId": request.jobId})
        else:
            _IN_FLIGHT.add(request.jobId)
            background_tasks.add_task(
                process_ai_job,
                request.jobId,
                {
                    "text": request.text,
                    "model": request.model,
                    "cardType": request.cardType,
                    "numCards": request.numCards,
                    "config": request.config
                }
            )
    
    return {
        "message": "Card generation request received",
        "jobId": request.jobId
    }

@router.get("/available-models", dependencies=[Depends(validate_internal_api_key)])
async def get_available_models():
    """Get information about available AI models."""
    # Return a list of models and their information
    model_info = {}
    
    for model_name, model_data in settings.AI_MODELS.items():
        model_info[model_name] = {
            "provider": model_data["provider"],
            "description": model_data["description"],
            "maxInputTokens": model_data["max_input_tokens"],
            "maxOutputTokens": model_data["max_output_tokens"],
            "isDefault": (
                model_name == settings.DEFAULT_OPENAI_MODEL and model_data["provider"] == "openai"
            ) or (
                model_name == settings.DEFAULT_ANTHROPIC_MODEL and model_data["provider"] == "anthropic"
            )
        }
    
    return {
        "models": model_info,
        "defaultOpenAI": settings.DEFAULT_OPENAI_MODEL,
        "defaultAnthropic": settings.DEFAULT_ANTHROPIC_MODEL
    }
