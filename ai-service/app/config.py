"""
@file config.py
@description
  Pydantic-based configuration for the Memoria AI Service.

Key Environment Variables:
  - INTERNAL_API_KEY: Shared secret used to validate requests between Next.js and the AI service.
  - NEXTJS_APP_STATUS_WEBHOOK_URL: Webhook endpoint in the Next.js app for job completion.
  - OPENAI_API_KEY / ANTHROPIC_API_KEY: Credentials for AI providers.
  - DEFAULT_OPENAI_MODEL / DEFAULT_ANTHROPIC_MODEL: Defaults for generation if none provided.
  - AI_MODELS: JSON string of available models and their metadata.
  - API_HOST / API_PORT: Host/port to run the service on (passed to uvicorn).
  - ENVIRONMENT: "development", "staging", "production", etc.
  - LOG_LEVEL: Logging level, e.g., "INFO", "DEBUG", ...
"""

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
    PYDANTIC_V2 = True
except ImportError:
    from pydantic import BaseSettings
    PYDANTIC_V2 = False
    
try:
    from pydantic import Field, field_validator
except ImportError:
    from pydantic import Field, validator

from typing import List, Dict, Any
import json
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Existing settings
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    # API Keys and Authentication
    INTERNAL_API_KEY: str = "test-key-for-development"
    INTERNAL_WEBHOOK_HMAC_SECRET: str = ""
    NEXTJS_APP_STATUS_WEBHOOK_URL: str = "http://localhost:3000/api/webhooks/ai-status"

    # CORS Settings
    CORS_ORIGINS: List[str] = ["*"]  # Allow all by default. Adjust as needed.

    # AI Provider API Keys
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""

    # Feature flags
    USE_QUEUE: bool = False
    ENABLE_FALLBACK: bool = False
    ENABLE_PROGRESS_UPDATES: bool = False
    ENABLE_COST_ACCOUNTING: bool = False
    ENABLE_INBOUND_HMAC: bool = False

    # Concurrency & budgets
    OPENAI_MAX_CONCURRENCY: int = 8
    ANTHROPIC_MAX_CONCURRENCY: int = 8
    TOKENS_PER_CARD_BUDGET: int = 128

    # Infrastructure
    REDIS_URL: str = ""

    # AI Model Configuration
    # Default models to use
    DEFAULT_OPENAI_MODEL: str = "gpt-4o-mini"
    DEFAULT_ANTHROPIC_MODEL: str = "claude-haiku-3-5-latest"

    # Optional JSON string describing additional model configurations
    AI_MODELS: Dict[str, Dict[str, Any]] = Field(default_factory=dict)

    # Token Limits
    MAX_INPUT_TOKENS: int = 10000
    MAX_OUTPUT_TOKENS: int = 4096
    
    # Feature Flags
    ENABLE_PROGRESS_UPDATES: bool = False
    ENABLE_CARD_RETRY: bool = True
    ENABLE_COST_ACCOUNTING: bool = False
    TOKENS_PER_CARD_BUDGET: int = 128
    MIN_CARD_YIELD_RATIO: float = 0.7

    # Concurrency & budgets  
    OPENAI_MAX_CONCURRENCY: int = 8
    ANTHROPIC_MAX_CONCURRENCY: int = 8
    TOKENS_PER_CARD_BUDGET: int = 128

    # Legacy fields for backwards compatibility
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000

    # Validators - handle both Pydantic v1 and v2
    if PYDANTIC_V2:
        @field_validator("AI_MODELS", mode="before")
        @classmethod
        def parse_models(cls, v):
            if isinstance(v, str) and v:
                try:
                    return json.loads(v)
                except json.JSONDecodeError:
                    return {}
            return v or {
                # Example fallback if not provided via env
                "gpt-4o-mini": {
                    "provider": "openai",
                    "max_input_tokens": 128000,
                    "max_output_tokens": 4096,
                    "description": "Efficient, cost-effective OpenAI model with good performance",
                }
            }

        @field_validator("CORS_ORIGINS", mode="before")
        @classmethod
        def parse_cors_origins(cls, v):
            if isinstance(v, str):
                return [origin.strip() for origin in v.split(",")]
            return v

        model_config = SettingsConfigDict(
            env_file=".env.local",
            env_file_encoding="utf-8",
            extra="ignore"
        )
    else:
        @validator("AI_MODELS", pre=True)
        @classmethod
        def parse_models(cls, v):
            if isinstance(v, str) and v:
                try:
                    return json.loads(v)
                except json.JSONDecodeError:
                    return {}
            return v or {
                # Example fallback if not provided via env
                "gpt-4o-mini": {
                    "provider": "openai",
                    "max_input_tokens": 128000,
                    "max_output_tokens": 4096,
                    "description": "Efficient, cost-effective OpenAI model with good performance",
                }
            }

        @validator("CORS_ORIGINS", pre=True)
        @classmethod
        def parse_cors_origins(cls, v):
            if isinstance(v, str):
                return [origin.strip() for origin in v.split(",")]
            return v
        
        class Config:
            env_file = ".env.local"
            env_file_encoding = "utf-8"

# Create a singleton instance
settings = Settings()

def get_model_config(model_name: str = None) -> Dict[str, Any]:
    """
    Get configuration for a specific model or default model based on provider.

    Args:
        model_name: Name of the model to get config for. If None, uses default OpenAI model.

    Returns:
        Dict containing model configuration and metadata (provider, token limits, etc.)
    """
    if not model_name:
        model_name = settings.DEFAULT_OPENAI_MODEL

    # If the model name is recognized in the dictionary, return its data
    if model_name in settings.AI_MODELS:
        return {
            "name": model_name,
            **settings.AI_MODELS[model_name]
        }

    # If not, guess provider from the prefix
    if model_name.startswith("gpt-"):
        provider = "openai"
    elif model_name.startswith("claude-"):
        provider = "anthropic"
    else:
        provider = "openai"

    # Provide a fallback config using the service-level default token limits
    return {
        "name": model_name,
        "provider": provider,
        "max_input_tokens": settings.MAX_INPUT_TOKENS,
        "max_output_tokens": settings.MAX_OUTPUT_TOKENS,
        "description": "Custom model"
    }