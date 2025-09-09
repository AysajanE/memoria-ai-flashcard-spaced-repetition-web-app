import logging
import sys
import json
from datetime import datetime
from typing import Dict, Any
from app.config import settings


class JSONFormatter(logging.Formatter):
    """Custom JSON formatter for structured logging."""
    
    def __init__(self):
        super().__init__()
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON."""
        
        # Base log entry
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        # Add process/thread info
        if hasattr(record, 'process'):
            log_entry["process"] = record.process
        if hasattr(record, 'thread'):
            log_entry["thread"] = record.thread
        
        # Add extra fields if present
        extra_fields = [
            'jobId', 'model', 'provider', 'cost_usd', 'tokens_used',
            'duration', 'status', 'card_count', 'user_id', 'request_id',
            'queue_length', 'retry_attempt', 'fallback_model'
        ]
        
        for field in extra_fields:
            if hasattr(record, field):
                log_entry[field] = getattr(record, field)
        
        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                "traceback": self.formatException(record.exc_info)
            }
        
        # Add stack trace if present (for warnings/errors without exceptions)
        if record.stack_info:
            log_entry["stack_trace"] = record.stack_info
        
        return json.dumps(log_entry, default=str, ensure_ascii=False)


class StructuredLogger:
    """Helper class for structured logging with common fields."""
    
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
    
    def _log_with_context(self, level: int, message: str, **context):
        """Log message with structured context."""
        # Create a custom record with extra context
        if context:
            extra = {k: v for k, v in context.items() if v is not None}
            self.logger.log(level, message, extra=extra)
        else:
            self.logger.log(level, message)
    
    def debug(self, message: str, **context):
        """Debug level logging with context."""
        self._log_with_context(logging.DEBUG, message, **context)
    
    def info(self, message: str, **context):
        """Info level logging with context."""
        self._log_with_context(logging.INFO, message, **context)
    
    def warning(self, message: str, **context):
        """Warning level logging with context."""
        self._log_with_context(logging.WARNING, message, **context)
    
    def error(self, message: str, **context):
        """Error level logging with context.""" 
        self._log_with_context(logging.ERROR, message, **context)
    
    def critical(self, message: str, **context):
        """Critical level logging with context."""
        self._log_with_context(logging.CRITICAL, message, **context)
    
    def log_ai_request(self, message: str, provider: str, model: str, 
                      duration: float = None, tokens_used: int = None,
                      cost_usd: float = None, status: str = "success", **extra):
        """Log AI API request with standard context."""
        context = {
            "provider": provider,
            "model": model,
            "duration": duration,
            "tokens_used": tokens_used,
            "cost_usd": cost_usd,
            "status": status,
            **extra
        }
        self.info(message, **context)
    
    def log_job_processing(self, message: str, job_id: str, 
                          duration: float = None, card_count: int = None,
                          status: str = None, **extra):
        """Log job processing with standard context."""
        context = {
            "jobId": job_id,
            "duration": duration,
            "card_count": card_count,
            "status": status,
            **extra
        }
        self.info(message, **context)
    
    def log_webhook_delivery(self, message: str, job_id: str, 
                           webhook_status: int = None, duration: float = None,
                           retry_attempt: int = None, **extra):
        """Log webhook delivery with standard context."""
        context = {
            "jobId": job_id,
            "webhook_status": webhook_status,
            "duration": duration,
            "retry_attempt": retry_attempt,
            **extra
        }
        self.info(message, **context)
    
    def log_error(self, message: str, error: Exception = None, 
                 job_id: str = None, **extra):
        """Log error with standard context and exception info."""
        context = {
            "jobId": job_id,
            **extra
        }
        
        if error:
            self.logger.error(message, extra=context, exc_info=True)
        else:
            self.error(message, **context)


def setup_logging():
    """Configure structured logging for the application."""
    
    # Get log level from settings
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    
    # Root logger configuration
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    
    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # Console handler with appropriate formatting
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    
    # Use JSON formatting in production, simple formatting in development
    if settings.ENVIRONMENT.lower() == "production":
        formatter = JSONFormatter()
    else:
        # Use colorized formatter for development if available
        try:
            import colorlog
            formatter = colorlog.ColoredFormatter(
                "%(log_color)s%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
                log_colors={
                    'DEBUG': 'cyan',
                    'INFO': 'green', 
                    'WARNING': 'yellow',
                    'ERROR': 'red',
                    'CRITICAL': 'red,bg_white',
                }
            )
        except ImportError:
            # Fallback to basic formatting
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                datefmt="%Y-%m-%d %H:%M:%S"
            )
    
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
    
    # Configure specific logger levels
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)
    
    # Set our application loggers
    logging.getLogger("app").setLevel(log_level)
    
    # Create initial log entry
    logger = StructuredLogger(__name__)
    logger.info("Logging configuration completed", 
               environment=settings.ENVIRONMENT,
               log_level=settings.LOG_LEVEL)


def get_logger(name: str) -> StructuredLogger:
    """Get a structured logger instance."""
    return StructuredLogger(name)


# Convenience function for logging with request context
class RequestContextLogger:
    """Logger that automatically includes request context."""
    
    def __init__(self, logger: StructuredLogger, request_id: str = None, 
                 job_id: str = None, user_id: str = None):
        self.logger = logger
        self.request_id = request_id
        self.job_id = job_id
        self.user_id = user_id
    
    def _add_context(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Add request context to logging context."""
        base_context = {}
        if self.request_id:
            base_context["request_id"] = self.request_id
        if self.job_id:
            base_context["jobId"] = self.job_id
        if self.user_id:
            base_context["user_id"] = self.user_id
        
        return {**base_context, **context}
    
    def info(self, message: str, **context):
        """Info logging with request context."""
        self.logger.info(message, **self._add_context(context))
    
    def warning(self, message: str, **context):
        """Warning logging with request context."""
        self.logger.warning(message, **self._add_context(context))
    
    def error(self, message: str, error: Exception = None, **context):
        """Error logging with request context."""
        if error:
            self.logger.log_error(message, error, **self._add_context(context))
        else:
            self.logger.error(message, **self._add_context(context))
    
    def debug(self, message: str, **context):
        """Debug logging with request context."""
        self.logger.debug(message, **self._add_context(context))


