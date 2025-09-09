from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.dependencies import validate_internal_api_key
from app.core.ai_caller import generate_cards_with_ai
from app.core.text_processing import count_tokens, chunk_text
from app.core.json_parser import parse_ai_response
from app.core.card_cleaner import card_cleaner
from app.core.cost_calculator import cost_calculator
from app.core.logic import ParseError
from app.config import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/preview",
    tags=["preview"],
    dependencies=[Depends(validate_internal_api_key)]
)

class PreviewRequest(BaseModel):
    text: str
    model: str = "gpt-4o-mini"
    cardType: str = "qa"
    numCards: int = 3

class TokenizeRequest(BaseModel):
    text: str
    max_chunk_tokens: int = 2000

@router.post("/cards")
async def preview_cards(request: PreviewRequest):
    """Generate a small preview of cards without webhook."""
    
    try:
        if len(request.text) > 5000:  # Limit preview text length
            raise HTTPException(status_code=400, detail="Preview text too long (max 5000 characters)")
        
        if request.numCards > 5:  # Limit preview card count
            raise HTTPException(status_code=400, detail="Preview limited to 5 cards maximum")
        
        # Generate cards
        result, usage = await generate_cards_with_ai(
            text=request.text,
            model_name=request.model,
            system_prompt=settings.DEFAULT_SYSTEM_PROMPT,
            card_type=request.cardType,
            num_cards=request.numCards
        )
        
        # Parse and clean
        raw_cards = parse_ai_response(result, request.cardType)
        cards = card_cleaner.clean_and_validate_cards(raw_cards, request.cardType)
        
        # Calculate cost
        cost_usd = cost_calculator.calculate_cost(request.model, usage)
        
        return {
            "success": True,
            "cards": cards,
            "metadata": {
                "model": request.model,
                "tokensUsed": usage["total_tokens"],
                "costUSD": cost_usd,
                "cardType": request.cardType
            }
        }
        
    except ParseError as e:
        logger.error(f"Preview parsing failed: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to parse AI response: {str(e)}")
    except Exception as e:
        logger.error(f"Preview generation failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/tokenize")
async def tokenize_text(request: TokenizeRequest):
    """Get token count and chunk preview for text."""
    
    try:
        token_count = count_tokens(request.text)
        
        # Generate chunk preview if needed
        chunks_info = []
        if token_count > request.max_chunk_tokens:
            chunks = chunk_text(request.text, max_tokens=request.max_chunk_tokens)
            
            for i, chunk in enumerate(chunks):
                chunks_info.append({
                    "chunk_index": i + 1,
                    "token_count": count_tokens(chunk),
                    "character_count": len(chunk),
                    "preview": chunk[:200] + "..." if len(chunk) > 200 else chunk
                })
        
        return {
            "success": True,
            "total_tokens": token_count,
            "character_count": len(request.text),
            "needs_chunking": token_count > request.max_chunk_tokens,
            "chunk_threshold": request.max_chunk_tokens,
            "chunks": chunks_info,
            "estimated_chunks": len(chunks_info) if chunks_info else 1
        }
        
    except Exception as e:
        logger.error(f"Tokenization failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))