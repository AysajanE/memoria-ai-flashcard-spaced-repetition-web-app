import json
import re
from typing import Dict, Any, List
from app.core.errors import ProcessingError
import logging

logger = logging.getLogger(__name__)

def parse_ai_response(response_text: str, card_type: str = "qa") -> List[Dict[str, Any]]:
    """Parse AI response with robust JSON extraction."""
    
    # Try direct JSON parsing first
    try:
        data = json.loads(response_text.strip())
        return normalize_cards(data, card_type)
    except json.JSONDecodeError:
        pass
    
    # Try extracting JSON from markdown code blocks
    json_blocks = re.findall(r'```(?:json)?\n(.*?)\n```', response_text, re.DOTALL)
    for block in json_blocks:
        try:
            data = json.loads(block.strip())
            return normalize_cards(data, card_type)
        except json.JSONDecodeError:
            continue
    
    # Try finding JSON-like content
    json_pattern = r'\[[\s\S]*?\]|\{[\s\S]*?\}'
    matches = re.findall(json_pattern, response_text)
    for match in matches:
        try:
            data = json.loads(match)
            return normalize_cards(data, card_type)
        except json.JSONDecodeError:
            continue
    
    # Last resort: try to clean and parse
    cleaned_text = clean_response_text(response_text)
    try:
        data = json.loads(cleaned_text)
        return normalize_cards(data, card_type)
    except json.JSONDecodeError:
        pass
    
    logger.error("Failed to parse AI response", extra={
        "response_preview": response_text[:200],
        "response_length": len(response_text)
    })
    raise ProcessingError("Failed to parse AI response as JSON")

def normalize_cards(data: Any, card_type: str) -> List[Dict[str, Any]]:
    """Normalize card data structure."""
    
    if isinstance(data, dict):
        if "cards" in data:
            cards = data["cards"]
        else:
            cards = [data]
    elif isinstance(data, list):
        cards = data
    else:
        raise ProcessingError("Invalid card data structure")
    
    normalized_cards = []
    for card in cards:
        if not isinstance(card, dict):
            continue
        
        # Ensure card has required fields
        normalized_card = {
            "type": card.get("type", card_type),
            "front": card.get("front", card.get("question", "")),
            "back": card.get("back", card.get("answer", ""))
        }
        
        # Skip empty cards
        if normalized_card["front"] and normalized_card["back"]:
            normalized_cards.append(normalized_card)
    
    return normalized_cards

def clean_response_text(text: str) -> str:
    """Clean response text for JSON parsing."""
    
    # Remove common prefixes/suffixes
    text = re.sub(r'^.*?(\[|\{)', r'\1', text, flags=re.DOTALL)
    text = re.sub(r'(\]|\}).*?$', r'\1', text, flags=re.DOTALL)
    
    # Fix common JSON issues
    text = re.sub(r',\s*}', '}', text)  # Remove trailing commas
    text = re.sub(r',\s*]', ']', text)  # Remove trailing commas in arrays
    
    return text.strip()