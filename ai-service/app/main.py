import logging
import json
from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.v1 import ai_tasks, health, admin
from app.core.config_validator import validate_configuration, log_configuration

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

    @app.get("/")
    async def root():
        return {"message": "Welcome to Memoria AI Service"}

    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return {"status": "ok"}

    # Include API routers
    app.include_router(ai_tasks.router, prefix="/api/v1", tags=["AI Tasks"])
    app.include_router(health.router, prefix="/api/v1", tags=["Health"])
    app.include_router(admin.router, tags=["Admin"])

    @app.on_event("startup")
    async def startup_event():
        log_configuration()
        issues = validate_configuration()
        
        for issue in issues:
            if issue.startswith("ERROR"):
                logging.error(issue)
            else:
                logging.warning(issue)
        
        # Fail startup if critical errors
        errors = [i for i in issues if i.startswith("ERROR")]
        if errors:
            raise RuntimeError(f"Configuration errors: {', '.join(errors)}")
    
    return app

app = create_app() 
