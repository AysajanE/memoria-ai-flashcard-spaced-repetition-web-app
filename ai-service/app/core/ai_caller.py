import logging
import asyncio
from typing import Optional

import openai
from openai import AsyncOpenAI
# Updated imports for OpenAI v1.x
from openai import (
    APITimeoutError,
    RateLimitError,
    APIConnectionError,
    AuthenticationError,
    BadRequestError,
    APIError
)

from app.config import settings

logger = logging.getLogger(__name__)

class AIError(Exception):
    """Base exception for AI-related errors."""
    category = "unknown_error"
    retryable = False
    code = None
    context = None
    suggested_action = None
    
    def __init__(self, message, code=None, context=None, suggested_action=None):
        super().__init__(message)
        if code:
            self.code = code
        if context:
            self.context = context
        if suggested_action:
            self.suggested_action = suggested_action

class TokenLimitError(AIError):
    """Raised when input exceeds model's token limit."""
    category = "token_limit"
    retryable = False
    code = "TOKEN_EXCEEDED"
    suggested_action = "Reduce the input text length or split it into smaller chunks."

class AuthError(AIError):
    """Raised for authentication-related errors."""
    category = "auth_error"
    retryable = False
    code = "AUTH_FAILED"
    suggested_action = "Check AI service authentication credentials."

class RateLimitError(AIError):
    """Raised when AI service rate limits are hit."""
    category = "rate_limit"
    retryable = True
    code = "RATE_LIMIT_EXCEEDED"
    suggested_action = "Try again later or reduce the frequency of requests."

class NetworkError(AIError):
    """Raised for network/connectivity issues."""
    category = "network_error"
    retryable = True
    code = "NETWORK_FAILURE"
    suggested_action = "Check network connectivity and try again."

class AIModelError(AIError):
    """Raised for AI model-specific errors."""
    category = "ai_model_error"
    retryable = False
    code = "MODEL_ERROR"
    suggested_action = "Try with a different model or adjust generation parameters."

class ParseError(AIError):
    """Raised for errors parsing AI responses."""
    category = "parse_error"
    retryable = False
    code = "INVALID_RESPONSE"
    suggested_action = "Contact support if the issue persists."

class AIServiceError(AIError):
    """Raised for general AI service errors."""
    category = "internal_error"
    retryable = False
    code = "SERVICE_ERROR"
    suggested_action = "Try again or contact support if the issue persists."

# Initialize OpenAI client
try:
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
except Exception as e:
    logger.error(f"Failed to initialize OpenAI client: {str(e)}")
    raise AIServiceError(f"Failed to initialize AI client: {str(e)}")

async def generate_cards_with_ai(
    text: str,
    model_name: str,
    system_prompt: str,
    card_type: str = "qa",
    num_cards: int = 10,
    max_retries: int = 3,
    retry_delay: float = 1.0
) -> str:
    """
    Generate flashcards using OpenAI's API with retry logic and error handling.
    
    Args:
        text: The input text to generate cards from
        model_name: The name of the model to use
        system_prompt: The system prompt to guide card generation
        max_retries: Maximum number of retry attempts
        retry_delay: Delay between retries in seconds
        
    Returns:
        str: The raw response from the AI model
        
    Raises:
        TokenLimitError: If input exceeds model's token limit
        AIServiceError: For other AI service errors
    """
    try:
        # Adjust system prompt to include card type and count
        adjusted_prompt = system_prompt
        if "{card_type}" in system_prompt:
            adjusted_prompt = system_prompt.replace("{card_type}", card_type)
        if "{num_cards}" in system_prompt:
            adjusted_prompt = adjusted_prompt.replace("{num_cards}", str(num_cards))
            
        # Prepare messages
        messages = [
            {"role": "system", "content": adjusted_prompt},
            {"role": "user", "content": text}
        ]
        
        # Attempt API call with retries
        for attempt in range(max_retries):
            try:
                response = await client.chat.completions.create(
                    model=model_name,
                    messages=messages,
                    temperature=0.7,
                    max_tokens=2000  # Adjust based on model's context window
                )
                return response.choices[0].message.content
                
            except BadRequestError as e:
                error_msg = str(e).lower()
                context = {"original_error": str(e)}
                
                if "maximum context length" in error_msg:
                    raise TokenLimitError(
                        f"Input exceeds model's token limit: {str(e)}",
                        context=context
                    )
                elif "content filter" in error_msg:
                    raise AIModelError(
                        "Content was flagged by AI provider's content filter",
                        code="CONTENT_FILTERED",
                        context=context,
                        suggested_action="Modify your content to comply with AI provider policies"
                    )
                else:
                    raise AIModelError(
                        f"Invalid request to AI service: {str(e)}",
                        code="INVALID_REQUEST",
                        context=context
                    )
                
            except AuthenticationError as e:
                logger.error(f"Authentication error with OpenAI API: {str(e)}")
                raise AuthError(
                    "Failed to authenticate with AI service",
                    context={"original_error": str(e)}
                )
                
            except RateLimitError as e:
                if attempt < max_retries - 1:
                    logger.warning(f"Rate limit hit, retrying in {retry_delay}s...")
                    await asyncio.sleep(retry_delay)
                    continue
                
                raise RateLimitError(
                    f"Rate limit exceeded after {max_retries} attempts",
                    context={"original_error": str(e), "attempts": max_retries}
                )
                
            except APITimeoutError as e:
                if attempt < max_retries - 1:
                    logger.warning(f"API timeout, retrying in {retry_delay}s...")
                    await asyncio.sleep(retry_delay)
                    continue
                
                raise NetworkError(
                    f"API timeout after {max_retries} attempts",
                    code="TIMEOUT",
                    context={"original_error": str(e), "attempts": max_retries}
                )
                
            except APIConnectionError as e:
                if attempt < max_retries - 1:
                    logger.warning(f"API connection error, retrying in {retry_delay}s...")
                    await asyncio.sleep(retry_delay)
                    continue
                
                raise NetworkError(
                    f"API connection error after {max_retries} attempts",
                    context={"original_error": str(e), "attempts": max_retries}
                )
                
            except APIError as e:
                logger.error(f"Unexpected OpenAI API error: {str(e)}")
                raise AIServiceError(
                    f"Unexpected AI service error: {str(e)}",
                    context={"original_error": str(e)}
                )
                
    except Exception as e:
        if isinstance(e, AIError):
            # Already one of our classified errors, just re-raise
            raise
            
        # Unclassified error, wrap it in a generic AIServiceError
        logger.error(f"Unexpected error in generate_cards_with_ai: {str(e)}")
        raise AIServiceError(
            f"Unexpected error: {str(e)}",
            code="UNHANDLED_ERROR",
            context={"original_error": str(e), "error_type": type(e).__name__}
        ) 