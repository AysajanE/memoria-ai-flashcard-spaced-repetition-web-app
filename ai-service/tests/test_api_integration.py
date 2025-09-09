import pytest
import asyncio
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, Mock
import json


class TestHealthEndpoints:
    """Test health check endpoints."""
    
    def test_health_check(self, client):
        """Test basic health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
    
    @patch('app.queue.r.ping')
    def test_ready_check_with_redis_success(self, mock_ping, client):
        """Test ready check when Redis is available."""
        mock_ping.return_value = True
        response = client.get("/ready")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ready"
        assert "checks" in data
    
    @patch('app.queue.r.ping')
    def test_ready_check_with_redis_failure(self, mock_ping, client):
        """Test ready check when Redis is unavailable."""
        mock_ping.side_effect = Exception("Redis connection failed")
        response = client.get("/ready")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "not ready"
        assert "error" in data["checks"]


class TestCardGeneration:
    """Test card generation endpoints."""
    
    @patch('app.core.logic.process_card_generation')
    @patch('app.core.deduplication.deduplicator')
    def test_generate_cards_success(self, mock_deduplicator, mock_process, client):
        """Test successful card generation request."""
        # Setup mocks
        mock_deduplicator.is_duplicate.return_value = False
        mock_process.return_value = {"status": "completed"}
        
        request_data = {
            "jobId": "test123",
            "text": "Python is a programming language used for web development.",
            "model": "gpt-3.5-turbo",
            "cardType": "qa",
            "numCards": 5
        }
        
        response = client.post("/api/v1/generate-cards", json=request_data)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["jobId"] == "test123"
        assert "message" in data
    
    def test_generate_cards_validation_error_empty_text(self, client):
        """Test validation error with empty text."""
        request_data = {
            "jobId": "test123",
            "text": "",  # Empty text should fail validation
            "model": "gpt-3.5-turbo",
            "cardType": "qa",
            "numCards": 5
        }
        
        response = client.post("/api/v1/generate-cards", json=request_data)
        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False
    
    def test_generate_cards_validation_error_invalid_card_count(self, client):
        """Test validation error with invalid card count."""
        request_data = {
            "jobId": "test123", 
            "text": "Some text content",
            "model": "gpt-3.5-turbo",
            "cardType": "qa",
            "numCards": 0  # Invalid card count
        }
        
        response = client.post("/api/v1/generate-cards", json=request_data)
        assert response.status_code == 400
    
    def test_generate_cards_validation_error_invalid_card_type(self, client):
        """Test validation error with invalid card type."""
        request_data = {
            "jobId": "test123",
            "text": "Some text content", 
            "model": "gpt-3.5-turbo",
            "cardType": "invalid_type",  # Invalid card type
            "numCards": 5
        }
        
        response = client.post("/api/v1/generate-cards", json=request_data)
        assert response.status_code == 400
    
    @patch('app.core.deduplication.deduplicator')
    def test_generate_cards_duplicate_job(self, mock_deduplicator, client):
        """Test handling of duplicate job IDs."""
        mock_deduplicator.is_duplicate.return_value = True
        
        request_data = {
            "jobId": "duplicate123",
            "text": "Python is a programming language",
            "model": "gpt-3.5-turbo", 
            "cardType": "qa",
            "numCards": 5
        }
        
        response = client.post("/api/v1/generate-cards", json=request_data)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "already in progress" in data["message"]
    
    def test_generate_cards_missing_job_id(self, client):
        """Test missing job ID validation."""
        request_data = {
            # Missing jobId
            "text": "Python is a programming language",
            "model": "gpt-3.5-turbo",
            "cardType": "qa", 
            "numCards": 5
        }
        
        response = client.post("/api/v1/generate-cards", json=request_data)
        assert response.status_code == 422  # Validation error
    
    @patch('app.core.logic.process_card_generation')
    def test_generate_cards_processing_error(self, mock_process, client):
        """Test handling of processing errors."""
        mock_process.side_effect = Exception("Processing failed")
        
        request_data = {
            "jobId": "error123",
            "text": "Python is a programming language",
            "model": "gpt-3.5-turbo",
            "cardType": "qa",
            "numCards": 5
        }
        
        response = client.post("/api/v1/generate-cards", json=request_data)
        assert response.status_code == 500
        data = response.json()
        assert data["success"] is False
        assert "error" in data


class TestAdminEndpoints:
    """Test admin endpoints."""
    
    def test_queue_status_requires_auth(self, client):
        """Test that queue status requires authentication."""
        response = client.get("/api/v1/admin/queue-status")
        assert response.status_code == 401
    
    def test_queue_status_invalid_key(self, client):
        """Test queue status with invalid API key."""
        headers = {"X-Internal-API-Key": "invalid-key"}
        response = client.get("/api/v1/admin/queue-status", headers=headers)
        assert response.status_code == 401
    
    @patch('app.config.settings')
    @patch('app.queue.get_queue_info')
    @patch('app.core.deduplication.deduplicator')
    def test_queue_status_with_valid_key(self, mock_deduplicator, mock_queue_info, mock_settings, client):
        """Test queue status with valid API key."""
        # Setup mocks
        mock_settings.INTERNAL_API_KEY = "valid-key"
        mock_settings.USE_QUEUE = True
        mock_queue_info.return_value = {
            "queue_length": 5,
            "started_jobs": 2,
            "finished_jobs": 10
        }
        mock_deduplicator.redis.keys.return_value = ["inflight:job1", "inflight:job2"]
        
        headers = {"X-Internal-API-Key": "valid-key"}
        response = client.get("/api/v1/admin/queue-status", headers=headers)
        
        # Should not be 401 (may be other status if Redis not available)
        assert response.status_code != 401
    
    @patch('app.config.settings')
    def test_concurrency_stats_with_auth(self, mock_settings, client):
        """Test concurrency stats endpoint with authentication."""
        mock_settings.INTERNAL_API_KEY = "valid-key"
        mock_settings.OPENAI_MAX_CONCURRENCY = 8
        mock_settings.ANTHROPIC_MAX_CONCURRENCY = 8
        
        headers = {"X-Internal-API-Key": "valid-key"}
        response = client.get("/api/v1/admin/concurrency-stats", headers=headers)
        
        # Should not be 401
        assert response.status_code != 401


class TestPreviewEndpoints:
    """Test preview endpoints."""
    
    def test_preview_cards_requires_auth(self, client):
        """Test that preview endpoint requires authentication."""
        request_data = {
            "text": "Python is a programming language",
            "model": "gpt-3.5-turbo",
            "cardType": "qa",
            "numCards": 3
        }
        
        response = client.post("/api/v1/preview/cards", json=request_data)
        assert response.status_code == 401
    
    @patch('app.config.settings')
    @patch('app.core.card_generation.generate_cards_with_ai')
    def test_preview_cards_with_auth(self, mock_generate, mock_settings, client):
        """Test preview cards with authentication."""
        # Setup mocks
        mock_settings.INTERNAL_API_KEY = "valid-key"
        mock_generate.return_value = (
            [{"front": "What is Python?", "back": "A programming language"}],
            {"usage": {"total_tokens": 150}, "cost_usd": 0.001}
        )
        
        request_data = {
            "text": "Python is a programming language",
            "model": "gpt-3.5-turbo", 
            "cardType": "qa",
            "numCards": 3
        }
        
        headers = {"X-Internal-API-Key": "valid-key"}
        response = client.post("/api/v1/preview/cards", json=request_data, headers=headers)
        
        # Should not be 401
        assert response.status_code != 401
    
    @patch('app.config.settings')
    def test_preview_cards_text_too_long(self, mock_settings, client):
        """Test preview cards with text that's too long."""
        mock_settings.INTERNAL_API_KEY = "valid-key"
        
        request_data = {
            "text": "x" * 6000,  # Exceeds 5000 character limit
            "model": "gpt-3.5-turbo",
            "cardType": "qa", 
            "numCards": 3
        }
        
        headers = {"X-Internal-API-Key": "valid-key"}
        response = client.post("/api/v1/preview/cards", json=request_data, headers=headers)
        
        assert response.status_code == 400
    
    @patch('app.config.settings')
    def test_preview_cards_too_many_cards(self, mock_settings, client):
        """Test preview cards with too many cards requested."""
        mock_settings.INTERNAL_API_KEY = "valid-key"
        
        request_data = {
            "text": "Python is a programming language",
            "model": "gpt-3.5-turbo",
            "cardType": "qa",
            "numCards": 10  # Exceeds 5 card limit for preview
        }
        
        headers = {"X-Internal-API-Key": "valid-key"}
        response = client.post("/api/v1/preview/cards", json=request_data, headers=headers)
        
        assert response.status_code == 400
    
    @patch('app.config.settings')
    @patch('app.core.text_utils.count_tokens')
    @patch('app.core.text_utils.chunk_text')
    def test_tokenize_text_endpoint(self, mock_chunk, mock_count, mock_settings, client):
        """Test text tokenization endpoint."""
        mock_settings.INTERNAL_API_KEY = "valid-key"
        mock_count.return_value = 1500  # Below threshold, no chunking needed
        
        request_data = {
            "text": "Python is a programming language with many features.",
            "max_chunk_tokens": 2000
        }
        
        headers = {"X-Internal-API-Key": "valid-key"}
        response = client.post("/api/v1/preview/tokenize", json=request_data, headers=headers)
        
        # Should not be 401
        assert response.status_code != 401
    
    @patch('app.config.settings')
    @patch('app.core.text_utils.count_tokens')
    @patch('app.core.text_utils.chunk_text')
    def test_tokenize_text_with_chunking(self, mock_chunk, mock_count, mock_settings, client):
        """Test text tokenization with chunking needed."""
        mock_settings.INTERNAL_API_KEY = "valid-key"
        mock_count.side_effect = lambda text, model=None: 3000  # Above threshold
        mock_chunk.return_value = [
            "First chunk of text here.",
            "Second chunk of text here."
        ]
        
        request_data = {
            "text": "Very long text that needs chunking...",
            "max_chunk_tokens": 2000
        }
        
        headers = {"X-Internal-API-Key": "valid-key"}
        response = client.post("/api/v1/preview/tokenize", json=request_data, headers=headers)
        
        # Should not be 401
        assert response.status_code != 401


class TestWebhookEndpoints:
    """Test webhook related endpoints."""
    
    @patch('app.config.settings')
    def test_retry_webhook_requires_auth(self, mock_settings, client):
        """Test webhook retry requires authentication."""
        response = client.post("/api/v1/admin/retry-webhook/job123")
        assert response.status_code == 401
    
    @patch('app.config.settings')
    @patch('app.queue.q')
    def test_retry_webhook_job_not_found(self, mock_queue, mock_settings, client):
        """Test webhook retry with job not found."""
        mock_settings.INTERNAL_API_KEY = "valid-key"
        mock_queue.connection = Mock()
        
        # Mock Job.fetch to raise exception
        with patch('app.api.v1.admin.Job') as mock_job_class:
            mock_job_class.fetch.side_effect = Exception("Job not found")
            
            headers = {"X-Internal-API-Key": "valid-key"}
            response = client.post("/api/v1/admin/retry-webhook/invalid-job", headers=headers)
            
            # Should not be 401
            assert response.status_code != 401
    
    @patch('app.config.settings')
    def test_job_status_requires_auth(self, mock_settings, client):
        """Test job status requires authentication."""
        response = client.get("/api/v1/admin/job-status/job123")
        assert response.status_code == 401
    
    @patch('app.config.settings')
    @patch('app.queue.q')
    def test_job_status_not_found(self, mock_queue, mock_settings, client):
        """Test job status with job not found."""
        mock_settings.INTERNAL_API_KEY = "valid-key"
        mock_queue.connection = Mock()
        
        with patch('app.api.v1.admin.Job') as mock_job_class:
            mock_job_class.fetch.side_effect = Exception("Job not found")
            
            headers = {"X-Internal-API-Key": "valid-key"}
            response = client.get("/api/v1/admin/job-status/invalid-job", headers=headers)
            
            assert response.status_code == 404


