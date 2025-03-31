# Memoria AI Service

This is the AI service component of the Memoria flashcard application. It handles AI-powered flashcard generation and text processing using OpenAI and Anthropic models.

## Features

- Text processing and flashcard generation
- Support for multiple AI providers (OpenAI and Anthropic)
- Configurable model selection
- Asynchronous job processing with webhooks for status updates

## AI Models

The service is configured to use the following default models:

- **OpenAI**: `gpt-4o-mini` - A cost-effective model with excellent performance
- **Anthropic**: `claude-3-haiku` - A fast, efficient model suitable for most tasks

These can be changed in the `.env.local` file.

## Configuration

1. Copy `.env.example` to `.env.local` and fill in your API keys
2. Adjust model settings as needed:
   - `DEFAULT_OPENAI_MODEL` - The default OpenAI model to use
   - `DEFAULT_ANTHROPIC_MODEL` - The default Anthropic model to use

## API Endpoints

### `/api/v1/generate-cards`

Triggers flashcard generation for a given text input.

**Request:**
```json
{
  "jobId": "uuid-string",
  "text": "Input text to generate cards from",
  "model": "gpt-4o-mini",  // Optional: defaults to DEFAULT_OPENAI_MODEL if not specified
  "cardType": "qa",        // Optional: "qa" or "cloze"
  "numCards": 10,          // Optional: number of cards to generate
  "config": {}             // Optional: additional configuration
}
```

**Response:** `202 Accepted` with jobId if successful

### `/api/v1/available-models`

Returns information about available AI models.

**Response:**
```json
{
  "models": {
    "gpt-4o-mini": {
      "provider": "openai",
      "description": "Efficient, cost-effective OpenAI model",
      "maxInputTokens": 128000,
      "maxOutputTokens": 4096,
      "isDefault": true
    },
    "claude-haiku-3-5-latest": {
      "provider": "anthropic",
      "description": "Fast, efficient Anthropic model",
      "maxInputTokens": 200000,
      "maxOutputTokens": 4096,
      "isDefault": true
    }
  },
  "defaultOpenAI": "gpt-4o-mini",
  "defaultAnthropic": "claude-haiku-3-5-latest"
}
```

## Development

### Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn app.main:app --reload
```

### Adding New Models

To add a new model, update the `AI_MODELS` dictionary in `app/config.py`:

```python
AI_MODELS: Dict[str, Dict[str, Any]] = {
    "new-model-name": {
        "provider": "openai",  # or "anthropic" or another provider
        "max_input_tokens": 32000,
        "max_output_tokens": 4096,
        "description": "Description of the model"
    },
    # Other models...
}
```

## Docker

Build and run with Docker:
```bash
docker build -t memoria-ai-service .
docker run -p 8000:80 memoria-ai-service
```

## API Documentation

Once the server is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc 