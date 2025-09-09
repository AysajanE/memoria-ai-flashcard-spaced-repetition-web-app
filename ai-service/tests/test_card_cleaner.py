"""
Tests for card_cleaner module.
"""
import pytest
from app.core.card_cleaner import CardCleaner


@pytest.fixture
def cleaner():
    return CardCleaner()


def test_clean_qa_card(cleaner):
    """Test QA card cleaning."""
    card = {"front": "What is Python", "back": "A programming language"}
    cleaned = cleaner._clean_single_card(card, "qa")
    assert cleaned["front"] == "What is Python?"
    assert cleaned["back"] == "A programming language"


def test_clean_cloze_card(cleaner):
    """Test cloze card cleaning."""
    card = {"front": "Python is a [programming language]", "back": "programming language"}
    cleaned = cleaner._clean_single_card(card, "cloze")
    assert "[programming language]" in cleaned["front"]
    assert cleaned["back"] == "programming language"


def test_validate_card_min_length(cleaner):
    """Test card validation with minimum length."""
    card = {"front": "A", "back": "B"}
    assert not cleaner._validate_card(card, "qa")


def test_validate_card_success(cleaner):
    """Test successful card validation."""
    card = {"front": "What is AI?", "back": "Artificial Intelligence"}
    assert cleaner._validate_card(card, "qa")


def test_clean_text_removes_markdown(cleaner):
    """Test that markdown formatting is removed."""
    text = "**Bold text** and *italic text*"
    cleaned = cleaner._clean_text(text)
    assert cleaned == "Bold text and italic text"


def test_clean_text_removes_prefixes(cleaner):
    """Test that common prefixes are removed."""
    text = "Answer: This is the answer"
    cleaned = cleaner._clean_text(text)
    assert cleaned == "This is the answer"


def test_ensure_question_format(cleaner):
    """Test question format enforcement."""
    text = "What is Python"
    result = cleaner._ensure_question_format(text)
    assert result == "What is Python?"
    
    # Already has question mark
    text_with_q = "What is Python?"
    result_q = cleaner._ensure_question_format(text_with_q)
    assert result_q == "What is Python?"


def test_clean_and_validate_cards(cleaner):
    """Test the complete cleaning and validation process."""
    cards = [
        {"front": "What is Python", "back": "A programming language"},
        {"front": "A", "back": "B"},  # Too short, should be filtered
        {"front": "Question: What is Java?", "back": "Answer: A programming language"},
    ]
    
    cleaned = cleaner.clean_and_validate_cards(cards, "qa")
    
    # Should have 2 cards (one filtered for being too short)
    assert len(cleaned) == 2
    assert cleaned[0]["front"] == "What is Python?"
    assert cleaned[1]["front"] == "What is Java?"
    assert cleaned[1]["back"] == "A programming language"


def test_cloze_card_validation(cleaner):
    """Test cloze card specific validation."""
    valid_cloze = {"front": "Python is a [programming language]", "back": "programming language"}
    invalid_cloze = {"front": "Python is a programming language", "back": "programming language"}
    
    assert cleaner._validate_card(valid_cloze, "cloze")
    assert not cleaner._validate_card(invalid_cloze, "cloze")