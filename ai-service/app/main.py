import logging
import json
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.v1 import ai_tasks, admin
from app.core.ai_clients import validate_clients

class JSONFormatter(logging.Formatter):
    """Custom JSON formatter for structured logging"""
    _std = {
        'name','msg','args','levelname','levelno','pathname','filename','module','exc_info',
        'exc_text','stack_info','lineno','funcName','created','msecs','relativeCreated','thread',
        'threadName','processName','process'
    }
    def format(self, record):
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        # Merge any extra attributes
        for k, v in record.__dict__.items():
            if k not in self._std and not k.startswith('_'):
                log_data[k] = v
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_data)

def setup_logging():
    """Configure structured JSON logging"""
    # Create logger
    logger = logging.getLogger()
    # Honor LOG_LEVEL
    level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    logger.setLevel(level)

    # Create console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(JSONFormatter())

    # Reset handlers to avoid duplicate logs in reload
    logger.handlers = []
    logger.addHandler(console_handler)

    # Set logging level for uvicorn
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

def create_app() -> FastAPI:
    """Create and configure FastAPI application"""
    # Set up logging
    setup_logging()
    
    # Create FastAPI app
    app = FastAPI(
        title="Memoria AI Service",
        description="AI service for Memoria flashcard generation",
        version="0.1.0"
    )
    
    # Configure CORS
    allow_origins = settings.CORS_ORIGINS or []
    allow_credentials = True
    # If wildcard origins or empty, disable credentials for safety
    if not allow_origins or "*" in allow_origins:
        allow_credentials = False
        if not allow_origins:
            allow_origins = ["*"]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    async def startup_event():
        logger = logging.getLogger(__name__)
        
        # Log configuration summary (without secrets)
        config_summary = {
            "environment": settings.ENVIRONMENT,
            "openai_max_concurrency": settings.OPENAI_MAX_CONCURRENCY,
            "anthropic_max_concurrency": settings.ANTHROPIC_MAX_CONCURRENCY,
            "tokens_per_card_budget": settings.TOKENS_PER_CARD_BUDGET,
            "cors_origins": settings.CORS_ORIGINS,
            "has_openai_key": bool(settings.OPENAI_API_KEY),
            "has_anthropic_key": bool(settings.ANTHROPIC_API_KEY),
        }
        logger.info("Configuration loaded", extra=config_summary)
        
        # Validate AI clients
        try:
            validate_clients()
            logger.info("AI clients validated successfully")
        except Exception as e:
            logger.error(f"AI client validation failed: {e}")
            if settings.ENVIRONMENT == "production":
                raise

    @app.get("/")
    async def root():
        return {"message": "Welcome to Memoria AI Service"}

    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return {"status": "ok"}

    # Include API routers
    app.include_router(ai_tasks.router, prefix="/api/v1", tags=["AI Tasks"])
    app.include_router(admin.router, tags=["Admin"])
    
    return app

app = create_app() 
