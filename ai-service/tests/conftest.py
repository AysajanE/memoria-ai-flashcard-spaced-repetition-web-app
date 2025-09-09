import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
import sys
import os

# Add the ai-service directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Set test environment variables before importing app
os.environ.setdefault("INTERNAL_API_KEY", "test-key")
os.environ.setdefault("NEXTJS_APP_STATUS_WEBHOOK_URL", "http://localhost:3000/api/webhooks/ai-status")
os.environ.setdefault("ENVIRONMENT", "test")

@pytest.fixture
def client():
    """Create a FastAPI test client."""
    # Import here to avoid import issues during test discovery
    from app.main import app
    return TestClient(app)

@pytest.fixture
def mock_settings():
    """Mock settings for testing."""
    with patch('app.config.settings') as mock:
        mock.INTERNAL_API_KEY = "test-key"
        mock.OPENAI_API_KEY = "test-openai-key"
        mock.ANTHROPIC_API_KEY = "test-anthropic-key"
        mock.NEXTJS_APP_STATUS_WEBHOOK_URL = "http://localhost:3000/webhook"
        mock.ENVIRONMENT = "test"
        mock.LOG_LEVEL = "INFO"
        mock.MAX_INPUT_TOKENS = 4000
        mock.MAX_OUTPUT_TOKENS = 1000
        yield mock

@pytest.fixture
def sample_text():
    """Sample text for testing text processing."""
    return """
    Python is a high-level, interpreted programming language with dynamic semantics. 
    Its high-level built-in data structures, combined with dynamic typing and dynamic binding, 
    make it very attractive for Rapid Application Development, as well as for use as a 
    scripting or glue language to connect existing components together.
    
    Python's simple, easy to learn syntax emphasizes readability and therefore reduces the 
    cost of program maintenance. Python supports modules and packages, which encourages 
    program modularity and code reuse.
    """

@pytest.fixture
def sample_cards():
    """Sample flashcards for testing."""
    return [
        {"front": "What is Python?", "back": "A high-level interpreted programming language", "type": "qa"},
        {"front": "What makes Python attractive for RAD?", "back": "High-level data structures and dynamic typing", "type": "qa"},
        {"front": "Python supports [...] and packages", "back": "modules", "type": "cloze"}
    ]

@pytest.fixture
def mock_openai_response():
    """Mock OpenAI API response."""
    return {
        "content": '{"cards": [{"front": "What is Python?", "back": "A programming language"}]}',
        "usage": {
            "prompt_tokens": 100,
            "completion_tokens": 50,
            "total_tokens": 150
        }
    }

@pytest.fixture
def mock_redis():
    """Mock Redis client."""
    from unittest.mock import Mock
    mock = Mock()
    mock.ping.return_value = True
    mock.get.return_value = None
    mock.set.return_value = True
    mock.delete.return_value = True
    mock.exists.return_value = 0
    mock.setnx.return_value = True
    mock.expire.return_value = True
    mock.incr.return_value = 1
    mock.keys.return_value = []
    return mock
