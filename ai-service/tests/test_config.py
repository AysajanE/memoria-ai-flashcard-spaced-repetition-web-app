"""Test configuration validation."""
import os
import pytest

# Set test environment variables before importing app
os.environ.setdefault("INTERNAL_API_KEY", "test-key")
os.environ.setdefault("NEXTJS_APP_STATUS_WEBHOOK_URL", "http://localhost:3000/api/webhooks/ai-status")
os.environ.setdefault("ENVIRONMENT", "test")

from app.core.config_validator import validate_configuration, log_configuration

def test_validate_configuration_no_errors():
    """Test configuration validation with minimal valid settings."""
    # Test the validation doesn't raise errors with our test configuration
    issues = validate_configuration()
    
    # Should have warnings but no errors with test configuration
    errors = [i for i in issues if i.startswith("ERROR")]
    assert len(errors) == 0, f"Unexpected errors: {errors}"

def test_log_configuration():
    """Test configuration logging doesn't raise errors."""
    # Should not raise any exceptions
    log_configuration()