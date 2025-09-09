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

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator
from typing import List, Dict, Any
import json
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Existing settings
    ENVIRONMENT: str = "development"
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    INTERNAL_WEBHOOK_HMAC_SECRET: str = ""
    MAX_OUTPUT_TOKENS: int = 2048

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
    CORS_ORIGINS: List[str] = Field(default_factory=lambda: ["*"])

    # AI Models configuration
    AI_MODELS: Dict[str, Dict[str, Any]] = Field(default_factory=dict)

    # Legacy fields for backwards compatibility
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    LOG_LEVEL: str = "INFO"
    INTERNAL_API_KEY: str
    NEXTJS_APP_STATUS_WEBHOOK_URL: str
    DEFAULT_OPENAI_MODEL: str = "gpt-4o-mini"
    DEFAULT_ANTHROPIC_MODEL: str = "claude-haiku-3-5-latest"
    MAX_INPUT_TOKENS: int = 10000

    @field_validator("AI_MODELS", mode="before")
    @classmethod
    def parse_models(cls, v):
        if isinstance(v, str) and v:
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return {}
        return v or {}

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
