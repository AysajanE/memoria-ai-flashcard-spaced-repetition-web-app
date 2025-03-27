import logging
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, status
from app.dependencies import validate_internal_api_key
from app.schemas.ai_tasks import GenerateCardsRequest

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()

@router.post(
    "/generate-cards",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(validate_internal_api_key)]
)
async def trigger_generate_cards(request: GenerateCardsRequest, background_tasks: BackgroundTasks):
    """Trigger card generation process."""
    logger.info(f"Received card generation request for jobId: {request.jobId}")
    logger.debug(f"Input text length: {len(request.text)}")
    
    # TODO: Add background task for card generation
    # background_tasks.add_task(...)
    
    return {
        "message": "Card generation request received",
        "jobId": request.jobId
    }
