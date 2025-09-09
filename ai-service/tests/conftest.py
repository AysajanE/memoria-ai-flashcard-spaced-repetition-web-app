import pytest
import os
from fastapi.testclient import TestClient

# Set test environment variables before importing app
os.environ.setdefault("INTERNAL_API_KEY", "test-key")
os.environ.setdefault("NEXTJS_APP_STATUS_WEBHOOK_URL", "http://localhost:3000/api/webhooks/ai-status")
os.environ.setdefault("ENVIRONMENT", "test")

from app.main import app

@pytest.fixture
def client():
    return TestClient(app)