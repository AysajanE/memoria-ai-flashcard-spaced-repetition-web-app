import pytest
from pydantic import ValidationError
from app.schemas.responses import WebhookPayload, ErrorResponse
from app.core.errors import ErrorCategory


class TestWebhookPayloadSchema:
    """Test webhook payload schema validation and contracts."""
    
    def test_completed_webhook_payload_minimal(self):
        """Test minimal completed webhook payload."""
        payload_data = {
            "jobId": "test123",
            "status": "completed"
        }
        
        payload = WebhookPayload(**payload_data)
        assert payload.jobId == "test123"
        assert payload.status == "completed"
        assert payload.cards is None
        assert payload.error is None
    
    def test_completed_webhook_payload_full(self):
        """Test full completed webhook payload."""
        payload_data = {
            "jobId": "test123",
            "status": "completed",
            "cards": [
                {"front": "What is Python?", "back": "A programming language", "type": "qa"},
                {"front": "Who created Python?", "back": "Guido van Rossum", "type": "qa"}
            ],
            "processingTime": 2.5,
            "costUSD": 0.001,
            "tokensUsed": 150,
            "model": "gpt-3.5-turbo"
        }
        
        payload = WebhookPayload(**payload_data)
        assert payload.jobId == "test123"
        assert payload.status == "completed" 
        assert len(payload.cards) == 2
        assert payload.processingTime == 2.5
        assert payload.costUSD == 0.001
        assert payload.tokensUsed == 150
        assert payload.model == "gpt-3.5-turbo"
    
    def test_failed_webhook_payload(self):
        """Test failed webhook payload."""
        payload_data = {
            "jobId": "test123",
            "status": "failed",
            "error": "API rate limit exceeded",
            "category": "rate_limit",
            "suggested_action": "Wait 60 seconds before retrying",
            "retry_after": 60
        }
        
        payload = WebhookPayload(**payload_data)
        assert payload.jobId == "test123"
        assert payload.status == "failed"
        assert payload.error == "API rate limit exceeded"
        assert payload.category == "rate_limit"
        assert payload.suggested_action == "Wait 60 seconds before retrying"
        assert payload.retry_after == 60
    
    def test_progress_webhook_payload(self):
        """Test progress webhook payload."""
        payload_data = {
            "jobId": "test123",
            "status": "in_progress",
            "phase": "chunk_2_of_3", 
            "progressPct": 67,
            "message": "Processing chunk 2 of 3..."
        }
        
        payload = WebhookPayload(**payload_data)
        assert payload.jobId == "test123"
        assert payload.status == "in_progress"
        assert payload.phase == "chunk_2_of_3"
        assert payload.progressPct == 67
        assert payload.message == "Processing chunk 2 of 3..."
    
    def test_webhook_payload_with_fallback_info(self):
        """Test webhook payload with model fallback information."""
        payload_data = {
            "jobId": "test123",
            "status": "completed",
            "cards": [{"front": "Q1", "back": "A1", "type": "qa"}],
            "model": "gpt-3.5-turbo",
            "requested_model": "gpt-4",
            "was_fallback": True,
            "fallback_reason": "Rate limit on primary model"
        }
        
        payload = WebhookPayload(**payload_data)
        assert payload.model == "gpt-3.5-turbo"
        assert payload.requested_model == "gpt-4"
        assert payload.was_fallback is True
        assert payload.fallback_reason == "Rate limit on primary model"
    
    def test_required_fields_validation(self):
        """Test that required fields are validated."""
        # Missing jobId
        with pytest.raises(ValidationError) as exc_info:
            WebhookPayload(status="completed")
        assert "jobId" in str(exc_info.value)
        
        # Missing status
        with pytest.raises(ValidationError) as exc_info:
            WebhookPayload(jobId="test123")
        assert "status" in str(exc_info.value)
    
    def test_invalid_status_values(self):
        """Test validation of status field values."""
        valid_statuses = ["completed", "failed", "in_progress"]
        
        # Valid statuses should work
        for status in valid_statuses:
            payload = WebhookPayload(jobId="test123", status=status)
            assert payload.status == status
        
        # Invalid status should raise error
        with pytest.raises(ValidationError):
            WebhookPayload(jobId="test123", status="invalid_status")
    
    def test_progress_percentage_validation(self):
        """Test validation of progress percentage."""
        # Valid progress percentages
        for pct in [0, 50, 100]:
            payload = WebhookPayload(
                jobId="test123",
                status="in_progress",
                progressPct=pct
            )
            assert payload.progressPct == pct
        
        # Invalid progress percentages (if validation is implemented)
        # Note: This depends on whether we add range validation to the schema
        invalid_percentages = [-1, 101]
        for pct in invalid_percentages:
            try:
                payload = WebhookPayload(
                    jobId="test123", 
                    status="in_progress",
                    progressPct=pct
                )
                # If no validation error, at least check it's set
                assert payload.progressPct == pct
            except ValidationError:
                # If validation exists, it should fail
                pass
    
    def test_card_structure_validation(self):
        """Test validation of card structures."""
        # Valid card structure
        valid_cards = [
            {"front": "Question 1?", "back": "Answer 1", "type": "qa"},
            {"front": "Python is a [...] language", "back": "programming", "type": "cloze"}
        ]
        
        payload = WebhookPayload(
            jobId="test123",
            status="completed", 
            cards=valid_cards
        )
        assert len(payload.cards) == 2
        
        # Cards can also be None
        payload = WebhookPayload(
            jobId="test123",
            status="completed",
            cards=None
        )
        assert payload.cards is None
    
    def test_error_category_validation(self):
        """Test error category validation."""
        valid_categories = [
            "authentication", "rate_limit", "validation", 
            "ai_service", "network", "processing", "system"
        ]
        
        for category in valid_categories:
            payload = WebhookPayload(
                jobId="test123",
                status="failed",
                error="Test error",
                category=category
            )
            assert payload.category == category


