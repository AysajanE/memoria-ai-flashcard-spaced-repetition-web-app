from functools import lru_cache
from openai import AsyncOpenAI
from anthropic import AsyncAnthropic
from app.core.errors import AuthError, SystemError
from app.config import settings
import logging

logger = logging.getLogger(__name__)

@lru_cache(maxsize=1)
def get_openai_client() -> AsyncOpenAI:
    """Get cached OpenAI client with timeout configuration."""
    if not settings.OPENAI_API_KEY:
        raise AuthError("OPENAI_API_KEY not configured")
    
    client = AsyncOpenAI(
        api_key=settings.OPENAI_API_KEY,
        timeout=20.0,
        max_retries=2
    )
    
    logger.info("OpenAI client initialized")
    return client

@lru_cache(maxsize=1)
def get_anthropic_client() -> AsyncAnthropic:
    """Get cached Anthropic client with timeout configuration."""
    if not settings.ANTHROPIC_API_KEY:
        raise AuthError("ANTHROPIC_API_KEY not configured")
    
    client = AsyncAnthropic(
        api_key=settings.ANTHROPIC_API_KEY,
        timeout=20.0,
        max_retries=2
    )
    
    logger.info("Anthropic client initialized")
    return client

def validate_clients():
    """Validate that required clients can be initialized."""
    errors = []
    
    try:
        if settings.OPENAI_API_KEY:
            get_openai_client()
    except Exception as e:
        errors.append(f"OpenAI client validation failed: {e}")
    
    try:
        if settings.ANTHROPIC_API_KEY:
            get_anthropic_client()
    except Exception as e:
        errors.append(f"Anthropic client validation failed: {e}")
    
    if errors:
        raise SystemError(f"Client validation errors: {'; '.join(errors)}")