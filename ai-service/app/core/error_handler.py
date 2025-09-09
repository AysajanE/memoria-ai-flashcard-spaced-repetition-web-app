import logging
from typing import Optional
from fastapi import HTTPException
from app.core.errors import BaseAIServiceError, ErrorCategory, SystemError
from app.core.errors import AuthError, RateLimitError, ValidationError, AIServiceError, NetworkError
from app.schemas.responses import ErrorResponse

logger = logging.getLogger(__name__)


def handle_error(error: Exception, job_id: Optional[str] = None) -> ErrorResponse:
    """Convert any exception to standardized error response."""

    # Log the error with context
    extra = {"jobId": job_id} if job_id else {}
    logger.error(f"Error processing request: {str(error)}",
                extra=extra, exc_info=True)

    if isinstance(error, BaseAIServiceError):
        return ErrorResponse(
            error=error.message,
            category=error.category,
            suggested_action=error.suggested_action,
            retry_after=error.retry_after
        )

    # Map common exceptions to categories
    if isinstance(error, HTTPException):
        category = ErrorCategory.NETWORK if error.status_code >= 500 else ErrorCategory.VALIDATION
        return ErrorResponse(
            error=str(error.detail),
            category=category,
            suggested_action="Check request parameters" if category == ErrorCategory.VALIDATION else "Try again later"
        )

    # Default system error
    return ErrorResponse(
        error="An unexpected error occurred",
        category=ErrorCategory.SYSTEM,
        suggested_action="Contact support if this persists"
    )


def map_provider_error(error: Exception, provider: str) -> BaseAIServiceError:
    """Map provider-specific errors to our error taxonomy."""

    error_str = str(error).lower()

    # Rate limiting
    if "rate limit" in error_str or "quota" in error_str:
        return RateLimitError(f"{provider} rate limit exceeded")

    # Authentication
    if "api key" in error_str or "unauthorized" in error_str:
        return AuthError(f"Invalid {provider} API key")

    # Network issues
    if any(term in error_str for term in ["timeout", "connection", "network"]):
        return NetworkError(f"{provider} network error: {str(error)}")

    # Default to AI service error
    return AIServiceError(f"{provider} service error: {str(error)}")