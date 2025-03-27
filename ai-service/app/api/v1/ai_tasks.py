import logging
import time
import random
import requests
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, status
from app.dependencies import validate_internal_api_key
from app.schemas.ai_tasks import GenerateCardsRequest
from app.config import settings
from app.core.logic import generate_flashcards_from_text

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()

async def process_card_generation(job_id: str, text: str, config: dict | None):
    """Process card generation in the background and send status update via webhook."""
    logger.info(f"Starting card generation processing for jobId: {job_id}")
    
    try:
        # Generate flashcards using AI
        result_dict = await generate_flashcards_from_text(text)
        
        # Prepare webhook callback payload
        callback_payload = {
            "jobId": job_id,
            "status": "completed",
            "resultPayload": result_dict,
            "errorMessage": None
        }
        
        # Send webhook callback
        try:
            headers = {
                "Content-Type": "application/json",
                "X-Internal-Api-Key": settings.INTERNAL_API_KEY
            }
            
            response = requests.post(
                settings.NEXTJS_APP_STATUS_WEBHOOK_URL,
                json=callback_payload,
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                logger.info(f"Successfully sent webhook callback for jobId: {job_id}")
            else:
                logger.error(
                    f"Failed to send webhook callback for jobId: {job_id}. "
                    f"Status code: {response.status_code}, Response: {response.text}"
                )
        except requests.exceptions.RequestException as e:
            logger.error(f"Error sending webhook callback for jobId: {job_id}. Error: {str(e)}")
            
    except Exception as e:
        logger.error(f"Error processing card generation for jobId: {job_id}. Error: {str(e)}")
        # Try to send failure webhook
        try:
            callback_payload = {
                "jobId": job_id,
                "status": "failed",
                "resultPayload": None,
                "errorMessage": f"Internal processing error: {str(e)}"
            }
            headers = {
                "Content-Type": "application/json",
                "X-Internal-Api-Key": settings.INTERNAL_API_KEY
            }
            requests.post(
                settings.NEXTJS_APP_STATUS_WEBHOOK_URL,
                json=callback_payload,
                headers=headers,
                timeout=10
            )
        except Exception as webhook_error:
            logger.error(f"Failed to send error webhook for jobId: {job_id}. Error: {str(webhook_error)}")
    
    logger.info(f"Completed card generation processing for jobId: {job_id}")

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
        process_card_generation,
        request.jobId,
        request.text,
        request.config
    )
    
    return {
        "message": "Card generation request received",
        "jobId": request.jobId
    }
