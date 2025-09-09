import pytest
from unittest.mock import MagicMock
from app.core.deduplication import JobDeduplicator

@pytest.fixture
def mock_redis():
    return MagicMock()

@pytest.fixture
def deduplicator(mock_redis):
    return JobDeduplicator(mock_redis)

def test_mark_started_success(deduplicator, mock_redis):
    mock_redis.setnx.return_value = True
    
    result = deduplicator.mark_started("job123")
    
    assert result is True
    mock_redis.setnx.assert_called_once_with("inflight:job123", "1")
    mock_redis.expire.assert_called_once_with("inflight:job123", 3600)

def test_mark_started_duplicate(deduplicator, mock_redis):
    mock_redis.setnx.return_value = False
    
    result = deduplicator.mark_started("job123")
    
    assert result is False
    mock_redis.expire.assert_not_called()