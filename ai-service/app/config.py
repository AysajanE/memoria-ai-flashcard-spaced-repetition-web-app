from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Environment and logging
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    
    # API Keys and Authentication
    INTERNAL_API_KEY: str
    NEXTJS_APP_STATUS_WEBHOOK_URL: str
    
    # AI Provider API Keys
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    
    # AI Model Names
    OPENAI_MODEL_NAME: str = "gpt-3.5-turbo"
    ANTHROPIC_MODEL_NAME: str = "claude-3-haiku-20240307"
    
    model_config = SettingsConfigDict(
        env_file='.env.local',
        extra='ignore',
        case_sensitive=True
    )


# Create a global settings instance
settings = Settings()
