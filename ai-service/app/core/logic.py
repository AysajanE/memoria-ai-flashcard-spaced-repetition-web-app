import json
import time
import logging
from typing import Dict, List, Any
import requests
from app.config import settings
from app.core.ai_caller import generate_cards_with_ai, TokenLimitError, AIServiceError
from app.core.text_processing import count_tokens
from app.schemas.responses import WebhookPayload, GenerateCardsResult

logger = logging.getLogger(__name__)

# Constants
MAX_INPUT_TOKENS = settings.MAX_INPUT_TOKENS
MAX_OUTPUT_TOKENS = settings.MAX_OUTPUT_TOKENS

class WebhookError(Exception):
    """Custom exception for webhook-related errors"""
    pass

def clean_json_string(json_str: str) -> str:
    """Clean and normalize JSON string before parsing"""
    # Remove any markdown code block markers
    json_str = json_str.replace("```json", "").replace("```", "")
    
    # Remove any leading/trailing whitespace
    json_str = json_str.strip()
    
    # Handle potential line breaks in the JSON
    json_str = " ".join(json_str.split())
    
    return json_str

def parse_ai_response(response_text: str) -> Dict[str, Any]:
    """Parse AI response with improved error handling"""
    try:
        # Clean the response text
        cleaned_text = clean_json_string(response_text)
        
        # Attempt to parse
        result = json.loads(cleaned_text)
        
        # Validate basic structure
        if not isinstance(result, dict):
            raise ValueError("Response must be a JSON object")
        
        if "cards" not in result:
            raise ValueError("Response must contain 'cards' array")
        
        if not isinstance(result["cards"], list):
            raise ValueError("'cards' must be an array")
        
        return result
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI response: {e}")
        logger.error(f"Raw response: {response_text}")
        raise ValueError(f"Invalid JSON response: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error parsing AI response: {e}")
        logger.error(f"Raw response: {response_text}")
        raise

def send_webhook_with_retry(
    payload: WebhookPayload,
    max_retries: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 5.0
) -> None:
    """Send webhook with exponential backoff retry"""
    delay = initial_delay
    last_error = None
    
    for attempt in range(max_retries):
        try:
            response = requests.post(
                settings.NEXTJS_APP_STATUS_WEBHOOK_URL,
                json=payload.model_dump(),
                headers={"x-internal-api-key": settings.INTERNAL_API_KEY},
                timeout=10
            )
            response.raise_for_status()
            logger.info(f"Webhook sent successfully (attempt {attempt + 1})")
            return
        except requests.exceptions.RequestException as e:
            last_error = e
            logger.warning(f"Webhook attempt {attempt + 1} failed: {e}")
            
            if attempt < max_retries - 1:
                time.sleep(delay)
                delay = min(delay * 2, max_delay)  # Exponential backoff
    
    # If we get here, all retries failed
    error_msg = f"Failed to send webhook after {max_retries} attempts. Last error: {last_error}"
    logger.error(error_msg)
    raise WebhookError(error_msg)

async def process_card_generation(
    job_id: str,
    input_text: str,
    model: str,
    start_time: float
) -> None:
    """Process card generation and send webhook with retries"""
    try:
        # Check input token limit
        input_tokens = count_tokens(input_text, model)
        if input_tokens > MAX_INPUT_TOKENS:
            error_msg = (
                f"Input text exceeds maximum token limit of {MAX_INPUT_TOKENS}. "
                f"Current token count: {input_tokens}. "
                "Please reduce the input text length or split it into smaller chunks."
            )
            logger.warning(error_msg)
            raise TokenLimitError(error_msg)

        # Generate cards using AI
        result = await generate_cards_with_ai(
            text=input_text,
            model_name=model,
            system_prompt=settings.DEFAULT_SYSTEM_PROMPT
        )
        
        # Parse and validate AI response
        parsed_result = parse_ai_response(result)
        
        # Check output token limit
        output_tokens = sum(count_tokens(card["front"] + card["back"], model) for card in parsed_result["cards"])
        if output_tokens > MAX_OUTPUT_TOKENS:
            error_msg = (
                f"Generated content exceeds maximum output token limit of {MAX_OUTPUT_TOKENS}. "
                f"Current token count: {output_tokens}. "
                "Please try with a shorter input text."
            )
            logger.warning(error_msg)
            raise TokenLimitError(error_msg)
        
        # Create result payload
        result_payload = GenerateCardsResult(
            cards=parsed_result["cards"],
            model=model,
            processingTime=time.time() - start_time,
            tokenCount=input_tokens + output_tokens
        )
        
        # Create and send webhook payload
        webhook_payload = WebhookPayload(
            jobId=job_id,
            status="completed",
            resultPayload=result_payload.model_dump()
        )
        
        send_webhook_with_retry(webhook_payload)
        
    except TokenLimitError as e:
        logger.error(f"Token limit exceeded: {e}")
        webhook_payload = WebhookPayload(
            jobId=job_id,
            status="failed",
            errorMessage=str(e)
        )
        send_webhook_with_retry(webhook_payload)
    except AIServiceError as e:
        logger.error(f"AI service error: {e}")
        webhook_payload = WebhookPayload(
            jobId=job_id,
            status="failed",
            errorMessage=f"AI service error: {str(e)}"
        )
        send_webhook_with_retry(webhook_payload)
    except Exception as e:
        logger.error(f"Error processing card generation: {e}")
        webhook_payload = WebhookPayload(
            jobId=job_id,
            status="failed",
            errorMessage=f"An unexpected error occurred: {str(e)}"
        )
        send_webhook_with_retry(webhook_payload) 