import re
from typing import List, Dict, Any
from app.core.logic import ParseError
import logging

logger = logging.getLogger(__name__)

class CardCleaner:
    """Clean and validate flashcard content."""
    
    def __init__(self):
        self.min_length = 3
        self.max_length = 500
    
    def clean_and_validate_cards(self, cards: List[Dict[str, Any]], card_type: str) -> List[Dict[str, Any]]:
        """Clean and validate a list of cards."""
        cleaned_cards = []
        
        for i, card in enumerate(cards):
            try:
                cleaned_card = self._clean_single_card(card, card_type)
                if self._validate_card(cleaned_card, card_type):
                    cleaned_cards.append(cleaned_card)
                else:
                    logger.warning(f"Card {i+1} failed validation", extra={"card": card})
            except Exception as e:
                logger.warning(f"Failed to clean card {i+1}: {e}", extra={"card": card})
                continue
        
        return cleaned_cards
    
    def _clean_single_card(self, card: Dict[str, Any], card_type: str) -> Dict[str, Any]:
        """Clean a single card's content."""
        cleaned = {
            "type": card.get("type", card_type),
            "front": self._clean_text(card.get("front", "")),
            "back": self._clean_text(card.get("back", ""))
        }
        
        # Type-specific cleaning
        if card_type == "qa":
            cleaned["front"] = self._ensure_question_format(cleaned["front"])
        elif card_type == "cloze":
            cleaned = self._clean_cloze_card(cleaned)
        
        return cleaned
    
    def _clean_text(self, text: str) -> str:
        """Clean and normalize text content."""
        if not isinstance(text, str):
            text = str(text)
        
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text.strip())
        
        # Remove excessive punctuation
        text = re.sub(r'[.]{3,}', '...', text)
        text = re.sub(r'[!]{2,}', '!', text)
        text = re.sub(r'[?]{2,}', '?', text)
        
        # Clean up common AI artifacts
        text = re.sub(r'^(Answer:|Question:|Front:|Back:)\s*', '', text, flags=re.IGNORECASE)
        text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)  # Remove bold markdown
        text = re.sub(r'\*(.+?)\*', r'\1', text)  # Remove italic markdown
        
        return text.strip()
    
    def _ensure_question_format(self, front_text: str) -> str:
        """Ensure QA front text is in question format."""
        if not front_text:
            return front_text
        
        # If it doesn't end with question mark and seems like a question, add one
        if not front_text.endswith('?') and any(word in front_text.lower().split()[:3] 
                                               for word in ['what', 'who', 'when', 'where', 'why', 'how', 'which']):
            return front_text + '?'
        
        return front_text
    
    def _clean_cloze_card(self, card: Dict[str, Any]) -> Dict[str, Any]:
        """Clean cloze-deletion cards."""
        front = card["front"]
        back = card["back"]
        
        # Find cloze deletions in format [...]
        cloze_pattern = r'\[([^\]]+)\]'
        cloze_matches = re.findall(cloze_pattern, front)
        
        if not cloze_matches:
            # Try to create cloze from front/back relationship
            if back and back.lower() in front.lower():
                front = front.replace(back, f'[{back}]', 1)
                cloze_matches = [back]
        
        # Ensure exactly one cloze deletion
        if len(cloze_matches) > 1:
            # Keep only the first cloze
            for i, match in enumerate(cloze_matches[1:], 1):
                front = front.replace(f'[{match}]', match, 1)
        elif len(cloze_matches) == 0:
            # Invalid cloze card
            logger.warning("Cloze card has no deletion", extra={"front": front, "back": back})
        
        card["front"] = front
        card["back"] = cloze_matches[0] if cloze_matches else back
        
        return card
    
    def _validate_card(self, card: Dict[str, Any], card_type: str) -> bool:
        """Validate a cleaned card."""
        front = card.get("front", "")
        back = card.get("back", "")
        
        # Basic content validation
        if not front or not back:
            return False
        
        if len(front) < self.min_length or len(back) < self.min_length:
            return False
        
        if len(front) > self.max_length or len(back) > self.max_length:
            return False
        
        # Type-specific validation
        if card_type == "cloze":
            if '[' not in front or ']' not in front:
                return False
        
        # Avoid duplicate content
        if front.lower().strip() == back.lower().strip():
            return False
        
        return True

# Global cleaner instance
card_cleaner = CardCleaner()