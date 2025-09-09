import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch
from app.core.text_processing import count_tokens, chunk_text, format_for_anki
from app.config import get_model_config, Settings


class TestTextProcessing:
    """Test text processing utilities."""
    
    def test_count_tokens_empty_string(self):
        """Test token counting with empty string."""
        assert count_tokens("") == 0
        assert count_tokens(None) == 0
    
    def test_count_tokens_openai_model(self):
        """Test token counting for OpenAI models."""
        text = "Hello world"
        # Mock the get_model_config to return OpenAI config
        with patch('app.core.text_processing.get_model_config') as mock_config:
            mock_config.return_value = {"provider": "openai", "name": "gpt-4"}
            token_count = count_tokens(text, "gpt-4")
            assert isinstance(token_count, int)
            assert token_count > 0
    
    def test_count_tokens_anthropic_model(self):
        """Test token counting for Anthropic models."""
        text = "Hello world"
        with patch('app.core.text_processing.get_model_config') as mock_config:
            mock_config.return_value = {"provider": "anthropic", "name": "claude-3-haiku"}
            token_count = count_tokens(text, "claude-3-haiku")
            # Anthropic uses character-based approximation: len(text) // 4
            expected = len(text) // 4 + (1 if len(text) % 4 > 0 else 0)
            assert token_count == expected
    
    def test_count_tokens_unknown_provider(self):
        """Test token counting with unknown provider."""
        text = "Hello world"
        with patch('app.core.text_processing.get_model_config') as mock_config:
            mock_config.return_value = {"provider": "unknown", "name": "unknown-model"}
            with patch('app.core.text_processing.logger') as mock_logger:
                token_count = count_tokens(text, "unknown-model")
                assert isinstance(token_count, int)
                assert token_count > 0
                # Should log a warning
                mock_logger.warning.assert_called_once()
    
    def test_count_tokens_exception_handling(self):
        """Test token counting error handling."""
        text = "Hello world"
        with patch('app.core.text_processing.get_model_config') as mock_config:
            mock_config.side_effect = Exception("API error")
            with patch('app.core.text_processing.logger') as mock_logger:
                token_count = count_tokens(text, "gpt-4")
                # Should fallback to character-based count
                assert token_count == len(text) // 4
                mock_logger.error.assert_called_once()
    
    def test_chunk_text_small_input(self):
        """Test chunking with text that fits in one chunk."""
        text = "Small text"
        with patch('app.core.text_processing.count_tokens') as mock_count:
            mock_count.return_value = 10
            chunks = chunk_text(text, max_tokens=100)
            assert len(chunks) == 1
            assert chunks[0] == text
    
    def test_chunk_text_large_input(self):
        """Test chunking with text requiring multiple chunks."""
        # Create paragraphs that will need chunking
        paragraphs = ["Paragraph one with content.", "Paragraph two with more content."]
        text = "\n\n".join(paragraphs)
        
        def mock_token_count(text_input, model=None):
            # Simulate paragraph 1: 50 tokens, paragraph 2: 60 tokens
            if "Paragraph one" in text_input:
                return 50
            elif "Paragraph two" in text_input:
                return 60
            return len(text_input.split()) * 2  # Rough approximation
        
        with patch('app.core.text_processing.count_tokens', side_effect=mock_token_count):
            chunks = chunk_text(text, max_tokens=70)
            assert len(chunks) >= 1
    
    def test_format_for_anki_qa_cards(self):
        """Test Anki formatting for Q&A cards."""
        cards = [
            {"front": "What is Python?", "back": "A programming language"},
            {"front": "Who created Python?", "back": "Guido van Rossum"}
        ]
        result = format_for_anki(cards, "qa")
        expected = "What is Python?;A programming language\nWho created Python?;Guido van Rossum"
        assert result == expected
    
    def test_format_for_anki_cloze_cards(self):
        """Test Anki formatting for cloze cards."""
        cards = [
            {"front": "Python was created by [...]", "back": "Guido van Rossum"},
            {"front": "Python is a [...] language", "back": "programming"}
        ]
        result = format_for_anki(cards, "cloze")
        lines = result.split("\n")
        assert "{{c1::Guido van Rossum}}" in lines[0]
        assert "{{c1::programming}}" in lines[1]
    
    def test_format_for_anki_handles_semicolons(self):
        """Test that semicolons are replaced with commas."""
        cards = [{"front": "What is this; thing?", "back": "A test; case"}]
        result = format_for_anki(cards, "qa")
        assert ";" in result  # The delimiter semicolon
        assert result.count(";") == 1  # Only one semicolon (the delimiter)
        assert "," in result  # Semicolons in content replaced with commas


