"""Test error taxonomy and handling."""
import os
import pytest
from fastapi import HTTPException

# Set test environment variables before importing app
os.environ.setdefault("INTERNAL_API_KEY", "test-key")
os.environ.setdefault("NEXTJS_APP_STATUS_WEBHOOK_URL", "http://localhost:3000/api/webhooks/ai-status")
os.environ.setdefault("ENVIRONMENT", "test")

from app.core.errors import (
    BaseAIServiceError, ErrorCategory, AuthError, RateLimitError, 
    ValidationError, AIServiceError, NetworkError, ProcessingError, SystemError
)
from app.core.error_handler import handle_error, map_provider_error
from app.schemas.responses import ErrorResponse


def test_base_error_categories():
    """Test that all error types have correct categories."""
    assert AuthError("test").category == ErrorCategory.AUTHENTICATION
    assert RateLimitError("test").category == ErrorCategory.RATE_LIMIT
    assert ValidationError("test").category == ErrorCategory.VALIDATION
    assert AIServiceError("test").category == ErrorCategory.AI_SERVICE
    assert NetworkError("test").category == ErrorCategory.NETWORK
    assert ProcessingError("test").category == ErrorCategory.PROCESSING
    assert SystemError("test").category == ErrorCategory.SYSTEM


def test_error_suggested_actions():
    """Test that error types have suggested actions."""
    assert AuthError("test").suggested_action == "Check API keys"
    assert ValidationError("test").suggested_action == "Check input parameters"
    assert RateLimitError("test").suggested_action == "Wait 60 seconds before retrying"
    assert AIServiceError("test").suggested_action == "Try again later or contact support"


def test_rate_limit_error_retry_after():
    """Test rate limit error includes retry_after."""
    error = RateLimitError("test", retry_after=120)
    assert error.retry_after == 120
    assert "120 seconds" in error.suggested_action


def test_handle_error_with_base_error():
    """Test error handler with BaseAIServiceError."""
    base_error = ValidationError("Invalid input")
    result = handle_error(base_error, "job123")
    
    assert isinstance(result, ErrorResponse)
    assert result.success == False
    assert result.error == "Invalid input"
    assert result.category == ErrorCategory.VALIDATION
    assert result.suggested_action == "Check input parameters"


def test_handle_error_with_http_exception():
    """Test error handler with HTTPException."""
    http_error = HTTPException(status_code=400, detail="Bad request")
    result = handle_error(http_error)
    
    assert isinstance(result, ErrorResponse)
    assert result.error == "Bad request"
    assert result.category == ErrorCategory.VALIDATION


def test_handle_error_with_unknown_exception():
    """Test error handler with unknown exception."""
    unknown_error = ValueError("Something went wrong")
    result = handle_error(unknown_error)
    
    assert isinstance(result, ErrorResponse)
    assert result.error == "An unexpected error occurred"
    assert result.category == ErrorCategory.SYSTEM
    assert result.suggested_action == "Contact support if this persists"


def test_map_provider_error_rate_limit():
    """Test mapping provider rate limit errors."""
    error = Exception("Rate limit exceeded")
    result = map_provider_error(error, "OpenAI")
    
    assert isinstance(result, RateLimitError)
    assert "OpenAI rate limit exceeded" in result.message


def test_map_provider_error_auth():
    """Test mapping provider auth errors."""
    error = Exception("Invalid API key provided")
    result = map_provider_error(error, "OpenAI")
    
    assert isinstance(result, AuthError)
    assert "Invalid OpenAI API key" in result.message


def test_map_provider_error_network():
    """Test mapping provider network errors."""
    error = Exception("Connection timeout")
    result = map_provider_error(error, "Anthropic")
    
    assert isinstance(result, NetworkError)
    assert "Anthropic network error" in result.message


def test_map_provider_error_default():
    """Test mapping provider default error."""
    error = Exception("Unknown service error")
    result = map_provider_error(error, "OpenAI")
    
    assert isinstance(result, AIServiceError)
    assert "OpenAI service error" in result.message