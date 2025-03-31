from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Dict, Any


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Environment and logging
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    
    # API Keys and Authentication
    INTERNAL_API_KEY: str
    NEXTJS_APP_STATUS_WEBHOOK_URL: str
    
    # CORS Settings
    CORS_ORIGINS: List[str] = ["*"]
    
    # AI Provider API Keys
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    
    # AI Model Configuration
    # Default models to use
    DEFAULT_OPENAI_MODEL: str = "gpt-4o-mini"
    DEFAULT_ANTHROPIC_MODEL: str = "claude-haiku-3-5-latest"
    
    # All available models
    AI_MODELS: Dict[str, Dict[str, Any]] = {
        # OpenAI models
        "gpt-4o-mini": {
            "provider": "openai",
            "max_input_tokens": 128000,
            "max_output_tokens": 4096,
            "description": "Efficient, cost-effective OpenAI model with good performance"
        },
        "gpt-3.5-turbo": {
            "provider": "openai",
            "max_input_tokens": 16385,
            "max_output_tokens": 4096,
            "description": "Legacy model, prefer gpt-4o-mini for better performance"
        },
        # Anthropic models
        "claude-haiku-3-5-latest": {
            "provider": "anthropic",
            "max_input_tokens": 200000,
            "max_output_tokens": 4096,
            "description": "Fast, efficient Anthropic model suitable for most tasks"
        }
    }
    
    # Token Limits
    MAX_INPUT_TOKENS: int = 4000
    MAX_OUTPUT_TOKENS: int = 2000
    
    # Default System Prompt
    DEFAULT_SYSTEM_PROMPT: str = """
    You are a helpful AI assistant that creates educational flashcards.
    
    Your task is to convert the provided text into a set of {num_cards} high-quality {card_type} flashcards.
    
    For "qa" cards, produce a JSON array with objects containing "front" (question) and "back" (answer) fields.
    For "cloze" cards, create "front" with [...] for the deleted term and "back" with just the deleted term.
    
    Make each card concise, focused on one concept, and educational. Prioritize key concepts.
    
    Format your response as valid JSON:
    {
      "cards": [
        {"front": "Question text?", "back": "Answer text"},
        ...
      ]
    }
    """
    
    class Config:
        env_file = ".env.local"
        env_file_encoding = "utf-8"

# Create a singleton instance
settings = Settings()

# Helper function to get model configuration
def get_model_config(model_name: str = None) -> Dict[str, Any]:
    """Get configuration for a specific model or default model based on provider.
    
    Args:
        model_name: Name of the model to get config for. If None, uses default OpenAI model.
        
    Returns:
        Dict containing model configuration
    """
    if not model_name:
        model_name = settings.DEFAULT_OPENAI_MODEL
        
    # If model exists in our configuration, return its config
    if model_name in settings.AI_MODELS:
        return {
            "name": model_name,
            **settings.AI_MODELS[model_name]
        }
    
    # If model doesn't exist, determine provider based on model name
    if model_name.startswith("gpt-"):
        provider = "openai"
    elif model_name.startswith("claude-"):
        provider = "anthropic"
    else:
        # Default to OpenAI if we can't determine
        provider = "openai"
        
    # Return a basic config with some safe defaults
    return {
        "name": model_name,
        "provider": provider,
        "max_input_tokens": settings.MAX_INPUT_TOKENS,
        "max_output_tokens": settings.MAX_OUTPUT_TOKENS,
        "description": "Custom model"
    }