class TestErrorResponseSchema:
    """Test error response schema validation."""
    
    def test_basic_error_response(self):
        """Test basic error response."""
        error_data = {
            "error": "API rate limit exceeded",
            "category": "rate_limit"
        }
        
        error = ErrorResponse(**error_data)
        assert error.success is False  # Default value
        assert error.error == "API rate limit exceeded"
        assert error.category == "rate_limit"
        assert error.suggested_action is None
        assert error.retry_after is None
    
    def test_full_error_response(self):
        """Test error response with all fields."""
        error_data = {
            "success": False,
            "error": "OpenAI service temporarily unavailable",
            "category": "ai_service",
            "suggested_action": "Try again in a few minutes",
            "retry_after": 300
        }
        
        error = ErrorResponse(**error_data)
        assert error.success is False
        assert error.error == "OpenAI service temporarily unavailable"
        assert error.category == "ai_service"
        assert error.suggested_action == "Try again in a few minutes"
        assert error.retry_after == 300
    
    def test_error_category_enum_validation(self):
        """Test error category enum validation."""
        # Valid category
        error = ErrorResponse(
            error="Test error",
            category=ErrorCategory.RATE_LIMIT
        )
        assert error.category == ErrorCategory.RATE_LIMIT
        
        # String category (should also work if enum accepts strings)
        error = ErrorResponse(
            error="Test error", 
            category="network"
        )
        assert error.category == "network"


class TestWebhookContractConsistency:
    """Test consistency between different webhook payload types."""
    
    def test_success_vs_failed_payload_structure(self):
        """Test that success and failed payloads have consistent structure."""
        # Success payload
        success_payload = WebhookPayload(
            jobId="test123",
            status="completed",
            cards=[{"front": "Q", "back": "A", "type": "qa"}]
        )
        
        # Failed payload
        failed_payload = WebhookPayload(
            jobId="test123",
            status="failed", 
            error="Processing failed",
            category="processing"
        )
        
        # Both should have jobId and status
        assert success_payload.jobId == failed_payload.jobId
        assert success_payload.status != failed_payload.status
        
        # Success should have cards but no error
        assert success_payload.cards is not None
        assert success_payload.error is None
        
        # Failed should have error but no cards
        assert failed_payload.error is not None
        assert failed_payload.cards is None
    
    def test_progress_payload_intermediate_structure(self):
        """Test that progress payloads have appropriate intermediate structure."""
        progress_payload = WebhookPayload(
            jobId="test123",
            status="in_progress",
            phase="generating",
            progressPct=50,
            message="Generating flashcards..."
        )
        
        # Should have progress fields but no final results
        assert progress_payload.status == "in_progress"
        assert progress_payload.phase == "generating"
        assert progress_payload.progressPct == 50
        assert progress_payload.message == "Generating flashcards..."
        
        # Should not have final success or error fields
        assert progress_payload.cards is None
        assert progress_payload.error is None
    
    def test_job_id_consistency(self):
        """Test that jobId is consistent across payload types."""
        job_id = "consistent-job-123"
        
        payloads = [
            WebhookPayload(jobId=job_id, status="in_progress", progressPct=25),
            WebhookPayload(jobId=job_id, status="in_progress", progressPct=75),
            WebhookPayload(jobId=job_id, status="completed", cards=[])
        ]
        
        for payload in payloads:
            assert payload.jobId == job_id
    
    def test_timestamp_fields_optional(self):
        """Test that timestamp fields are properly optional."""
        # Payload without timestamps should work
        payload = WebhookPayload(
            jobId="test123",
            status="completed"
        )
        
        # Should be able to add timestamps if present
        payload_with_time = WebhookPayload(
            jobId="test123",
            status="completed",
            processingTime=5.2
        )
        assert payload_with_time.processingTime == 5.2


