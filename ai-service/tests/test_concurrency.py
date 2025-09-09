import pytest
import asyncio
from app.core.metrics import ConcurrencyTracker

@pytest.mark.asyncio
async def test_concurrency_tracking():
    tracker = ConcurrencyTracker()
    
    async with tracker.track_request("test_provider"):
        stats = await tracker.get_stats()
        assert stats["active_requests"]["test_provider"] == 1
    
    final_stats = await tracker.get_stats()
    assert final_stats["active_requests"]["test_provider"] == 0
    assert final_stats["total_requests"]["test_provider"] == 1

@pytest.mark.asyncio
async def test_multiple_concurrent_requests():
    tracker = ConcurrencyTracker()
    
    async def mock_request(provider: str, duration: float):
        async with tracker.track_request(provider):
            await asyncio.sleep(duration)
    
    # Start multiple concurrent requests
    tasks = [
        asyncio.create_task(mock_request("openai", 0.1)),
        asyncio.create_task(mock_request("openai", 0.1)),
        asyncio.create_task(mock_request("anthropic", 0.1)),
    ]
    
    # Wait a bit then check active requests
    await asyncio.sleep(0.05)
    stats = await tracker.get_stats()
    assert stats["active_requests"]["openai"] == 2
    assert stats["active_requests"]["anthropic"] == 1
    
    # Wait for completion
    await asyncio.gather(*tasks)
    
    final_stats = await tracker.get_stats()
    assert final_stats["active_requests"]["openai"] == 0
    assert final_stats["active_requests"]["anthropic"] == 0
    assert final_stats["total_requests"]["openai"] == 2
    assert final_stats["total_requests"]["anthropic"] == 1

@pytest.mark.asyncio
async def test_average_wait_time_calculation():
    tracker = ConcurrencyTracker()
    
    # Simulate a request with known duration
    async with tracker.track_request("test_provider"):
        await asyncio.sleep(0.1)
    
    stats = await tracker.get_stats()
    # Average wait time should be around 0.1 seconds (with some tolerance)
    assert 0.09 <= stats["avg_wait_time"]["test_provider"] <= 0.15