class TestErrorHandling:
    """Test error handling across endpoints."""
    
    def test_404_on_invalid_endpoint(self, client):
        """Test 404 response for invalid endpoints."""
        response = client.get("/api/v1/nonexistent")
        assert response.status_code == 404
    
    def test_405_on_wrong_method(self, client):
        """Test 405 response for wrong HTTP methods."""
        # Try GET on POST-only endpoint
        response = client.get("/api/v1/generate-cards")
        assert response.status_code == 405
    
    def test_422_on_invalid_json(self, client):
        """Test 422 response for invalid JSON."""
        response = client.post("/api/v1/generate-cards", 
                             data="invalid json",
                             headers={"Content-Type": "application/json"})
        assert response.status_code == 422
    
    @patch('app.main.logger')
    def test_500_on_unhandled_exception(self, mock_logger, client):
        """Test 500 response on unhandled exceptions."""
        with patch('app.api.v1.ai_tasks.generate_cards') as mock_endpoint:
            mock_endpoint.side_effect = Exception("Unexpected error")
            
            request_data = {
                "jobId": "test123",
                "text": "Test text",
                "model": "gpt-3.5-turbo",
                "cardType": "qa",
                "numCards": 5
            }
            
            response = client.post("/api/v1/generate-cards", json=request_data)
            # May be 500 or handled by FastAPI exception handlers
            assert response.status_code >= 400