class TestConfig:
    """Test configuration utilities."""
    
    def test_get_model_config_known_model(self):
        """Test getting config for a known model."""
        # Mock settings with a known model
        mock_ai_models = {
            "gpt-4": {
                "provider": "openai",
                "max_input_tokens": 8000,
                "max_output_tokens": 4000,
                "description": "Advanced OpenAI model"
            }
        }
        
        with patch('app.config.settings') as mock_settings:
            mock_settings.AI_MODELS = mock_ai_models
            config = get_model_config("gpt-4")
            
            assert config["name"] == "gpt-4"
            assert config["provider"] == "openai"
            assert config["max_input_tokens"] == 8000
    
    def test_get_model_config_unknown_openai_model(self):
        """Test getting config for unknown OpenAI model."""
        with patch('app.config.settings') as mock_settings:
            mock_settings.AI_MODELS = {}
            mock_settings.MAX_INPUT_TOKENS = 4000
            mock_settings.MAX_OUTPUT_TOKENS = 2000
            
            config = get_model_config("gpt-5")
            
            assert config["name"] == "gpt-5"
            assert config["provider"] == "openai"
            assert config["max_input_tokens"] == 4000
    
    def test_get_model_config_unknown_anthropic_model(self):
        """Test getting config for unknown Anthropic model."""
        with patch('app.config.settings') as mock_settings:
            mock_settings.AI_MODELS = {}
            mock_settings.MAX_INPUT_TOKENS = 4000
            mock_settings.MAX_OUTPUT_TOKENS = 2000
            
            config = get_model_config("claude-4")
            
            assert config["name"] == "claude-4"
            assert config["provider"] == "anthropic"
    
    def test_get_model_config_default_model(self):
        """Test getting default model config."""
        with patch('app.config.settings') as mock_settings:
            mock_settings.DEFAULT_OPENAI_MODEL = "gpt-4o-mini"
            mock_settings.AI_MODELS = {
                "gpt-4o-mini": {
                    "provider": "openai",
                    "max_input_tokens": 128000
                }
            }
            
            config = get_model_config(None)
            assert config["name"] == "gpt-4o-mini"
    
    def test_get_model_config_unknown_provider(self):
        """Test getting config for model with unknown provider."""
        with patch('app.config.settings') as mock_settings:
            mock_settings.AI_MODELS = {}
            mock_settings.MAX_INPUT_TOKENS = 4000
            mock_settings.MAX_OUTPUT_TOKENS = 2000
            
            config = get_model_config("unknown-model-v1")
            
            assert config["name"] == "unknown-model-v1"
            assert config["provider"] == "openai"  # Defaults to openai


class TestSettings:
    """Test settings configuration."""
    
    def test_settings_defaults(self):
        """Test that settings have appropriate defaults."""
        # Create settings without environment variables
        settings = Settings(
            INTERNAL_API_KEY="test-key",
            NEXTJS_APP_STATUS_WEBHOOK_URL="http://localhost:3000/webhook"
        )
        
        assert settings.API_HOST == "0.0.0.0"
        assert settings.API_PORT == 8000
        assert settings.ENVIRONMENT == "development"
        assert settings.LOG_LEVEL == "INFO"
        assert settings.CORS_ORIGINS == ["*"]
        assert settings.DEFAULT_OPENAI_MODEL == "gpt-4o-mini"
        assert settings.DEFAULT_ANTHROPIC_MODEL == "claude-haiku-3-5-latest"
    
    def test_settings_required_fields(self):
        """Test that required fields raise error when missing."""
        with pytest.raises(Exception):
            # Missing INTERNAL_API_KEY should raise validation error
            Settings(NEXTJS_APP_STATUS_WEBHOOK_URL="http://localhost:3000/webhook")
    
    def test_settings_ai_models_default(self):
        """Test that AI_MODELS has sensible defaults."""
        settings = Settings(
            INTERNAL_API_KEY="test-key",
            NEXTJS_APP_STATUS_WEBHOOK_URL="http://localhost:3000/webhook"
        )
        
        assert "gpt-4o-mini" in settings.AI_MODELS
        assert settings.AI_MODELS["gpt-4o-mini"]["provider"] == "openai"
        assert "max_input_tokens" in settings.AI_MODELS["gpt-4o-mini"]


# Mock classes for testing more complex functionality
class MockJobDeduplicator:
    """Mock deduplicator for testing."""
    
    def __init__(self, redis_client=None):
        self.redis = redis_client or Mock()
        self.key_prefix = "inflight"
        self.default_ttl = 3600
    
    def is_duplicate(self, job_id: str) -> bool:
        key = f"{self.key_prefix}:{job_id}"
        return self.redis.exists(key) > 0
    
    def mark_started(self, job_id: str, ttl=None) -> bool:
        key = f"{self.key_prefix}:{job_id}"
        if self.redis.setnx(key, "1"):
            self.redis.expire(key, ttl or self.default_ttl)
            return True
        return False
    
    def mark_completed(self, job_id: str):
        key = f"{self.key_prefix}:{job_id}"
        self.redis.delete(key)


