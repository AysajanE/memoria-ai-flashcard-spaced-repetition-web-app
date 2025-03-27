from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime

class Card(BaseModel):
    front: str = Field(..., min_length=1, max_length=1000)
    back: str = Field(..., min_length=1, max_length=1000)
    type: Literal["qa", "cloze"] = "qa"

class GenerateCardsResponse(BaseModel):
    """Response schema for the /generate-cards endpoint"""
    jobId: str = Field(..., description="Unique identifier for the processing job")
    status: Literal["accepted"] = "accepted"
    message: str = "Card generation job accepted"

class WebhookPayload(BaseModel):
    """Schema for the webhook payload sent to Next.js"""
    jobId: str = Field(..., description="Unique identifier for the processing job")
    status: Literal["completed", "failed"] = Field(..., description="Final status of the job")
    resultPayload: Optional[dict] = Field(None, description="Generated cards or other results")
    errorMessage: Optional[str] = Field(None, description="Error message if status is failed")
    completedAt: datetime = Field(default_factory=datetime.utcnow)

class GenerateCardsResult(BaseModel):
    """Schema for the result payload in completed jobs"""
    cards: List[Card] = Field(..., min_items=1, max_items=100)
    model: str = Field(..., description="AI model used for generation")
    processingTime: float = Field(..., description="Processing time in seconds")
    tokenCount: int = Field(..., description="Total tokens used") 