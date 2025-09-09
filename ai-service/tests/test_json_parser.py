"""
Tests for json_parser module.
"""
import pytest
from app.core.json_parser import parse_ai_response, normalize_cards


def test_parse_direct_json():
    """Test parsing direct JSON."""
    json_text = '[{"front": "Q1", "back": "A1"}, {"front": "Q2", "back": "A2"}]'
    cards = parse_ai_response(json_text, "qa")
    assert len(cards) == 2
    assert cards[0]["front"] == "Q1"
    assert cards[0]["back"] == "A1"


def test_parse_markdown_json():
    """Test parsing JSON from markdown code blocks."""
    text = 'Here are the cards:\n```json\n[{"front": "Q1", "back": "A1"}]\n```'
    cards = parse_ai_response(text, "qa")
    assert len(cards) == 1
    assert cards[0]["front"] == "Q1"


def test_parse_markdown_json_without_language():
    """Test parsing JSON from markdown code blocks without language specifier."""
    text = 'Here are the cards:\n```\n[{"front": "Q1", "back": "A1"}]\n```'
    cards = parse_ai_response(text, "qa")
    assert len(cards) == 1
    assert cards[0]["front"] == "Q1"


def test_normalize_cards_dict_with_cards():
    """Test normalizing cards from dict with 'cards' key."""
    data = {"cards": [{"front": "Q1", "back": "A1"}]}
    cards = normalize_cards(data, "qa")
    assert len(cards) == 1
    assert cards[0]["type"] == "qa"


def test_normalize_cards_single_dict():
    """Test normalizing single card dict."""
    data = {"front": "Q1", "back": "A1"}
    cards = normalize_cards(data, "qa")
    assert len(cards) == 1
    assert cards[0]["type"] == "qa"


def test_normalize_cards_list():
    """Test normalizing cards from list."""
    data = [{"front": "Q1", "back": "A1"}, {"front": "Q2", "back": "A2"}]
    cards = normalize_cards(data, "qa")
    assert len(cards) == 2


def test_normalize_missing_type():
    """Test that missing type is filled with card_type."""
    data = [{"front": "Q1", "back": "A1"}]
    cards = normalize_cards(data, "qa")
    assert cards[0]["type"] == "qa"


def test_normalize_question_answer_format():
    """Test normalizing question/answer format."""
    data = [{"question": "Q1", "answer": "A1"}]
    cards = normalize_cards(data, "qa")
    assert cards[0]["front"] == "Q1"
    assert cards[0]["back"] == "A1"


def test_normalize_skips_empty_cards():
    """Test that empty cards are skipped."""
    data = [
        {"front": "Q1", "back": "A1"},
        {"front": "", "back": "A2"},
        {"front": "Q3", "back": ""}
    ]
    cards = normalize_cards(data, "qa")
    assert len(cards) == 1
    assert cards[0]["front"] == "Q1"


def test_normalize_skips_non_dict():
    """Test that non-dict items are skipped."""
    data = [
        {"front": "Q1", "back": "A1"},
        "invalid item",
        {"front": "Q2", "back": "A2"}
    ]
    cards = normalize_cards(data, "qa")
    assert len(cards) == 2