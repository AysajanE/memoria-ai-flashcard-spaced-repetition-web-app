"""
Integration tests for Phase 4 reliability features.

These tests verify that fallback and circuit breaker features work together
and integrate properly with the AI caller system.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import asyncio

from app.core.ai_caller import generate_cards_with_fallback, RateLimitExceeded, AIServiceError
from app.core.circuit_breaker import CircuitBreakerOpenError
from app.config import settings


class TestPhase4Integration:
    """Integration tests for Phase 4 reliability patterns."""
    
    @pytest.mark.asyncio
    @patch('app.core.ai_caller.settings.ENABLE_FALLBACK', True)
    @patch('app.core.ai_caller.settings.ENABLE_CIRCUIT_BREAKER', False)
    async def test_fallback_without_circuit_breaker(self):
        """Test fallback functionality without circuit breaker."""
        
        # Mock the first model to fail, second to succeed
        with patch('app.core.ai_caller._generate_with_openai') as mock_openai, \
             patch('app.core.ai_caller._generate_with_anthropic') as mock_anthropic, \
             patch('app.core.ai_caller.get_model_config') as mock_config:
            
            # First call fails with rate limit
            mock_openai.side_effect = RateLimitExceeded("Rate limit exceeded")
            # Second call succeeds
            mock_anthropic.return_value = '{"cards": [{"front": "Q?", "back": "A"}]}'
            
            # Mock model config to return different providers
            def mock_config_side_effect(model):
                if "gpt" in model:
                    return {"name": model, "provider": "openai"}
                else:
                    return {"name": model, "provider": "anthropic"}
            mock_config.side_effect = mock_config_side_effect
            
            result, metadata = await generate_cards_with_fallback(
                text="Test content",
                model_name="gpt-4o"
            )
            
            assert result is not None
            assert metadata["was_fallback"] is True
            assert "claude" in metadata["model_used"]
    
    @pytest.mark.asyncio
    @patch('app.core.ai_caller.settings.ENABLE_FALLBACK', False)
    @patch('app.core.ai_caller.settings.ENABLE_CIRCUIT_BREAKER', True)
    async def test_circuit_breaker_without_fallback(self):
        """Test circuit breaker functionality without fallback."""
        
        with patch('app.core.ai_caller.openai_circuit') as mock_circuit, \
             patch('app.core.ai_caller.get_model_config') as mock_config:
            
            # Mock circuit breaker to raise open error
            mock_circuit.call.side_effect = CircuitBreakerOpenError("openai")
            mock_config.return_value = {"name": "gpt-4o", "provider": "openai"}
            
            with pytest.raises(RateLimitExceeded) as exc_info:
                await generate_cards_with_fallback(
                    text="Test content",
                    model_name="gpt-4o"
                )
            
            assert "circuit breaker open" in str(exc_info.value)
    
    @pytest.mark.asyncio
    @patch('app.core.ai_caller.settings.ENABLE_FALLBACK', True)
    @patch('app.core.ai_caller.settings.ENABLE_CIRCUIT_BREAKER', True)
    async def test_fallback_with_circuit_breaker_integration(self):
        """Test that fallback and circuit breaker work together."""
        
        with patch('app.core.ai_caller.openai_circuit') as mock_openai_circuit, \
             patch('app.core.ai_caller.anthropic_circuit') as mock_anthropic_circuit, \
             patch('app.core.ai_caller.get_model_config') as mock_config:
            
            # First provider (OpenAI) circuit breaker is open
            mock_openai_circuit.call.side_effect = CircuitBreakerOpenError("openai")
            # Second provider (Anthropic) circuit breaker allows calls
            mock_anthropic_circuit.call.return_value = '{"cards": [{"front": "Q?", "back": "A"}]}'
            
            # Mock model config
            def mock_config_side_effect(model):
                if "gpt" in model:
                    return {"name": model, "provider": "openai"}
                else:
                    return {"name": model, "provider": "anthropic"}
            mock_config.side_effect = mock_config_side_effect
            
            result, metadata = await generate_cards_with_fallback(
                text="Test content",
                model_name="gpt-4o"
            )
            
            assert result is not None
            assert metadata["was_fallback"] is True
            assert "claude" in metadata["model_used"]
    
    @pytest.mark.asyncio
    @patch('app.core.ai_caller.settings.ENABLE_FALLBACK', True)
    @patch('app.core.ai_caller.settings.ENABLE_CIRCUIT_BREAKER', True)
    async def test_all_providers_circuit_breakers_open(self):
        """Test behavior when all provider circuit breakers are open."""
        
        with patch('app.core.ai_caller.openai_circuit') as mock_openai_circuit, \
             patch('app.core.ai_caller.anthropic_circuit') as mock_anthropic_circuit, \
             patch('app.core.ai_caller.get_model_config') as mock_config:
            
            # Both circuit breakers are open
            mock_openai_circuit.call.side_effect = CircuitBreakerOpenError("openai")
            mock_anthropic_circuit.call.side_effect = CircuitBreakerOpenError("anthropic")
            
            # Mock model config
            def mock_config_side_effect(model):
                if "gpt" in model:
                    return {"name": model, "provider": "openai"}
                else:
                    return {"name": model, "provider": "anthropic"}
            mock_config.side_effect = mock_config_side_effect
            
            with pytest.raises(AIServiceError) as exc_info:
                await generate_cards_with_fallback(
                    text="Test content",
                    model_name="gpt-4o"
                )
            
            assert "All models in fallback chain failed" in str(exc_info.value)
    
    @pytest.mark.asyncio
    @patch('app.core.ai_caller.settings.ENABLE_FALLBACK', False)
    @patch('app.core.ai_caller.settings.ENABLE_CIRCUIT_BREAKER', False)
    async def test_disabled_reliability_features(self):
        """Test that system works normally when all reliability features are disabled."""
        
        with patch('app.core.ai_caller._generate_with_openai') as mock_openai, \
             patch('app.core.ai_caller.get_model_config') as mock_config:
            
            mock_openai.return_value = '{"cards": [{"front": "Q?", "back": "A"}]}'
            mock_config.return_value = {"name": "gpt-4o", "provider": "openai"}
            
            # This should use the non-fallback path
            from app.core.ai_caller import generate_cards_with_ai
            result = await generate_cards_with_ai(
                text="Test content",
                model_name="gpt-4o"
            )
            
            assert result is not None
            mock_openai.assert_called_once()
    
    def test_feature_flags_configuration(self):
        """Test that feature flags are properly configured."""
        
        # Test that flags exist and have default values
        assert hasattr(settings, 'ENABLE_FALLBACK')
        assert hasattr(settings, 'ENABLE_CIRCUIT_BREAKER')
        assert hasattr(settings, 'REDIS_URL')
        
        # Test that they are boolean (except REDIS_URL)
        assert isinstance(settings.ENABLE_FALLBACK, bool)
        assert isinstance(settings.ENABLE_CIRCUIT_BREAKER, bool)
        assert isinstance(settings.REDIS_URL, str)