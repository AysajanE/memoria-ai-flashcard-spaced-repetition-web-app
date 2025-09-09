from enum import Enum
from typing import Optional


class ErrorCategory(str, Enum):
    AUTHENTICATION = "authentication"
    RATE_LIMIT = "rate_limit"
    VALIDATION = "validation"
    AI_SERVICE = "ai_service"
    NETWORK = "network"
    PROCESSING = "processing"
    SYSTEM = "system"


class BaseAIServiceError(Exception):
    """Base exception for AI service errors."""

    def __init__(
        self,
        message: str,
        category: ErrorCategory,
        suggested_action: Optional[str] = None,
        retry_after: Optional[int] = None
    ):
        super().__init__(message)
        self.message = message
        self.category = category
        self.suggested_action = suggested_action
        self.retry_after = retry_after


class AuthError(BaseAIServiceError):
    """Authentication/authorization errors."""
    def __init__(self, message: str, suggested_action: str = "Check API keys"):
        super().__init__(message, ErrorCategory.AUTHENTICATION, suggested_action)


class RateLimitError(BaseAIServiceError):
    """Rate limiting errors."""
    def __init__(self, message: str, retry_after: int = 60):
        super().__init__(
            message,
            ErrorCategory.RATE_LIMIT,
            f"Wait {retry_after} seconds before retrying",
            retry_after
        )


class ValidationError(BaseAIServiceError):
    """Input validation errors."""
    def __init__(self, message: str):
        super().__init__(
            message,
            ErrorCategory.VALIDATION,
            "Check input parameters"
        )


class AIServiceError(BaseAIServiceError):
    """AI provider service errors."""
    def __init__(self, message: str, retry_after: Optional[int] = None):
        super().__init__(
            message,
            ErrorCategory.AI_SERVICE,
            "Try again later or contact support",
            retry_after
        )


class NetworkError(BaseAIServiceError):
    """Network/connectivity errors."""
    def __init__(self, message: str):
        super().__init__(
            message,
            ErrorCategory.NETWORK,
            "Check internet connection and try again"
        )


class ProcessingError(BaseAIServiceError):
    """Internal processing errors."""
    def __init__(self, message: str):
        super().__init__(
            message,
            ErrorCategory.PROCESSING,
            "Contact support if this persists"
        )


class SystemError(BaseAIServiceError):
    """System-level errors."""
    def __init__(self, message: str):
        super().__init__(
            message,
            ErrorCategory.SYSTEM,
            "Contact support"
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
