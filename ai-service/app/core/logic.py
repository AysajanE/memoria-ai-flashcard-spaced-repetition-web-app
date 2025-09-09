import json
import time
import asyncio
import logging
from typing import Dict, List, Any
import requests
from app.config import settings
import hmac
import hashlib
from app.core.ai_caller import generate_cards_with_ai, TokenLimitError, AIServiceError, AuthError, RateLimitExceeded, NetworkError, AIModelError
from app.core.text_processing import count_tokens
from app.core.deduplication import deduplicator
from app.schemas.responses import WebhookPayload, GenerateCardsResult, ErrorDetail, ErrorCategory

logger = logging.getLogger(__name__)

def process_job_entrypoint(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Synchronous entrypoint for RQ worker.
    Wraps the async process_card_generation function.
    """
    try:
        logger.info("Starting job processing", extra={"jobId": payload.get("jobId")})
        
        # Run async function in new event loop
        result = asyncio.run(process_card_generation(
            job_id=payload["jobId"],
            input_text=payload["text"],
            model=payload.get("model"),
            card_type=payload.get("cardType", "qa"),
            num_cards=payload.get("numCards", 10),
            start_time=time.time()
        ))
        
        logger.info("Job completed successfully", extra={"jobId": payload.get("jobId")})
        return {"status": "completed", "result": result}
        
    except Exception as e:
        logger.error(f"Job processing failed: {e}", 
                    extra={"jobId": payload.get("jobId")}, 
                    exc_info=True)
        # Mark job as completed even on failure to prevent locks
        deduplicator.mark_completed(payload.get("jobId"))
        raise

# Constants
MAX_INPUT_TOKENS = settings.MAX_INPUT_TOKENS
MAX_OUTPUT_TOKENS = settings.MAX_OUTPUT_TOKENS

# Error classes
class ParseError(Exception):
    """Custom exception for parsing errors"""
    category = "parse_error"
    retryable = False
    code = "INVALID_RESPONSE"
    suggested_action = "Contact support if the issue persists."
    context = None
    
    def __init__(self, message, code=None, context=None, suggested_action=None):
        super().__init__(message)
        if code:
            self.code = code
        if context:
            self.context = context
        if suggested_action:
            self.suggested_action = suggested_action

class WebhookError(Exception):
    """Custom exception for webhook-related errors"""
    category = "webhook_error"
    retryable = True
    code = "WEBHOOK_DELIVERY_FAILED"
    suggested_action = "Check webhook configuration and retry."
    context = None
    
    def __init__(self, message, code=None, context=None, suggested_action=None):
        super().__init__(message)
        if code:
            self.code = code
        if context:
            self.context = context
        if suggested_action:
            self.suggested_action = suggested_action

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
    """Parse AI response with improved error handling and Anthropic response format support"""
    try:
        # Clean the response text
        cleaned_text = clean_json_string(response_text)
        
        # First try direct JSON parsing
        try:
            result = json.loads(cleaned_text)
        except json.JSONDecodeError:
            # If direct parsing fails, try to extract JSON from text response
            # This is common with Anthropic models that might wrap JSON in explanatory text
            import re
            json_match = re.search(r'(\{.*\})', cleaned_text, re.DOTALL)
            if json_match:
                try:
                    result = json.loads(json_match.group(1))
                except json.JSONDecodeError:
                    # If we still can't parse it, try a more aggressive approach
                    # Find anything that looks like a JSON object or array
                    json_match = re.search(r'(\{[\s\S]*\}|\[[\s\S]*\])', cleaned_text)
                    if json_match:
                        result = json.loads(json_match.group(1))
                    else:
                        raise
            else:
                # If we still can't find JSON, handle manually by creating a structure
                # This is a fallback to handle completely non-JSON responses
                card_pairs = []
                lines = response_text.split('\n')
                current_front = None
                current_back = ""
                
                for line in lines:
                    line = line.strip()
                    if not line:
                        continue
                    
                    # Look for question/answer patterns
                    if line.startswith("Q:") or line.startswith("Question:"):
                        # If we have a previous Q/A pair, save it
                        if current_front is not None:
                            card_pairs.append({"front": current_front, "back": current_back.strip()})
                            current_back = ""
                        
                        # Extract the new question
                        current_front = line.split(":", 1)[1].strip()
                    elif line.startswith("A:") or line.startswith("Answer:"):
                        # Extract the answer
                        current_back = line.split(":", 1)[1].strip()
                    elif current_front is not None:
                        # Append to current back if we're in the middle of a pair
                        current_back += " " + line
                
                # Don't forget the last pair
                if current_front is not None:
                    card_pairs.append({"front": current_front, "back": current_back.strip()})
                
                if card_pairs:
                    result = {"cards": card_pairs}
                else:
                    raise ParseError(
                        "Could not extract flashcards from AI response",
                        code="EXTRACTION_FAILED",
                        context={"response_text": response_text[:500] + "..." if len(response_text) > 500 else response_text}
                    )
        
        # Validate basic structure
        if not isinstance(result, dict):
            raise ParseError(
                "Response must be a JSON object",
                code="INVALID_RESPONSE_STRUCTURE",
                context={"response_type": type(result).__name__},
                suggested_action="Check AI model parameters or try a different model"
            )
        
        if "cards" not in result:
            raise ParseError(
                "Response must contain 'cards' array",
                code="MISSING_CARDS_FIELD",
                context={"available_fields": list(result.keys())},
                suggested_action="Check AI model parameters or try a different model"
            )
        
        if not isinstance(result["cards"], list):
            raise ParseError(
                "'cards' must be an array",
                code="INVALID_CARDS_TYPE",
                context={"cards_type": type(result["cards"]).__name__},
                suggested_action="Check AI model parameters or try a different model"
            )
        
        # Validate each card structure and enforce type/length bounds
        validated_cards: List[Dict[str, Any]] = []
        for i, card in enumerate(result["cards"]):
            if not isinstance(card, dict):
                raise ParseError(
                    f"Card at index {i} must be an object",
                    code="INVALID_CARD_TYPE",
                    context={"index": i, "card_type": type(card).__name__}
                )

            front = card.get("front")
            back = card.get("back")
            if front is None:
                raise ParseError(
                    f"Card at index {i} missing 'front' field",
                    code="MISSING_FRONT_FIELD",
                    context={"index": i, "card_fields": list(card.keys())}
                )
            if back is None:
                raise ParseError(
                    f"Card at index {i} missing 'back' field",
                    code="MISSING_BACK_FIELD",
                    context={"index": i, "card_fields": list(card.keys())}
                )
            if not isinstance(front, str) or not isinstance(back, str):
                raise ParseError(
                    f"Card at index {i} must have string 'front' and 'back'",
                    code="INVALID_CARD_FIELD_TYPES",
                    context={"index": i, "front_type": type(front).__name__, "back_type": type(back).__name__}
                )
            front_s = front.strip()
            back_s = back.strip()
            if len(front_s) == 0 or len(front_s) > 1000 or len(back_s) == 0 or len(back_s) > 1000:
                raise ParseError(
                    f"Card at index {i} has invalid lengths",
                    code="INVALID_CARD_LENGTH",
                    context={"index": i, "front_len": len(front_s), "back_len": len(back_s)}
                )
            validated_cards.append({"front": front_s, "back": back_s})

        result["cards"] = validated_cards
        return result
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI response: {e}")
        logger.error(f"Raw response: {response_text}")
        # Truncate response for the error context to avoid overwhelming logs
        truncated_response = response_text[:500] + "..." if len(response_text) > 500 else response_text
        raise ParseError(
            f"Invalid JSON response: {str(e)}",
            code="JSON_DECODE_ERROR",
            context={"error": str(e), "response_snippet": truncated_response},
            suggested_action="Try adjusting the model parameters or try a different model"
        )
    except ParseError:
        # Just re-raise if it's already a ParseError
        raise
    except Exception as e:
        logger.error(f"Unexpected error parsing AI response: {e}")
        logger.error(f"Raw response: {response_text}")
        # Truncate response for the error context
        truncated_response = response_text[:500] + "..." if len(response_text) > 500 else response_text
        raise ParseError(
            f"Error processing AI response: {str(e)}",
            code="RESPONSE_PROCESSING_ERROR",
            context={"error_type": type(e).__name__, "error": str(e), "response_snippet": truncated_response}
        )

def send_webhook_with_retry(
    payload: WebhookPayload,
    max_retries: int = 3,
    initial_delay: float = 1.0,
    max_delay: float = 5.0
) -> None:
    """Send webhook with exponential backoff retry"""
    delay = initial_delay
    last_error = None
    last_status = None
    last_response_text = None
    
    for attempt in range(max_retries):
        try:
            # Serialize to JSON string explicitly to compute HMAC over exact body
            json_obj = payload.model_dump(mode="json")
            raw = json.dumps(json_obj, separators=(",", ":"))

            headers = {
                "x-internal-api-key": settings.INTERNAL_API_KEY,
                "content-type": "application/json",
                "user-agent": "ai-service-webhook/1.0",
            }
            if settings.INTERNAL_WEBHOOK_HMAC_SECRET:
                ts = str(int(time.time() * 1000))
                mac = hmac.new(
                    settings.INTERNAL_WEBHOOK_HMAC_SECRET.encode("utf-8"),
                    f"{ts}.{raw}".encode("utf-8"),
                    hashlib.sha256,
                ).hexdigest()
                headers["x-webhook-timestamp"] = ts
                headers["x-webhook-signature"] = f"sha256={mac}"

            response = requests.post(
                settings.NEXTJS_APP_STATUS_WEBHOOK_URL,
                data=raw,
                headers=headers,
                timeout=10,
            )
            last_status = response.status_code
            
            try:
                last_response_text = response.text[:200]  # Truncate long responses
            except:
                last_response_text = "(could not extract response text)"
                
            # Check if status code indicates success
            response.raise_for_status()
            logger.info(f"Webhook sent successfully (attempt {attempt + 1})")
            return
            
        except requests.exceptions.HTTPError as e:
            last_error = e
            logger.warning(f"Webhook HTTP error (attempt {attempt + 1}): {e}")
            
            # Special handling for different status codes
            if response.status_code == 401 or response.status_code == 403:
                # Auth errors are not retryable
                code = "WEBHOOK_AUTH_ERROR"
                suggested_action = "Check webhook authentication credentials"
                retryable = False
                break
                
            elif response.status_code == 404:
                code = "WEBHOOK_ENDPOINT_NOT_FOUND"
                suggested_action = "Verify webhook URL configuration"
                retryable = False
                break
                
            elif response.status_code == 429:
                code = "WEBHOOK_RATE_LIMITED"
                retryable = True
            
            elif response.status_code >= 500:
                code = "WEBHOOK_SERVER_ERROR"
                retryable = True
            
            else:
                code = "WEBHOOK_HTTP_ERROR"
                retryable = True
                
        except requests.exceptions.Timeout as e:
            last_error = e
            logger.warning(f"Webhook timeout (attempt {attempt + 1}): {e}")
            code = "WEBHOOK_TIMEOUT"
            retryable = True
            
        except requests.exceptions.ConnectionError as e:
            last_error = e
            logger.warning(f"Webhook connection error (attempt {attempt + 1}): {e}")
            code = "WEBHOOK_CONNECTION_ERROR"
            retryable = True
            
        except requests.exceptions.RequestException as e:
            last_error = e
            logger.warning(f"Webhook error (attempt {attempt + 1}): {e}")
            code = "WEBHOOK_REQUEST_ERROR"
            retryable = True
            
        # Attempt retry if we haven't reached max retries
        if attempt < max_retries - 1:
            time.sleep(delay)
            delay = min(delay * 2, max_delay)  # Exponential backoff
        
    # If we get here, all retries failed or we hit a non-retryable error
    error_context = {
        "attempts": attempt + 1,
        "last_status": last_status,
        "last_response": last_response_text,
        "original_error": str(last_error) if last_error else None
    }
    
    error_msg = f"Failed to send webhook after {attempt + 1} attempts. Last error: {last_error}"
    logger.error(error_msg)
    
    # Default values if not set in the exception handlers
    if 'code' not in locals():
        code = "WEBHOOK_DELIVERY_FAILED"
    if 'suggested_action' not in locals():
        suggested_action = "Check webhook configuration and network connectivity"
    if 'retryable' not in locals():
        retryable = True
    
    # Create a WebhookError with detailed information
    webhook_error = WebhookError(
        error_msg,
        code=code,
        context=error_context,
        suggested_action=suggested_action
    )
    webhook_error.retryable = retryable
    
    raise webhook_error

async def process_card_generation(
    job_id: str,
    input_text: str,
    model: str,
    card_type: str = "qa",
    num_cards: int = 10,
    config: Dict[str, Any] = None,
    start_time: float = None
) -> Dict[str, Any]:
    """Main card generation with progress tracking."""
    start_time = start_time or time.time()
    config = config or {}
    
    # Import webhook sender
    from app.core.webhook_sender import send_webhook_async
    from app.core.chunked_processor import ChunkedProcessor
    
    async def progress_callback(payload):
        """Callback to send progress updates."""
        if settings.ENABLE_PROGRESS_UPDATES:
            await send_webhook_async(payload)
    
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
            raise TokenLimitError(
                error_msg,
                context={
                    "input_tokens": input_tokens,
                    "max_tokens": MAX_INPUT_TOKENS,
                    "model": model
                }
            )

        # Initialize processor with progress callback
        processor = ChunkedProcessor(progress_callback)
        
        # Process with progress tracking
        cards, metrics = await processor.process_long_text(
            text=input_text,
            model=model,
            card_type=card_type,
            num_cards=num_cards,
            job_id=job_id
        )
        
        # Check output token limit (use actual tokens from AI response if available)
        actual_tokens = metrics.get("usage", {}).get("total_tokens", 0)
        output_tokens = sum(count_tokens(card["front"] + card["back"], model) for card in cards)
        
        if output_tokens > MAX_OUTPUT_TOKENS:
            error_msg = (
                f"Generated content exceeds maximum output token limit of {MAX_OUTPUT_TOKENS}. "
                f"Current token count: {output_tokens}. "
                "Please try with a shorter input text."
            )
            logger.warning(error_msg)
            raise TokenLimitError(
                error_msg,
                code="OUTPUT_TOKEN_LIMIT_EXCEEDED",
                context={
                    "output_tokens": output_tokens,
                    "max_tokens": MAX_OUTPUT_TOKENS,
                    "model": model,
                    "card_count": len(cards)
                }
            )
        
        # Create result payload
        result_payload = GenerateCardsResult(
            cards=cards,
            model=model,
            processingTime=time.time() - start_time,
            tokenCount=actual_tokens if actual_tokens > 0 else input_tokens + output_tokens
        )
        
        # Send completion webhook
        completion_payload = {
            "jobId": job_id,
            "status": "completed",
            "cards": cards,
            "processingTime": time.time() - start_time,
            "resultPayload": result_payload.model_dump(mode="json")
        }
        
        # Add cost information if enabled
        if settings.ENABLE_COST_ACCOUNTING and metrics.get("cost_usd"):
            completion_payload.update({
                "costUSD": metrics["cost_usd"],
                "tokensUsed": metrics["usage"]["total_tokens"],
                "model": model
            })
        
        await send_webhook_async(completion_payload)
        
        return {"cards": cards, "status": "completed"}
        
        # Mark job as completed on success
        deduplicator.mark_completed(job_id)
        
    except (TokenLimitError, ParseError, AuthError, RateLimitExceeded, 
            NetworkError, AIModelError, AIServiceError) as e:
        # Handle all our custom error types
        
        # Prepare detailed error information
        # Map internal category strings to public enum values
        _CATEGORY_MAP = {
            "token_limit_error": ErrorCategory.TOKEN_LIMIT,
            "service_error": ErrorCategory.INTERNAL_ERROR,
            "auth_error": ErrorCategory.AUTH_ERROR,
            "rate_limit_error": ErrorCategory.RATE_LIMIT,
            "network_error": ErrorCategory.NETWORK_ERROR,
            "model_error": ErrorCategory.AI_MODEL_ERROR,
            "parse_error": ErrorCategory.PARSE_ERROR,
            "webhook_error": ErrorCategory.WEBHOOK_ERROR,
            "unknown_error": ErrorCategory.UNKNOWN_ERROR,
        }
        category_value = _CATEGORY_MAP.get(getattr(e, "category", "unknown_error"), ErrorCategory.UNKNOWN_ERROR)

        error_detail = ErrorDetail(
            message=str(e),
            category=category_value,
            code=getattr(e, "code", None),
            context=getattr(e, "context", None),
            retryable=getattr(e, "retryable", False),
            suggestedAction=getattr(e, "suggested_action", None)
        )
        
        # Log the error with details
        logger.error(
            f"AI processing error: {error_detail.category}:{error_detail.code} - {error_detail.message}"
        )
        
        # Create webhook payload with detailed error information
        webhook_payload = WebhookPayload(
            jobId=job_id,
            status="failed",
            errorDetail=error_detail,
            # Also include simple error message for backward compatibility
            errorMessage=str(e)
        )
        
        # Send the error details to the frontend via webhook
        try:
            error_payload = {
                "jobId": job_id,
                "status": "failed",
                "errorDetail": error_detail.model_dump(mode="json"),
                "errorMessage": str(e)
            }
            await send_webhook_async(error_payload)
        except Exception as webhook_err:
            # Log webhook delivery failure, but don't re-raise as we want to preserve the original error
            logger.error(f"Failed to deliver error details via webhook: {webhook_err}")
        finally:
            # Mark job as completed even on failure to prevent locks
            deduplicator.mark_completed(job_id)
            
    except WebhookError as e:
        # Special handling for webhook errors when delivering successful results
        logger.error(f"Webhook delivery error: {e}")
        
        # Attempt to send a simplified error payload as a last resort
        try:
            simple_payload = WebhookPayload(
                jobId=job_id,
                status="failed",
                errorDetail=ErrorDetail(
                    message=f"Successfully generated cards but failed to deliver results: {str(e)}",
                    category=ErrorCategory.WEBHOOK_ERROR,
                    code=getattr(e, "code", "WEBHOOK_ERROR"),
                    retryable=getattr(e, "retryable", True),
                    suggestedAction="Please try again or contact support."
                ),
                errorMessage=f"Webhook delivery error: {str(e)}"
            )
            # Use a direct POST without our retry mechanism which already failed
            json_obj = simple_payload.model_dump(mode="json")
            raw = json.dumps(json_obj, separators=(",", ":"))
            headers = {"x-internal-api-key": settings.INTERNAL_API_KEY, "content-type": "application/json"}
            if settings.INTERNAL_WEBHOOK_HMAC_SECRET:
                ts = str(int(time.time() * 1000))
                mac = hmac.new(
                    settings.INTERNAL_WEBHOOK_HMAC_SECRET.encode("utf-8"),
                    f"{ts}.{raw}".encode("utf-8"),
                    hashlib.sha256,
                ).hexdigest()
                headers["x-webhook-timestamp"] = ts
                headers["x-webhook-signature"] = f"sha256={mac}"
            requests.post(
                settings.NEXTJS_APP_STATUS_WEBHOOK_URL,
                data=raw,
                headers=headers,
                timeout=5,
            )
        except Exception as fallback_err:
            logger.error(f"Failed to send fallback error notification: {fallback_err}")
        finally:
            # Mark job as completed even on webhook failure to prevent locks
            deduplicator.mark_completed(job_id)
            
    except Exception as e:
        # Catch-all for unexpected errors
        logger.error(f"Unexpected error processing card generation: {e}", exc_info=True)
        
        error_detail = ErrorDetail(
            message=f"An unexpected error occurred: {str(e)}",
            category=ErrorCategory.INTERNAL_ERROR,
            code="UNHANDLED_ERROR",
            context={"error_type": type(e).__name__},
            retryable=False,
            suggestedAction="Please try again or contact support if the issue persists."
        )
        
        # Send error notification
        try:
            error_payload = {
                "jobId": job_id,
                "status": "failed",
                "errorDetail": error_detail.model_dump(mode="json"),
                "errorMessage": f"An unexpected error occurred: {str(e)}"
            }
            await send_webhook_async(error_payload)
        except Exception as webhook_err:
            logger.error(f"Failed to deliver error notification: {webhook_err}")
        finally:
            # Mark job as completed even on unexpected error to prevent locks
            deduplicator.mark_completed(job_id)
        
        raise
