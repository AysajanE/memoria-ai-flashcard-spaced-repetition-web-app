from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from app.core.errors import ErrorCategory


class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    category: ErrorCategory
    suggested_action: Optional[str] = None
    retry_after: Optional[int] = None


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
    jobId: str
    status: str  # "completed", "failed", "in_progress"
    
    # Success fields
    cards: Optional[List[dict]] = None
    
    # Error fields
    error: Optional[str] = None
    category: Optional[ErrorCategory] = None
    suggested_action: Optional[str] = None
    retry_after: Optional[int] = None


class GenerateCardsResult(BaseModel):
    """Schema for the result payload in completed jobs"""
    cards: List[Card] = Field(..., min_length=1, max_length=100)
    model: str = Field(..., description="AI model used for generation")
    processingTime: float = Field(..., description="Processing time in seconds")
    tokenCount: int = Field(..., description="Total tokens used")