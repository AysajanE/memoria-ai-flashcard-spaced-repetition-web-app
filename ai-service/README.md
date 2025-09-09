# Memoria AI Service

Production-ready FastAPI service for AI-powered flashcard generation with Redis queuing, circuit breakers, and comprehensive observability.

## Features

- 🤖 Multi-provider AI support (OpenAI, Anthropic)
- 🚀 Redis-backed job queuing with RQ
- 🔒 HMAC request/response verification
- 🔄 Automatic failover and circuit breakers
- 📊 Prometheus metrics and Sentry monitoring
- 🧪 Comprehensive test suite
- 🐳 Production Docker configuration

## Quick Start

### Development Setup

```bash
# Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Start Redis
docker-compose up redis

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Start development server
uvicorn app.main:app --reload

# Start worker (in another terminal)
python -m workers.ai_worker
```

### Production Deployment

```bash
# Build and deploy with Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# Scale workers as needed
docker-compose -f docker-compose.prod.yml up -d --scale ai-worker=3
```

## Environment Variables

### Required
- `INTERNAL_API_KEY` - Shared secret for internal service communication
- `NEXTJS_APP_STATUS_WEBHOOK_URL` - Webhook endpoint in Next.js app for job completion
- `OPENAI_API_KEY` - OpenAI API key (optional if using only Anthropic)
- `ANTHROPIC_API_KEY` - Anthropic API key (optional if using only OpenAI)

### Optional Feature Flags
- `USE_QUEUE=true` - Enable Redis queuing (recommended for production)
- `ENABLE_FALLBACK=true` - Enable model fallback on errors
- `ENABLE_PROGRESS_UPDATES=true` - Send progress webhooks for long jobs
- `ENABLE_COST_ACCOUNTING=true` - Include cost estimates in responses
- `ENABLE_INBOUND_HMAC=true` - Verify incoming request signatures

### Scaling & Performance
- `OPENAI_MAX_CONCURRENCY=8` - Max concurrent OpenAI requests
- `ANTHROPIC_MAX_CONCURRENCY=8` - Max concurrent Anthropic requests
- `TOKENS_PER_CARD_BUDGET=128` - Token budget per flashcard
- `MAX_OUTPUT_TOKENS=4096` - Maximum output tokens per request

### Infrastructure
- `REDIS_URL=redis://localhost:6379/0` - Redis connection string
- `CORS_ORIGINS=http://localhost:3000` - Allowed CORS origins (comma-separated)
- `API_HOST=0.0.0.0` - Host to bind the service to
- `API_PORT=8000` - Port to run the service on

### Monitoring (Optional)
- `SENTRY_DSN` - Sentry error tracking DSN
- `LOG_LEVEL=INFO` - Logging level (DEBUG, INFO, WARNING, ERROR)
- `ENABLE_METRICS=true` - Enable Prometheus metrics
- `ENVIRONMENT=development` - Environment name (development, staging, production)

## API Endpoints

### Core Endpoints
- `POST /api/v1/generate-cards` - Generate flashcards asynchronously
- `GET /health` - Basic health check
- `GET /ready` - Readiness check (includes dependencies)
- `GET /metrics` - Prometheus metrics

### Admin Endpoints (require `X-Internal-API-Key`)
- `GET /api/v1/admin/queue-status` - Queue statistics
- `GET /api/v1/admin/concurrency-stats` - AI provider concurrency
- `GET /api/v1/admin/circuit-breaker-status` - Circuit breaker states
- `GET /api/v1/admin/fallback-stats` - Model fallback statistics
- `POST /api/v1/preview/cards` - Generate preview cards (no webhook)
- `POST /api/v1/preview/tokenize` - Analyze text and chunking

## Architecture

### Components
- **FastAPI Application** - HTTP API server
- **RQ Workers** - Background job processing
- **Redis** - Queue storage and caching
- **AI Providers** - OpenAI and Anthropic APIs

### Request Flow
1. Client sends flashcard generation request
2. Request validated and job queued (or background task)
3. Worker processes job with AI provider
4. Results sent via webhook to client
5. Metrics and logs recorded

### Reliability Features
- **Circuit Breakers** - Prevent cascade failures to AI providers
- **Model Fallback** - Automatic failover between AI models
- **Request Deduplication** - Prevent duplicate processing
- **Retry Logic** - Automatic retries with exponential backoff

## Testing

### Running Tests

```bash
# Unit tests
pytest tests/ -v

# Coverage report
pytest tests/ --cov=app --cov-report=html

# Integration tests only
pytest tests/test_api_integration.py -v

# Load testing
python tests/load_test.py --scenario light

# Load test with custom parameters
python tests/load_test.py --concurrent 20 --duration 60
```

### Test Structure

- `tests/test_core_functionality.py` - Unit tests for core logic
- `tests/test_api_integration.py` - API endpoint integration tests
- `tests/test_webhook_contracts.py` - Webhook payload validation tests
- `tests/load_test.py` - Performance and load testing utility
- `tests/conftest.py` - Shared test fixtures and configuration

## Monitoring & Observability

### Metrics
Available at `/metrics` endpoint:
- `ai_requests_total` - AI API request counts by provider/model/status
- `ai_request_duration_seconds` - Request latency histograms
- `ai_tokens_used_total` - Token consumption tracking
- `ai_cost_usd_total` - Cost tracking by provider/model
- `queue_size` - Current queue length
- `circuit_breaker_state` - Circuit breaker status

### Logging
- Structured JSON logs in production
- Request correlation via `jobId`
- AI provider performance tracking
- Error categorization and suggested actions

## Troubleshooting

### Common Issues

**Queue not processing jobs**
```bash
# Check worker status
docker-compose logs ai-worker

# Check Redis connectivity
redis-cli -u $REDIS_URL ping

# Restart workers
docker-compose restart ai-worker
```

**High error rates**
```bash
# Check circuit breaker status
curl -H "X-Internal-API-Key: $INTERNAL_API_KEY" \
     http://localhost:8000/api/v1/admin/circuit-breaker-status
```

## API Documentation

Once the server is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc 