class TestJobDeduplicator:
    """Test job deduplication logic."""
    
    @pytest.fixture
    def mock_redis(self):
        return Mock()
    
    @pytest.fixture
    def deduplicator(self, mock_redis):
        return MockJobDeduplicator(mock_redis)
    
    def test_mark_started_success(self, deduplicator, mock_redis):
        """Test successful job start marking."""
        mock_redis.setnx.return_value = True
        result = deduplicator.mark_started("job123")
        
        assert result is True
        mock_redis.setnx.assert_called_once_with("inflight:job123", "1")
        mock_redis.expire.assert_called_once_with("inflight:job123", 3600)
    
    def test_mark_started_duplicate(self, deduplicator, mock_redis):
        """Test duplicate job handling."""
        mock_redis.setnx.return_value = False
        result = deduplicator.mark_started("job123")
        
        assert result is False
        mock_redis.expire.assert_not_called()
    
    def test_is_duplicate_exists(self, deduplicator, mock_redis):
        """Test duplicate detection when job exists."""
        mock_redis.exists.return_value = 1
        assert deduplicator.is_duplicate("job123") is True
    
    def test_is_duplicate_not_exists(self, deduplicator, mock_redis):
        """Test duplicate detection when job doesn't exist."""
        mock_redis.exists.return_value = 0
        assert deduplicator.is_duplicate("job123") is False
    
    def test_mark_completed(self, deduplicator, mock_redis):
        """Test job completion marking."""
        deduplicator.mark_completed("job123")
        mock_redis.delete.assert_called_once_with("inflight:job123")


class MockCostCalculator:
    """Mock cost calculator for testing."""
    
    def __init__(self):
        self.pricing = {
            "gpt-3.5-turbo": {"input": 0.0015, "output": 0.002},
            "gpt-4": {"input": 0.03, "output": 0.06},
            "claude-3-haiku": {"input": 0.00025, "output": 0.00125},
        }
    
    def calculate_cost(self, model: str, usage: dict) -> float:
        """Calculate cost for given usage."""
        model_lower = model.lower()
        pricing_key = None
        
        for key in self.pricing:
            if key in model_lower:
                pricing_key = key
                break
        
        if not pricing_key:
            return None
        
        pricing = self.pricing[pricing_key]
        input_tokens = usage.get("prompt_tokens", 0)
        output_tokens = usage.get("completion_tokens", 0)
        
        input_cost = (input_tokens / 1000) * pricing["input"]
        output_cost = (output_tokens / 1000) * pricing["output"]
        
        return round(input_cost + output_cost, 6)


class TestCostCalculator:
    """Test cost calculation logic."""
    
    @pytest.fixture  
    def calculator(self):
        return MockCostCalculator()
    
    def test_calculate_gpt35_cost(self, calculator):
        """Test GPT-3.5-turbo cost calculation."""
        usage = {"prompt_tokens": 1000, "completion_tokens": 500}
        cost = calculator.calculate_cost("gpt-3.5-turbo", usage)
        expected = (1000/1000 * 0.0015) + (500/1000 * 0.002)
        assert cost == pytest.approx(expected, rel=1e-6)
    
    def test_calculate_gpt4_cost(self, calculator):
        """Test GPT-4 cost calculation."""
        usage = {"prompt_tokens": 500, "completion_tokens": 250}
        cost = calculator.calculate_cost("gpt-4", usage)
        expected = (500/1000 * 0.03) + (250/1000 * 0.06)
        assert cost == pytest.approx(expected, rel=1e-6)
    
    def test_calculate_claude_cost(self, calculator):
        """Test Claude cost calculation."""
        usage = {"prompt_tokens": 2000, "completion_tokens": 1000}
        cost = calculator.calculate_cost("claude-3-haiku", usage)
        expected = (2000/1000 * 0.00025) + (1000/1000 * 0.00125)
        assert cost == pytest.approx(expected, rel=1e-6)
    
    def test_calculate_unknown_model_returns_none(self, calculator):
        """Test unknown model returns None."""
        usage = {"prompt_tokens": 1000, "completion_tokens": 500}
        cost = calculator.calculate_cost("unknown-model", usage)
        assert cost is None
    
    def test_calculate_cost_zero_tokens(self, calculator):
        """Test cost calculation with zero tokens."""
        usage = {"prompt_tokens": 0, "completion_tokens": 0}
        cost = calculator.calculate_cost("gpt-3.5-turbo", usage)
        assert cost == 0.0
    
    def test_calculate_cost_missing_tokens(self, calculator):
        """Test cost calculation with missing token fields."""
        usage = {}
        cost = calculator.calculate_cost("gpt-3.5-turbo", usage)
        assert cost == 0.0


