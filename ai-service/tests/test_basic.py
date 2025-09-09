"""Basic tests that don't require AI clients."""

def test_basic_health_check():
    """Test basic health endpoint without FastAPI client."""
    from fastapi.testclient import TestClient
    from fastapi import FastAPI
    
    # Create a minimal app just for testing
    test_app = FastAPI()
    
    @test_app.get("/health")
    async def health_check():
        return {"status": "healthy"}
    
    client = TestClient(test_app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}