"""
Tests for circuit breaker functionality.
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import time

from app.core.circuit_breaker import (
    CircuitBreaker, 
    CircuitState, 
    CircuitBreakerOpenError,
    openai_circuit,
    anthropic_circuit
)


class TestCircuitBreaker:
    """Test circuit breaker functionality."""
    
    @pytest.fixture
    def mock_redis(self):
        """Mock Redis client for testing."""
        mock_redis = MagicMock()
        mock_redis.get.return_value = None
        mock_redis.set.return_value = True
        mock_redis.incr.return_value = 1
        mock_redis.delete.return_value = True
        mock_redis.expire.return_value = True
        mock_redis.ping.return_value = True
        return mock_redis
    
    @pytest.fixture
    def circuit_breaker(self, mock_redis):
        """Create test circuit breaker with mocked Redis."""
        return CircuitBreaker(
            service_name="test_service",
            failure_threshold=2,
            recovery_timeout=1,
            success_threshold=1,
            redis_client=mock_redis
        )
    
    @pytest.mark.asyncio
    async def test_successful_call(self, circuit_breaker):
        """Test successful function call through circuit breaker."""
        mock_func = AsyncMock(return_value="success")
        
        result = await circuit_breaker.call(mock_func)
        
        assert result == "success"
        mock_func.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_opens_after_failures(self, circuit_breaker, mock_redis):
        """Test that circuit breaker opens after threshold failures."""
        # Mock Redis to track state changes
        state_calls = []
        def mock_set(key, value, **kwargs):
            if "state" in key:
                state_calls.append(value)
            return True
        mock_redis.set.side_effect = mock_set
        
        # Mock function that always fails
        failing_func = AsyncMock(side_effect=Exception("Service error"))
        
        # First failure
        with pytest.raises(Exception):
            await circuit_breaker.call(failing_func)
        
        # Mock failure count progression
        mock_redis.incr.side_effect = [1, 2]  # First call returns 1, second returns 2
        
        # Second failure should open the circuit
        with pytest.raises(Exception):
            await circuit_breaker.call(failing_func)
        
        # Verify circuit was opened
        assert CircuitState.OPEN.value in state_calls
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_blocks_when_open(self, circuit_breaker, mock_redis):
        """Test that circuit breaker blocks requests when open."""
        # Set circuit to OPEN state
        mock_redis.get.return_value = CircuitState.OPEN.value
        mock_redis.get.side_effect = lambda key: (
            CircuitState.OPEN.value if "state" in key else str(int(time.time() - 10))
        )
        
        mock_func = AsyncMock(return_value="success")
        
        with pytest.raises(CircuitBreakerOpenError):
            await circuit_breaker.call(mock_func)
        
        # Function should not be called
        mock_func.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_half_open_transition(self, circuit_breaker, mock_redis):
        """Test transition from OPEN to HALF_OPEN after timeout."""
        # Mock time progression
        current_time = time.time()
        
        # Set circuit to OPEN with old failure time
        def mock_get(key):
            if "state" in key:
                return CircuitState.OPEN.value
            elif "last_failure" in key:
                return str(int(current_time - 70))  # 70 seconds ago (past recovery timeout)
            return None
        
        mock_redis.get.side_effect = mock_get
        
        # Mock successful function
        success_func = AsyncMock(return_value="success")
        
        result = await circuit_breaker.call(success_func)
        
        assert result == "success"
        success_func.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_get_status(self, circuit_breaker):
        """Test getting circuit breaker status."""
        status = await circuit_breaker.get_status()
        
        assert "service" in status
        assert "state" in status
        assert "failure_count" in status
        assert "failure_threshold" in status
        assert "recovery_timeout" in status
        assert "success_threshold" in status
        assert "enabled" in status
        assert status["service"] == "test_service"
    
    @pytest.mark.asyncio
    async def test_circuit_breaker_disabled(self):
        """Test that circuit breaker is bypassed when disabled."""
        with patch('app.core.circuit_breaker.settings.ENABLE_CIRCUIT_BREAKER', False):
            cb = CircuitBreaker("test_service")
            mock_func = AsyncMock(return_value="success")
            
            result = await cb.call(mock_func)
            
            assert result == "success"
            mock_func.assert_called_once()
    
    def test_global_circuit_breakers_exist(self):
        """Test that global circuit breakers are properly initialized."""
        assert openai_circuit is not None
        assert anthropic_circuit is not None
        assert openai_circuit.service_name == "openai"
        assert anthropic_circuit.service_name == "anthropic"


class TestCircuitBreakerFallback:
    """Test circuit breaker fallback to local state when Redis is unavailable."""
    
    @pytest.fixture
    def circuit_breaker_no_redis(self):
        """Create circuit breaker without Redis."""
        with patch('app.core.circuit_breaker.settings.REDIS_URL', ''):
            return CircuitBreaker(
                service_name="test_service_no_redis",
                failure_threshold=2,
                recovery_timeout=1,
                success_threshold=1
            )
    
    @pytest.mark.asyncio
    async def test_local_state_fallback(self, circuit_breaker_no_redis):
        """Test that circuit breaker works with local state when Redis is unavailable."""
        mock_func = AsyncMock(return_value="success")
        
        result = await circuit_breaker_no_redis.call(mock_func)
        
        assert result == "success"
        mock_func.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_local_state_failure_tracking(self, circuit_breaker_no_redis):
        """Test that local state tracks failures correctly."""
        failing_func = AsyncMock(side_effect=Exception("Service error"))
        
        # First failure
        with pytest.raises(Exception):
            await circuit_breaker_no_redis.call(failing_func)
        
        # Verify failure was tracked locally
        assert circuit_breaker_no_redis._local_state["failure_count"] == 1
        
        # Second failure should open circuit
        with pytest.raises(Exception):
            await circuit_breaker_no_redis.call(failing_func)
        
        assert circuit_breaker_no_redis._local_state["state"] == CircuitState.OPEN