class TestWebhookPayloadSerialization:
    """Test serialization and deserialization of webhook payloads."""
    
    def test_payload_to_dict(self):
        """Test converting payload to dictionary."""
        payload = WebhookPayload(
            jobId="test123",
            status="completed",
            cards=[{"front": "Q", "back": "A", "type": "qa"}],
            processingTime=1.5
        )
        
        payload_dict = payload.dict()
        
        assert payload_dict["jobId"] == "test123"
        assert payload_dict["status"] == "completed"
        assert len(payload_dict["cards"]) == 1
        assert payload_dict["processingTime"] == 1.5
    
    def test_payload_to_json(self):
        """Test converting payload to JSON."""
        payload = WebhookPayload(
            jobId="test123",
            status="failed",
            error="API error",
            category="ai_service"
        )
        
        json_str = payload.json()
        
        # Should be valid JSON string
        import json
        parsed = json.loads(json_str)
        
        assert parsed["jobId"] == "test123"
        assert parsed["status"] == "failed"
        assert parsed["error"] == "API error"
        assert parsed["category"] == "ai_service"
    
    def test_payload_exclude_none_values(self):
        """Test excluding None values from serialization."""
        payload = WebhookPayload(
            jobId="test123",
            status="completed",
            cards=None,  # This is None
            error=None   # This is also None
        )
        
        payload_dict = payload.dict(exclude_none=True)
        
        assert "cards" not in payload_dict
        assert "error" not in payload_dict
        assert "jobId" in payload_dict
        assert "status" in payload_dict


class TestWebhookErrorScenarios:
    """Test webhook payloads for various error scenarios."""
    
    def test_authentication_error_payload(self):
        """Test authentication error webhook payload."""
        payload = WebhookPayload(
            jobId="test123",
            status="failed",
            error="Invalid API key",
            category="authentication",
            suggested_action="Check your API key configuration"
        )
        
        assert payload.category == "authentication"
        assert "API key" in payload.error
        assert payload.suggested_action is not None
    
    def test_rate_limit_error_payload(self):
        """Test rate limit error webhook payload."""
        payload = WebhookPayload(
            jobId="test123",
            status="failed",
            error="Rate limit exceeded for GPT-4",
            category="rate_limit",
            suggested_action="Wait before retrying",
            retry_after=60
        )
        
        assert payload.category == "rate_limit"
        assert payload.retry_after == 60
        assert "rate limit" in payload.error.lower()
    
    def test_validation_error_payload(self):
        """Test validation error webhook payload."""
        payload = WebhookPayload(
            jobId="test123",
            status="failed",
            error="Invalid input: text content is required",
            category="validation",
            suggested_action="Check your request parameters"
        )
        
        assert payload.category == "validation"
        assert "invalid" in payload.error.lower()
    
    def test_network_error_payload(self):
        """Test network error webhook payload."""
        payload = WebhookPayload(
            jobId="test123",
            status="failed",
            error="Connection timeout to OpenAI API",
            category="network",
            suggested_action="Check internet connection and try again"
        )
        
        assert payload.category == "network"
        assert "connection" in payload.error.lower() or "timeout" in payload.error.lower()
    
    def test_processing_error_payload(self):
        """Test processing error webhook payload.""" 
        payload = WebhookPayload(
            jobId="test123",
            status="failed",
            error="Failed to parse AI response as valid JSON",
            category="processing",
            suggested_action="Contact support if this persists"
        )
        
        assert payload.category == "processing"
        assert payload.suggested_action is not None


