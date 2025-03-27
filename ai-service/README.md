# Memoria AI Service

This is the AI service component of the Memoria flashcard generation application. It handles AI interactions for text processing and flashcard generation.

## Setup

1. Create and activate a virtual environment:
```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Copy `.env.example` to `.env.local` and update the values:
```bash
cp .env.example .env.local
```

4. Run the development server:
```bash
uvicorn app.main:app --reload
```

## Development

- Format code: `black .`
- Lint code: `flake8`

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