# Pre-configured loggers for common use cases
def get_api_logger() -> StructuredLogger:
    """Get logger for API endpoints."""
    return get_logger("app.api")

def get_core_logger() -> StructuredLogger:
    """Get logger for core functionality."""
    return get_logger("app.core")

def get_worker_logger() -> StructuredLogger:
    """Get logger for background workers."""
    return get_logger("app.worker")

def get_webhook_logger() -> StructuredLogger:
    """Get logger for webhook operations."""
    return get_logger("app.webhook")


# Logging decorators
def log_function_call(logger: StructuredLogger = None):
    """Decorator to log function calls with timing."""
    import time
    from functools import wraps
    
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            nonlocal logger
            if logger is None:
                logger = get_core_logger()
            
            start_time = time.time()
            function_name = f"{func.__module__}.{func.__name__}"
            
            logger.debug(f"Calling {function_name}", 
                        function=function_name)
            
            try:
                result = func(*args, **kwargs)
                duration = time.time() - start_time
                logger.debug(f"Completed {function_name}", 
                           function=function_name,
                           duration=duration)
                return result
            except Exception as e:
                duration = time.time() - start_time
                logger.error(f"Failed {function_name}", 
                           error=e,
                           function=function_name,
                           duration=duration)
                raise
        
        return wrapper
    return decorator


async def log_async_function_call(logger: StructuredLogger = None):
    """Decorator to log async function calls with timing."""
    import time
    from functools import wraps
    
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            nonlocal logger
            if logger is None:
                logger = get_core_logger()
            
            start_time = time.time()
            function_name = f"{func.__module__}.{func.__name__}"
            
            logger.debug(f"Calling {function_name}", 
                        function=function_name)
            
            try:
                result = await func(*args, **kwargs)
                duration = time.time() - start_time
                logger.debug(f"Completed {function_name}", 
                           function=function_name,
                           duration=duration)
                return result
            except Exception as e:
                duration = time.time() - start_time
                logger.error(f"Failed {function_name}", 
                           error=e,
                           function=function_name,
                           duration=duration)
                raise
        
        return wrapper
    return decorator