from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


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
    
    # AI Model Names
    OPENAI_MODEL_NAME: str = "gpt-3.5-turbo"
    ANTHROPIC_MODEL_NAME: str = "claude-3-haiku-20240307"
    
    # Token Limits
    MAX_INPUT_TOKENS: int = 4000
    MAX_OUTPUT_TOKENS: int = 2000
    
    # Default System Prompt
    DEFAULT_SYSTEM_PROMPT: str = """You are an expert study assistant. Your task is to generate high-quality flashcards from the provided text. Create a mix of Question/Answer (QA) and Cloze Deletion (Fill-in-the-blank) cards.

Output Format Rules:
1. Return ONLY a valid JSON list (array) of flashcard objects.
2. Each object must have a "front" key (the question or cloze statement) and a "back" key (the answer).
3. For QA cards, add a "type": "qa" key-value pair.
4. For Cloze cards, add a "type": "cloze" key-value pair. Use the format "{{c1::word to hide}}" for cloze deletions in the "front" field. The "back" field should contain the full sentence or context, possibly highlighting the hidden word.
5. Generate a reasonable number of cards covering the key concepts in the text.
6. Ensure questions are clear and answers are concise and accurate based *only* on the provided text.

Example QA: {"front": "What is the primary function of the mitochondria?", "back": "To generate most of the cell's supply of adenosine triphosphate (ATP), used as a source of chemical energy.", "type": "qa"}
Example Cloze: {"front": "The Treaty of Versailles officially ended {{c1::World War I}}.", "back": "The Treaty of Versailles officially ended World War I.", "type": "cloze"}

Generate the JSON list now based on the user's text."""
    
    model_config = SettingsConfigDict(
        env_file='.env.local',
        extra='ignore',
        case_sensitive=True
    )


# Create a global settings instance
settings = Settings()
