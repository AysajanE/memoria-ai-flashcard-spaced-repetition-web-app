from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from enum import Enum


class ErrorCategory(str, Enum):
    """Detailed error categories for better client handling."""
    INVALID_INPUT = "invalid_input"      # Input validation errors (format, size, etc.)
    TOKEN_LIMIT = "token_limit"          # Token limit errors
    AUTH_ERROR = "auth_error"            # Authentication/authorization errors
    RATE_LIMIT = "rate_limit"            # Rate limiting errors
    AI_MODEL_ERROR = "ai_model_error"    # Errors from AI model/provider
    PARSE_ERROR = "parse_error"          # Errors parsing AI responses
    NETWORK_ERROR = "network_error"      # Network/connectivity errors
    WEBHOOK_ERROR = "webhook_error"      # Webhook delivery errors
    INTERNAL_ERROR = "internal_error"    # Internal system errors
    UNKNOWN_ERROR = "unknown_error"      # Unclassified errors


class Card(BaseModel):
    front: str = Field(..., min_length=1, max_length=1000)
    back: str = Field(..., min_length=1, max_length=1000)
    type: Literal["qa", "cloze"] = "qa"


class GenerateCardsResponse(BaseModel):
    """Response schema for the /generate-cards endpoint"""
    jobId: str = Field(..., description="Unique identifier for the processing job")
    status: Literal["accepted"] = "accepted"
    message: str = "Card generation job accepted"


class ErrorDetail(BaseModel):
    """Detailed error information for better client handling."""
    message: str = Field(..., description="Human-readable error message")
    category: ErrorCategory = Field(..., description="Error category for client handling")
    code: Optional[str] = Field(None, description="Specific error code if available")
    context: Optional[Dict[str, Any]] = Field(None, description="Additional error context")
    retryable: bool = Field(False, description="Whether the error is potentially retryable")
    suggestedAction: Optional[str] = Field(None, description="Suggested action to resolve the error")


class WebhookPayload(BaseModel):
    """Schema for the webhook payload sent to Next.js"""
    model_config = ConfigDict(json_encoders={datetime: lambda dt: dt.isoformat()})
    
    jobId: str = Field(..., description="Unique identifier for the processing job")
    status: Literal["completed", "failed"] = Field(..., description="Final status of the job")
    resultPayload: Optional[dict] = Field(None, description="Generated cards or other results")
    errorDetail: Optional[ErrorDetail] = Field(None, description="Detailed error information if status is failed")
    errorMessage: Optional[str] = Field(None, description="Simple error message if status is failed (for backward compatibility)")
    completedAt: datetime = Field(default_factory=datetime.utcnow)
    
    def model_dump(self, **kwargs):
        """Override model_dump to ensure datetime is properly serialized"""
        if 'mode' not in kwargs:
            kwargs['mode'] = 'json'
        return super().model_dump(**kwargs)


class GenerateCardsResult(BaseModel):
    """Schema for the result payload in completed jobs"""
    cards: List[Card] = Field(..., min_items=1, max_items=100)
    model: str = Field(..., description="AI model used for generation")
    processingTime: float = Field(..., description="Processing time in seconds")
    tokenCount: int = Field(..., description="Total tokens used")