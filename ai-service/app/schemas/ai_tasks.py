from pydantic import BaseModel
from typing import Dict, Optional

class GenerateCardsRequest(BaseModel):
    """Request schema for card generation endpoint."""
    jobId: str
    text: str
    config: Optional[Dict] = None 