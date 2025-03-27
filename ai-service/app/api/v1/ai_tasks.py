import logging
import time
from typing import Dict, Any
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, status
from app.dependencies import validate_internal_api_key
from app.schemas.ai_tasks import GenerateCardsRequest
from app.core.logic import process_card_generation
from app.core.ai_caller import TokenLimitError, AIServiceError

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
        # Extract input text and model
        text = input_data.get("text")
        model = input_data.get("config", {}).get("model", "gpt-3.5-turbo")
        
        if not text:
            raise ValueError("No text provided in input data")
            
        # Process card generation
        await process_card_generation(
            job_id=job_id,
            input_text=text,
            model=model,
            start_time=time.time()
        )
        
        logger.info(f"Successfully processed job {job_id}")
        
    except TokenLimitError as e:
        logger.error(f"Token limit error for job {job_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
        
    except AIServiceError as e:
        logger.error(f"AI service error for job {job_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
        
    except ValueError as e:
        logger.error(f"Validation error for job {job_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
        
    except Exception as e:
        logger.error(f"Unexpected error processing job {job_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred"
        )

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
