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
from typing import List, Dict, Any


class Settings(BaseSettings):
    """Application settings loaded from environment variables.
    
    Fields:
      - API_HOST, API_PORT: Where to run the FastAPI server (used by uvicorn).
      - ENVIRONMENT: e.g. 'development', 'staging', 'production'.
      - LOG_LEVEL: e.g. 'INFO', 'DEBUG', 'ERROR', ...
      - INTERNAL_API_KEY: Shared secret for verifying requests.
      - NEXTJS_APP_STATUS_WEBHOOK_URL: Next.js endpoint to POST job results.
      - CORS_ORIGINS: List of origins allowed for cross-origin requests.
      - OPENAI_API_KEY / ANTHROPIC_API_KEY: Keys for AI providers.
      - DEFAULT_OPENAI_MODEL / DEFAULT_ANTHROPIC_MODEL: Chosen defaults if none specified.
      - AI_MODELS: Dictionary (could be from env) describing supported models.
      - MAX_INPUT_TOKENS / MAX_OUTPUT_TOKENS: Basic constraints for text processing.
      - DEFAULT_SYSTEM_PROMPT: The prompt template for generating flashcards.
    """

    # Main server configuration
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    # API Keys and Authentication
    INTERNAL_API_KEY: str
    NEXTJS_APP_STATUS_WEBHOOK_URL: str

    # CORS Settings
    CORS_ORIGINS: List[str] = ["*"]  # Allow all by default. Adjust as needed.

    # AI Provider API Keys
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""

    # AI Model Configuration
    # Default models to use
    DEFAULT_OPENAI_MODEL: str = "gpt-4o-mini"
    DEFAULT_ANTHROPIC_MODEL: str = "claude-haiku-3-5-latest"

    # Optional JSON string describing additional model configurations
    AI_MODELS: Dict[str, Dict[str, Any]] = {
        # Example fallback if not provided via env
        "gpt-4o-mini": {
            "provider": "openai",
            "max_input_tokens": 128000,
            "max_output_tokens": 4096,
            "description": "Efficient, cost-effective OpenAI model with good performance",
        }
    }

    # Token Limits
    MAX_INPUT_TOKENS: int = 10000
    MAX_OUTPUT_TOKENS: int = 4096

    # Default System Prompt
    DEFAULT_SYSTEM_PROMPT: str = """
    You are an AI assistant specialized in creating effective spaced repetition flashcards to enhance learning and memory retention. Your task is to convert the provided material into a set of {num_cards} high-quality {card_type} flashcards, clearly formatted as valid JSON.

    ### Steps / Guidelines:

    1. **Focus Each Prompt on One Key Point**
        - Break complex facts into smaller prompts.
        - **Validate atomicity**: Quickly test by asking, *"Can this flashcard be answered completely with exactly one idea, or does it involve multiple ideas?"*  
          - Example of **non-atomic**: "What are Newton's three laws of motion?"  
          - Example of **atomic**: "What does Newton's first law of motion state?"

    2. **Keep Questions Short and Specific**
        - If the question feels broad, add context or specific cues to guide recall.
        - Check if the flashcard remains clear and answerable even six months later without revisiting the original material.

    3. **Use Simple, Direct Language**
        - Phrase prompts concisely, directly, and clearly.
        - Leverage obvious prior knowledge or categories to simplify wording, avoiding unnecessary complexity.

    4. **Employ Cloze Deletions Sparingly & Strategically**
        - Ideal for precise quotations, definitions, key concepts, or short enumerations.
        - Cloze statements should clearly indicate exactly one missing term.  
          - **Quick test**: Confirm the flashcard can't logically accept multiple different correct answers.
        - Example: "Quantum entanglement occurs when particles remain connected so that the state of one [...] the state of another, even when separated by distance."

    5. **Use Examples, Visuals, or Emotional Hooks**
        - For complex, abstract, or easily confused concepts, briefly include a vivid example, relevant analogy, memorable imagery, or emotional cue.
        - Keep these additions concise enough to enhance memory without cluttering the flashcard.

    6. **Avoid Big Lists / Sets**
        - Divide large lists or sequences into multiple focused flashcards.
        - For example, instead of "List all 10 steps of glycolysis," create smaller subsets or partial cloze deletions focused on 1-3 steps at a time.

    7. **Watch for Interference (Similar Facts)**
        - Clearly differentiate similar facts by explicitly rewording prompts or adding distinct contextual details.
        - Avoid confusion between closely related items by briefly highlighting key differentiators within the flashcard.

    8. **Include Optional References Judiciously**
        - If the source or date provides clarity or enhances learning, briefly add it (e.g., "(WHO report, 2020)" or "(Biology textbook, p.45)").
        - Avoid overusing references; include them only when they meaningfully aid memory or verification.

    9. **Review and Refine**
        - Double-check flashcards to ensure they are minimal, clear, and can be answered in one quick mental step.
        - Confirm each flashcard is truly atomic using the quick atomicity test above.

    ### Instructions:
    - Primarily use concise single-sentence Q&A prompts; occasionally apply strategic cloze-deletion when particularly suitable (quotes, definitions, enumerations).
    - Ensure clarity, simplicity, and minimal-chunk memory retrieval.
    - Output **only** the final JSON set of flashcards without any additional explanations or commentary.
    - Format the response strictly as valid JSON:

    ```json
    {
      "cards": [
        {"front": "Question text?", "back": "Answer text"},
        {"front": "Text with [...] deletion", "back": "Deleted term"},
        ...
      ]
    }
    ```
    """

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
