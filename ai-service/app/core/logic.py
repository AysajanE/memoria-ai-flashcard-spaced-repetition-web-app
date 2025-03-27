import json
import logging
from typing import Dict, List

from app.config import settings
from app.core.ai_caller import generate_cards_with_ai

logger = logging.getLogger(__name__)

CARD_GENERATION_SYSTEM_PROMPT = """You are an expert study assistant. Your task is to generate high-quality flashcards from the provided text. Create a mix of Question/Answer (QA) and Cloze Deletion (Fill-in-the-blank) cards.

Output Format Rules:
1. Return ONLY a valid JSON list (array) of flashcard objects.
2. Each object must have a "front" key (the question or cloze statement) and a "back" key (the answer).
3. For QA cards, add a "type": "qa" key-value pair.
4. For Cloze cards, add a "type": "cloze" key-value pair. Use the format "{{c1::word to hide}}" for cloze deletions in the "front" field. The "back" field should contain the full sentence or context, possibly highlighting the hidden word.
5. Generate a reasonable number of cards covering the key concepts in the text.
6. Ensure questions are clear and answers are concise and accurate based *only* on the provided text.

Example QA: {"front": "What is the primary function of the mitochondria?", "back": "To generate most of the cell's supply of adenosine triphosphate (ATP), used as a source of chemical energy.", "type": "qa"}
Example Cloze: {"front": "The Treaty of Versailles officially ended {{c1::World War I}}.", "back": "The Treaty of Versailles officially ended World War I.", "type": "cloze"}

Generate the JSON list now based on the user's text."""

async def generate_flashcards_from_text(text: str) -> Dict[str, List[Dict[str, str]]]:
    """
    Generate flashcards from input text using AI.
    
    Args:
        text: The input text to generate flashcards from
        
    Returns:
        Dict[str, List[Dict[str, str]]]: Dictionary containing list of flashcards
        with keys "front", "back", and "type"
        
    Raises:
        ValueError: If text is empty or invalid
        json.JSONDecodeError: If AI response is not valid JSON
        Exception: For other errors during generation
    """
    if not text or len(text.strip()) == 0:
        raise ValueError("Input text cannot be empty")
        
    try:
        # Generate cards using AI
        raw_response = await generate_cards_with_ai(
            text=text,
            model_name=settings.OPENAI_MODEL_NAME,
            system_prompt=CARD_GENERATION_SYSTEM_PROMPT
        )
        
        # Parse the JSON response
        try:
            cards = json.loads(raw_response)
            if not isinstance(cards, list):
                raise ValueError("AI response must be a JSON array")
                
            # Validate each card has required fields
            for card in cards:
                if not all(key in card for key in ["front", "back", "type"]):
                    raise ValueError("Each card must have 'front', 'back', and 'type' fields")
                if card["type"] not in ["qa", "cloze"]:
                    raise ValueError("Card type must be either 'qa' or 'cloze'")
                    
            return {"cards": cards}
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response as JSON: {str(e)}")
            raise ValueError("AI response was not valid JSON")
            
    except Exception as e:
        logger.error(f"Error generating flashcards: {str(e)}")
        raise 