class MockCardCleaner:
    """Mock card cleaner for testing."""
    
    def __init__(self):
        self.min_length = 3
        self.max_length = 500
    
    def clean_and_validate_cards(self, cards: list, card_type: str) -> list:
        """Clean and validate cards."""
        cleaned_cards = []
        for card in cards:
            cleaned_card = self._clean_single_card(card, card_type)
            if self._validate_card(cleaned_card, card_type):
                cleaned_cards.append(cleaned_card)
        return cleaned_cards
    
    def _clean_single_card(self, card: dict, card_type: str) -> dict:
        """Clean a single card."""
        cleaned = {
            "type": card.get("type", card_type),
            "front": self._clean_text(card.get("front", "")),
            "back": self._clean_text(card.get("back", ""))
        }
        
        if card_type == "qa":
            cleaned["front"] = self._ensure_question_format(cleaned["front"])
        elif card_type == "cloze":
            cleaned = self._clean_cloze_card(cleaned)
        
        return cleaned
    
    def _clean_text(self, text: str) -> str:
        """Clean text content."""
        if not isinstance(text, str):
            text = str(text)
        
        # Basic cleaning
        text = text.strip()
        text = text.replace("**", "")  # Remove bold markdown
        text = text.replace("*", "")   # Remove italic markdown
        
        return text
    
    def _ensure_question_format(self, front_text: str) -> str:
        """Ensure QA front text is in question format."""
        if not front_text:
            return front_text
        
        question_words = ['what', 'who', 'when', 'where', 'why', 'how', 'which']
        if not front_text.endswith('?') and any(word in front_text.lower().split()[:3] 
                                               for word in question_words):
            return front_text + '?'
        
        return front_text
    
    def _clean_cloze_card(self, card: dict) -> dict:
        """Clean cloze cards."""
        # Basic cloze card cleaning logic
        return card
    
    def _validate_card(self, card: dict, card_type: str) -> bool:
        """Validate a card."""
        front = card.get("front", "")
        back = card.get("back", "")
        
        # Basic validation
        if not front or not back:
            return False
        
        if len(front) < self.min_length or len(back) < self.min_length:
            return False
        
        if len(front) > self.max_length or len(back) > self.max_length:
            return False
        
        # Avoid duplicate content
        if front.lower().strip() == back.lower().strip():
            return False
        
        return True


class TestCardCleaner:
    """Test card cleaning and validation."""
    
    @pytest.fixture
    def cleaner(self):
        return MockCardCleaner()
    
    def test_clean_qa_card_adds_question_mark(self, cleaner):
        """Test that QA cards get question marks added."""
        card = {"front": "What is Python", "back": "A language"}
        cleaned = cleaner._clean_single_card(card, "qa")
        assert cleaned["front"] == "What is Python?"
    
    def test_clean_text_removes_markdown(self, cleaner):
        """Test that markdown is removed from text."""
        text = "**Bold text** and *italic text*"
        cleaned = cleaner._clean_text(text)
        assert "**" not in cleaned
        assert "*" not in cleaned
        assert cleaned == "Bold text and italic text"
    
    def test_validate_card_rejects_empty_content(self, cleaner):
        """Test validation rejects empty content."""
        card = {"front": "", "back": "Some answer"}
        assert not cleaner._validate_card(card, "qa")
        
        card = {"front": "Some question", "back": ""}
        assert not cleaner._validate_card(card, "qa")
    
    def test_validate_card_rejects_short_content(self, cleaner):
        """Test validation rejects too-short content."""
        card = {"front": "AB", "back": "CD"}  # Both under min_length of 3
        assert not cleaner._validate_card(card, "qa")
    
    def test_validate_card_rejects_duplicate_content(self, cleaner):
        """Test validation rejects duplicate content."""
        card = {"front": "Python", "back": "python"}
        assert not cleaner._validate_card(card, "qa")
    
    def test_validate_card_accepts_valid_content(self, cleaner):
        """Test validation accepts valid content."""
        card = {"front": "What is Python?", "back": "A programming language"}
        assert cleaner._validate_card(card, "qa")
    
    def test_clean_and_validate_cards_filters_invalid(self, cleaner):
        """Test that invalid cards are filtered out."""
        cards = [
            {"front": "What is Python?", "back": "A programming language"},  # Valid
            {"front": "", "back": "Invalid"},  # Invalid - empty front
            {"front": "Valid question?", "back": "Valid answer"},  # Valid
            {"front": "AB", "back": "CD"},  # Invalid - too short
        ]
        
        cleaned = cleaner.clean_and_validate_cards(cards, "qa")
        assert len(cleaned) == 2
        assert all(cleaner._validate_card(card, "qa") for card in cleaned)