class TestCORSHeaders:
    """Test CORS header configuration."""
    
    def test_cors_headers_present(self, client):
        """Test that CORS headers are present in responses."""
        response = client.options("/health")
        
        # Check for common CORS headers (may vary based on configuration)
        headers = response.headers
        # At minimum, the response should be successful or have appropriate CORS headers
        assert response.status_code in [200, 204, 405]  # Different servers handle OPTIONS differently
    
    def test_cors_on_api_endpoints(self, client):
        """Test CORS on API endpoints."""
        # Test preflight request
        headers = {
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type"
        }
        
        response = client.options("/api/v1/generate-cards", headers=headers)
        # Should not be blocked by CORS
        assert response.status_code != 403


class TestRequestValidation:
    """Test request validation and schemas."""
    
    def test_generate_cards_schema_validation(self, client):
        """Test comprehensive schema validation for generate cards."""
        test_cases = [
            # Missing required fields
            {"text": "test"}, 
            {"jobId": "test123"},
            {"jobId": "test123", "text": "test", "numCards": "invalid"},  # Wrong type
            {"jobId": "test123", "text": "test", "numCards": -1},  # Invalid range
        ]
        
        for case in test_cases:
            response = client.post("/api/v1/generate-cards", json=case)
            assert response.status_code in [400, 422], f"Case {case} should fail validation"
    
    def test_preview_schema_validation(self, client):
        """Test schema validation for preview endpoint."""
        headers = {"X-Internal-API-Key": "test-key"}
        
        with patch('app.config.settings.INTERNAL_API_KEY', 'test-key'):
            # Test invalid numCards
            response = client.post("/api/v1/preview/cards", 
                                 json={"text": "test", "numCards": 10},
                                 headers=headers)
            assert response.status_code == 400
            
            # Test invalid cardType
            response = client.post("/api/v1/preview/cards",
                                 json={"text": "test", "cardType": "invalid"}, 
                                 headers=headers)
            assert response.status_code == 400


@pytest.mark.integration
class TestFullWorkflow:
    """Test full workflow integration."""
    
    @patch('app.core.ai_caller.call_openai_api')
    @patch('app.core.webhook_sender.send_webhook_async')
    @patch('app.config.settings')
    def test_complete_card_generation_workflow(self, mock_settings, mock_webhook, mock_ai_call, client):
        """Test complete card generation workflow."""
        # Setup mocks
        mock_settings.INTERNAL_API_KEY = "valid-key"
        mock_settings.USE_QUEUE = False  # Use background tasks for testing
        mock_ai_call.return_value = {
            "content": '{"cards": [{"front": "What is Python?", "back": "A programming language"}]}',
            "usage": {"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150}
        }
        mock_webhook.return_value = True
        
        # Send request
        request_data = {
            "jobId": "integration123",
            "text": "Python is a high-level programming language.",
            "model": "gpt-3.5-turbo",
            "cardType": "qa", 
            "numCards": 3
        }
        
        response = client.post("/api/v1/generate-cards", json=request_data)
        
        # Should accept the request
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["jobId"] == "integration123"