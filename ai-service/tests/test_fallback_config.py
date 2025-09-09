"""
Tests for fallback configuration and behavior.
"""

import pytest
from unittest.mock import patch, MagicMock

from app.core.fallback_config import FallbackConfig, fallback_config, log_fallback_attempt, log_fallback_success
from app.config import settings


class TestFallbackConfig:
    """Test fallback configuration functionality."""
    
    def test_get_fallback_models_existing(self):
        """Test getting fallback models for existing model."""
        config = FallbackConfig()
        fallbacks = config.get_fallback_models("gpt-4o")
        
        assert isinstance(fallbacks, list)
        assert len(fallbacks) > 0
        assert "gpt-4o-mini" in fallbacks
    
    def test_get_fallback_models_nonexistent(self):
        """Test getting fallback models for non-existent model."""
        config = FallbackConfig()
        fallbacks = config.get_fallback_models("non-existent-model")
        
        assert isinstance(fallbacks, list)
        assert len(fallbacks) == 0
    
    def test_should_fallback_valid_errors(self):
        """Test that valid error types trigger fallback."""
        config = FallbackConfig()
        
        valid_errors = ["rate_limit_error", "network_error", "ai_service_error"]
        for error in valid_errors:
            assert config.should_fallback(error) is True
    
    def test_should_fallback_invalid_errors(self):
        """Test that invalid error types don't trigger fallback."""
        config = FallbackConfig()
        
        invalid_errors = ["auth_error", "validation_error", "parse_error"]
        for error in invalid_errors:
            assert config.should_fallback(error) is False
    
    def test_get_all_models_to_try_with_fallback_enabled(self):
        """Test getting all models when fallback is enabled."""
        with patch('app.core.fallback_config.settings.ENABLE_FALLBACK', True):
            config = FallbackConfig()
            models = config.get_all_models_to_try("gpt-4o")
            
            assert "gpt-4o" == models[0]  # Primary model first
            assert len(models) > 1  # Should include fallbacks
    
    def test_get_all_models_to_try_with_fallback_disabled(self):
        """Test getting all models when fallback is disabled."""
        with patch('app.core.fallback_config.settings.ENABLE_FALLBACK', False):
            config = FallbackConfig()
            models = config.get_all_models_to_try("gpt-4o")
            
            assert models == ["gpt-4o"]  # Only primary model
    
    @patch('app.core.fallback_config.logger')
    def test_log_fallback_attempt(self, mock_logger):
        """Test logging fallback attempts."""
        log_fallback_attempt("gpt-4o", "gpt-4o-mini", "rate_limit_error")
        
        mock_logger.warning.assert_called_once()
        call_args = mock_logger.warning.call_args
        assert "Model fallback triggered" in call_args[0][0]
    
    @patch('app.core.fallback_config.logger')
    def test_log_fallback_success(self, mock_logger):
        """Test logging fallback success."""
        log_fallback_success("gpt-4o", "gpt-4o-mini", 2)
        
        mock_logger.info.assert_called_once()
        call_args = mock_logger.info.call_args
        assert "Fallback successful" in call_args[0][0]