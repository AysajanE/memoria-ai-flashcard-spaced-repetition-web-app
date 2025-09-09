from pydantic import BaseModel, Field
from typing import Dict, Optional

class GenerateCardsRequest(BaseModel):
    """Request schema for card generation endpoint."""
    jobId: str
    text: str
    model: Optional[str] = Field(None, description="AI model to use for generation")
    cardType: Optional[str] = Field("qa", description="Type of flashcards to generate (qa or cloze)")
    numCards: Optional[int] = Field(10, description="Number of cards to generate")
    config: Optional[Dict] = Field(default_factory=dict, description="Additional configuration options") 