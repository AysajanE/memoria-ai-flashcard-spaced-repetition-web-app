import pytest
from app.core.json_parser import parse_ai_response, normalize_cards, clean_response_text
from app.core.errors import ProcessingError

def test_parse_direct_json():
    json_text = '[{"front": "Q1", "back": "A1"}, {"front": "Q2", "back": "A2"}]'
    cards = parse_ai_response(json_text, "qa")
    assert len(cards) == 2
    assert cards[0]["front"] == "Q1"
    assert cards[0]["back"] == "A1"
    assert cards[1]["front"] == "Q2"
    assert cards[1]["back"] == "A2"

def test_parse_object_with_cards_key():
    json_text = '{"cards": [{"front": "Q1", "back": "A1"}]}'
    cards = parse_ai_response(json_text, "qa")
    assert len(cards) == 1
    assert cards[0]["front"] == "Q1"

def test_parse_markdown_json():
    text = "Here are the cards:\n```json\n[{\"front\": \"Q1\", \"back\": \"A1\"}]\n```"
    cards = parse_ai_response(text, "qa")
    assert len(cards) == 1
    assert cards[0]["front"] == "Q1"

def test_parse_markdown_json_without_language():
    text = "Here are the cards:\n```\n[{\"front\": \"Q1\", \"back\": \"A1\"}]\n```"
    cards = parse_ai_response(text, "qa")
    assert len(cards) == 1
    assert cards[0]["front"] == "Q1"

def test_normalize_missing_type():
    data = [{"front": "Q1", "back": "A1"}]
    cards = normalize_cards(data, "qa")
    assert cards[0]["type"] == "qa"

def test_normalize_question_answer_format():
    data = [{"question": "Q1", "answer": "A1"}]
    cards = normalize_cards(data, "qa")
    assert cards[0]["front"] == "Q1"
    assert cards[0]["back"] == "A1"

def test_normalize_skips_empty_cards():
    data = [
        {"front": "Q1", "back": "A1"},
        {"front": "", "back": "A2"},
        {"front": "Q3", "back": ""}
    ]
    cards = normalize_cards(data, "qa")
    assert len(cards) == 1
    assert cards[0]["front"] == "Q1"

def test_clean_response_text():
    text = "Here's the response: [{\"front\": \"Q1\", \"back\": \"A1\",}] and some more text"
    cleaned = clean_response_text(text)
    expected = '[{"front": "Q1", "back": "A1"}]'
    assert cleaned == expected

def test_clean_trailing_commas():
    text = '{"cards": [{"front": "Q1", "back": "A1",},],}'
    cleaned = clean_response_text(text)
    # Should remove trailing commas
    assert ",}" not in cleaned
    assert ",]" not in cleaned

def test_parse_with_extra_text():
    text = "Sure! Here are your flashcards:\n\n[{\"front\": \"Q1\", \"back\": \"A1\"}]\n\nI hope this helps!"
    cards = parse_ai_response(text, "qa")
    assert len(cards) == 1
    assert cards[0]["front"] == "Q1"

def test_parse_invalid_json_raises_error():
    text = "This is not JSON at all and cannot be parsed"
    with pytest.raises(ProcessingError, match="Failed to parse AI response as JSON"):
        parse_ai_response(text, "qa")

def test_normalize_single_card_dict():
    data = {"front": "Q1", "back": "A1"}
    cards = normalize_cards(data, "qa")
    assert len(cards) == 1
    assert cards[0]["front"] == "Q1"

def test_normalize_invalid_data_structure():
    data = "invalid data structure"
    with pytest.raises(ProcessingError, match="Invalid card data structure"):
        normalize_cards(data, "qa")