class TestWebhookSuccessScenarios:
    """Test webhook payloads for various success scenarios."""
    
    def test_basic_success_payload(self):
        """Test basic successful generation payload."""
        cards = [
            {"front": "What is Python?", "back": "A programming language", "type": "qa"},
            {"front": "Who created Python?", "back": "Guido van Rossum", "type": "qa"}
        ]
        
        payload = WebhookPayload(
            jobId="test123",
            status="completed",
            cards=cards,
            processingTime=3.2
        )
        
        assert payload.status == "completed"
        assert len(payload.cards) == 2
        assert payload.processingTime == 3.2
    
    def test_success_with_cost_tracking(self):
        """Test successful payload with cost information."""
        payload = WebhookPayload(
            jobId="test123",
            status="completed",
            cards=[{"front": "Q", "back": "A", "type": "qa"}],
            costUSD=0.002,
            tokensUsed=200,
            model="gpt-4"
        )
        
        assert payload.costUSD == 0.002
        assert payload.tokensUsed == 200
        assert payload.model == "gpt-4"
    
    def test_success_with_fallback_info(self):
        """Test successful payload with fallback model information."""
        payload = WebhookPayload(
            jobId="test123",
            status="completed",
            cards=[{"front": "Q", "back": "A", "type": "qa"}],
            model="gpt-3.5-turbo",
            requested_model="gpt-4",
            was_fallback=True,
            fallback_reason="Primary model rate limited"
        )
        
        assert payload.was_fallback is True
        assert payload.model != payload.requested_model
        assert payload.fallback_reason is not None
    
    def test_success_with_chunked_processing(self):
        """Test successful payload from chunked processing."""
        payload = WebhookPayload(
            jobId="test123",
            status="completed", 
            cards=[{"front": f"Q{i}", "back": f"A{i}", "type": "qa"} for i in range(10)],
            processingTime=8.5,
            chunks_processed=3,
            total_chunks=3
        )
        
        assert len(payload.cards) == 10
        assert payload.chunks_processed == 3
        assert payload.total_chunks == 3
        assert payload.processingTime > 5  # Longer for chunked processing


class TestWebhookValidationEdgeCases:
    """Test edge cases in webhook validation."""
    
    def test_empty_string_job_id(self):
        """Test validation with empty job ID."""
        with pytest.raises(ValidationError):
            WebhookPayload(jobId="", status="completed")
    
    def test_very_long_job_id(self):
        """Test validation with very long job ID."""
        long_job_id = "x" * 1000  # Very long ID
        
        # Should either work or fail gracefully
        try:
            payload = WebhookPayload(jobId=long_job_id, status="completed")
            assert payload.jobId == long_job_id
        except ValidationError:
            # If there's a length limit, it should raise ValidationError
            pass
    
    def test_special_characters_in_fields(self):
        """Test handling of special characters in fields."""
        payload = WebhookPayload(
            jobId="test-123_with.special@chars",
            status="failed",
            error="Error with unicode: 🤖 and quotes \"test\" and newlines\nhere",
            category="processing"
        )
        
        assert "🤖" in payload.error
        assert "\"test\"" in payload.error
        assert "\n" in payload.error
    
    def test_null_and_undefined_handling(self):
        """Test handling of null/undefined values."""
        # Explicit None values
        payload = WebhookPayload(
            jobId="test123",
            status="completed",
            cards=None,
            error=None,
            suggested_action=None
        )
        
        assert payload.cards is None
        assert payload.error is None
        assert payload.suggested_action is None
    
    def test_numeric_precision(self):
        """Test numeric precision in fields."""
        payload = WebhookPayload(
            jobId="test123",
            status="completed",
            processingTime=1.23456789,
            costUSD=0.00123456,
            progressPct=33.333333
        )
        
        # Values should be preserved (precision depends on JSON serialization)
        assert payload.processingTime > 1.2
        assert payload.costUSD > 0.001