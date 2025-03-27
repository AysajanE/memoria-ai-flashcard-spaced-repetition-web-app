import logging
import time
import random
import requests
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, status
from app.dependencies import validate_internal_api_key
from app.schemas.ai_tasks import GenerateCardsRequest
from app.config import settings
from app.core.logic import generate_flashcards_from_text
from app.core.ai_caller import TokenLimitError, AIServiceError
from app.schemas.webhook import WebhookPayload

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()

async def process_ai_job(job_id: str, input_data: Dict[str, Any]) -> None:
    """
    Process an AI job in the background and send results via webhook.
    
    Args:
        job_id: Unique identifier for the job
        input_data: Dictionary containing job input data
    """
    try:
        # Extract input text
        text = input_data.get("text")
        if not text:
            raise ValueError("No text provided in input data")
            
        # Generate flashcards
        result = await generate_flashcards_from_text(text)
        
        # Prepare success webhook payload
        webhook_payload = WebhookPayload(
            job_id=job_id,
            status="completed",
            result_payload=result
        )
        
        # TODO: Send webhook to Next.js app
        # await send_webhook(webhook_payload)
        logger.info(f"Successfully processed job {job_id}")
        
    except TokenLimitError as e:
        logger.error(f"Token limit error for job {job_id}: {str(e)}")
        webhook_payload = WebhookPayload(
            job_id=job_id,
            status="failed",
            error_message=f"Input text exceeds token limit: {str(e)}"
        )
        # await send_webhook(webhook_payload)
        
    except AIServiceError as e:
        logger.error(f"AI service error for job {job_id}: {str(e)}")
        webhook_payload = WebhookPayload(
            job_id=job_id,
            status="failed",
            error_message=f"AI service error: {str(e)}"
        )
        # await send_webhook(webhook_payload)
        
    except ValueError as e:
        logger.error(f"Validation error for job {job_id}: {str(e)}")
        webhook_payload = WebhookPayload(
            job_id=job_id,
            status="failed",
            error_message=f"Invalid input: {str(e)}"
        )
        # await send_webhook(webhook_payload)
        
    except Exception as e:
        logger.error(f"Unexpected error processing job {job_id}: {str(e)}")
        webhook_payload = WebhookPayload(
            job_id=job_id,
            status="failed",
            error_message=f"Unexpected error: {str(e)}"
        )
        # await send_webhook(webhook_payload)

@router.post(
    "/generate-cards",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(validate_internal_api_key)]
)
async def trigger_generate_cards(request: GenerateCardsRequest, background_tasks: BackgroundTasks):
    """Trigger card generation process."""
    logger.info(f"Received card generation request for jobId: {request.jobId}")
    logger.debug(f"Input text length: {len(request.text)}")
    
    # Add background task for card generation
    background_tasks.add_task(
        process_ai_job,
        request.jobId,
        {
            "text": request.text,
            "config": request.config
        }
    )
    
    return {
        "message": "Card generation request received",
        "jobId": request.jobId
    }
