import logging
from typing import Optional

import openai
from openai import (
    APITimeoutError,
    RateLimitError,
    APIConnectionError,
    AuthenticationError,
    InvalidRequestError,
    APIError
)

from app.config import settings

logger = logging.getLogger(__name__)

class AIError(Exception):
    """Base exception for AI-related errors."""
    pass

class TokenLimitError(AIError):
    """Raised when input exceeds model's token limit."""
    pass

class AIServiceError(AIError):
    """Raised for general AI service errors."""
    pass

# Initialize OpenAI client
try:
    client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
except Exception as e:
    logger.error(f"Failed to initialize OpenAI client: {str(e)}")
    raise

async def generate_cards_with_ai(
    text: str,
    model_name: str,
    system_prompt: str,
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
        # Prepare messages
        messages = [
            {"role": "system", "content": system_prompt},
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
                
            except InvalidRequestError as e:
                if "maximum context length" in str(e).lower():
                    raise TokenLimitError(f"Input exceeds model's token limit: {str(e)}")
                raise AIServiceError(f"Invalid request to AI service: {str(e)}")
                
            except AuthenticationError as e:
                logger.error(f"Authentication error with OpenAI API: {str(e)}")
                raise AIServiceError("Failed to authenticate with AI service")
                
            except RateLimitError as e:
                if attempt < max_retries - 1:
                    logger.warning(f"Rate limit hit, retrying in {retry_delay}s...")
                    await asyncio.sleep(retry_delay)
                    continue
                raise AIServiceError(f"Rate limit exceeded after {max_retries} attempts")
                
            except APITimeoutError as e:
                if attempt < max_retries - 1:
                    logger.warning(f"API timeout, retrying in {retry_delay}s...")
                    await asyncio.sleep(retry_delay)
                    continue
                raise AIServiceError(f"API timeout after {max_retries} attempts")
                
            except APIConnectionError as e:
                if attempt < max_retries - 1:
                    logger.warning(f"API connection error, retrying in {retry_delay}s...")
                    await asyncio.sleep(retry_delay)
                    continue
                raise AIServiceError(f"API connection error after {max_retries} attempts")
                
            except APIError as e:
                logger.error(f"Unexpected OpenAI API error: {str(e)}")
                raise AIServiceError(f"Unexpected AI service error: {str(e)}")
                
    except Exception as e:
        if not isinstance(e, (TokenLimitError, AIServiceError)):
            logger.error(f"Unexpected error in generate_cards_with_ai: {str(e)}")
            raise AIServiceError(f"Unexpected error: {str(e)}")
        raise 