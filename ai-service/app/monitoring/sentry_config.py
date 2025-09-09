import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.redis import RedisIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations.asyncio import AsyncioIntegration
from sentry_sdk.integrations.httpx import HttpxIntegration
from app.config import settings
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


def setup_sentry():
    """Configure Sentry error tracking."""
    
    if not settings.SENTRY_DSN:
        logger.info("Sentry DSN not configured, skipping error tracking setup")
        return
    
    # Configure logging integration
    sentry_logging = LoggingIntegration(
        level=logging.INFO,        # Capture info and above as breadcrumbs
        event_level=logging.ERROR  # Send errors as events
    )
    
    # Determine sample rate based on environment
    traces_sample_rate = 0.1 if settings.ENVIRONMENT == "production" else 1.0
    
    try:
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENVIRONMENT,
            release=f"ai-service@1.0.0",
            integrations=[
                FastApiIntegration(auto_enable=True),
                RedisIntegration(),
                AsyncioIntegration(),
                HttpxIntegration(),
                sentry_logging
            ],
            traces_sample_rate=traces_sample_rate,
            send_default_pii=False,  # Don't send personal data
            attach_stacktrace=True,
            before_send=filter_sensitive_data,
            before_send_transaction=filter_sensitive_transactions
        )
        
        # Set global tags
        sentry_sdk.set_tag("service", "ai-service")
        sentry_sdk.set_tag("environment", settings.ENVIRONMENT)
        
        logger.info("Sentry error tracking configured", 
                   extra={"environment": settings.ENVIRONMENT, 
                         "sample_rate": traces_sample_rate})
                         
    except Exception as e:
        logger.error(f"Failed to initialize Sentry: {e}")


def filter_sensitive_data(event: Dict[str, Any], hint: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Filter sensitive data from Sentry events."""
    
    # Remove API keys and secrets from environment variables
    if 'contexts' in event and 'os' in event['contexts']:
        env_vars = event['contexts']['os'].get('env', {})
        sensitive_keys = [
            'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'INTERNAL_API_KEY',
            'INTERNAL_WEBHOOK_HMAC_SECRET', 'SENTRY_DSN', 'REDIS_URL'
        ]
        
        for key in sensitive_keys:
            if key in env_vars:
                env_vars[key] = '[Filtered]'
    
    # Filter sensitive data from request data
    if 'request' in event:
        request = event['request']
        
        # Filter headers
        if 'headers' in request:
            headers = request['headers']
            sensitive_headers = [
                'authorization', 'x-internal-api-key', 'x-api-key',
                'cookie', 'x-auth-token'
            ]
            for header in sensitive_headers:
                if header in headers:
                    headers[header] = '[Filtered]'
                # Case-insensitive check
                for h in list(headers.keys()):
                    if h.lower() in sensitive_headers:
                        headers[h] = '[Filtered]'
        
        # Filter URL parameters
        if 'query_string' in request and request['query_string']:
            # Basic filtering of common sensitive params
            if any(param in request['query_string'].lower() 
                  for param in ['key=', 'token=', 'secret=']):
                request['query_string'] = '[Filtered - contains sensitive params]'
    
    # Filter exception context
    if 'exception' in event:
        for exception in event['exception'].get('values', []):
            if 'stacktrace' in exception:
                for frame in exception['stacktrace'].get('frames', []):
                    # Filter local variables that might contain secrets
                    if 'vars' in frame:
                        vars_to_filter = [
                            'api_key', 'secret', 'token', 'password',
                            'openai_key', 'anthropic_key', 'redis_url'
                        ]
                        for var_name in list(frame['vars'].keys()):
                            if any(sensitive in var_name.lower() for sensitive in vars_to_filter):
                                frame['vars'][var_name] = '[Filtered]'
    
    # Filter breadcrumbs
    if 'breadcrumbs' in event:
        for breadcrumb in event['breadcrumbs'].get('values', []):
            if 'data' in breadcrumb:
                # Filter sensitive data from breadcrumb data
                sensitive_fields = ['api_key', 'secret', 'token', 'password']
                for field in list(breadcrumb['data'].keys()):
                    if any(sensitive in field.lower() for sensitive in sensitive_fields):
                        breadcrumb['data'][field] = '[Filtered]'
    
    # Filter extra context
    if 'extra' in event:
        extra = event['extra']
        sensitive_extras = [
            'api_key', 'secret', 'token', 'password', 'redis_url',
            'openai_key', 'anthropic_key', 'hmac_secret'
        ]
        for key in list(extra.keys()):
            if any(sensitive in key.lower() for sensitive in sensitive_extras):
                extra[key] = '[Filtered]'
    
    return event


def filter_sensitive_transactions(event: Dict[str, Any], hint: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Filter sensitive data from Sentry transaction events."""
    
    # Filter transaction names that might contain sensitive info
    if 'transaction' in event:
        transaction = event['transaction']
        # Replace potential IDs or sensitive parts in transaction names
        if len(transaction.split('/')) > 3:  # Complex URLs
            # Keep only the main path structure
            parts = transaction.split('/')
            if len(parts) > 4:
                event['transaction'] = '/'.join(parts[:4]) + '/[filtered]'
    
    return event


def capture_ai_request_error(
    error: Exception, 
    provider: str, 
    model: str, 
    job_id: str = None,
    additional_context: Dict[str, Any] = None
):
    """Capture AI request specific errors with context."""
    
    with sentry_sdk.configure_scope() as scope:
        scope.set_tag("error_type", "ai_request")
        scope.set_tag("ai_provider", provider)
        scope.set_tag("ai_model", model)
        
        if job_id:
            scope.set_tag("job_id", job_id)
            scope.set_context("job", {"job_id": job_id})
        
        scope.set_context("ai_request", {
            "provider": provider,
            "model": model,
            "error_type": type(error).__name__
        })
        
        if additional_context:
            # Filter sensitive context before adding
            filtered_context = {
                k: v for k, v in additional_context.items()
                if not any(sensitive in k.lower() 
                          for sensitive in ['key', 'secret', 'token', 'password'])
            }
            scope.set_context("additional", filtered_context)
        
        sentry_sdk.capture_exception(error)


def capture_webhook_error(
    error: Exception,
    job_id: str,
    webhook_url: str = None,
    attempt: int = None,
    additional_context: Dict[str, Any] = None
):
    """Capture webhook delivery errors with context."""
    
    with sentry_sdk.configure_scope() as scope:
        scope.set_tag("error_type", "webhook_delivery")
        scope.set_tag("job_id", job_id)
        
        webhook_context = {
            "job_id": job_id,
            "error_type": type(error).__name__
        }
        
        if webhook_url:
            # Only include domain, not full URL to avoid sensitive data
            from urllib.parse import urlparse
            try:
                parsed = urlparse(webhook_url)
                webhook_context["webhook_domain"] = parsed.netloc
            except:
                webhook_context["webhook_domain"] = "[parse_error]"
        
        if attempt:
            webhook_context["attempt"] = attempt
            scope.set_tag("webhook_attempt", attempt)
        
        scope.set_context("webhook", webhook_context)
        
        if additional_context:
            filtered_context = {
                k: v for k, v in additional_context.items()
                if not any(sensitive in k.lower() 
                          for sensitive in ['key', 'secret', 'token', 'password', 'url'])
            }
            scope.set_context("additional", filtered_context)
        
        sentry_sdk.capture_exception(error)


def capture_job_processing_error(
    error: Exception,
    job_id: str,
    processing_stage: str = None,
    model: str = None,
    card_type: str = None,
    additional_context: Dict[str, Any] = None
):
    """Capture job processing errors with context."""
    
    with sentry_sdk.configure_scope() as scope:
        scope.set_tag("error_type", "job_processing")
        scope.set_tag("job_id", job_id)
        
        if processing_stage:
            scope.set_tag("processing_stage", processing_stage)
        
        if model:
            scope.set_tag("ai_model", model)
        
        if card_type:
            scope.set_tag("card_type", card_type)
        
        job_context = {
            "job_id": job_id,
            "error_type": type(error).__name__,
            "processing_stage": processing_stage,
            "model": model,
            "card_type": card_type
        }
        
        scope.set_context("job_processing", job_context)
        
        if additional_context:
            filtered_context = {
                k: v for k, v in additional_context.items()
                if not any(sensitive in k.lower() 
                          for sensitive in ['key', 'secret', 'token', 'password'])
            }
            scope.set_context("additional", filtered_context)
        
        sentry_sdk.capture_exception(error)


def set_user_context(user_id: str = None, job_id: str = None):
    """Set user context for error tracking."""
    with sentry_sdk.configure_scope() as scope:
        if user_id:
            scope.set_user({"id": user_id})
        
        if job_id:
            scope.set_tag("current_job_id", job_id)


def add_breadcrumb(message: str, category: str = "info", level: str = "info", data: Dict[str, Any] = None):
    """Add a breadcrumb for debugging context."""
    
    # Filter sensitive data from breadcrumb data
    if data:
        filtered_data = {
            k: v for k, v in data.items()
            if not any(sensitive in k.lower() 
                      for sensitive in ['key', 'secret', 'token', 'password'])
        }
    else:
        filtered_data = None
    
    sentry_sdk.add_breadcrumb(
        message=message,
        category=category,
        level=level,
        data=filtered_data
    )


def capture_custom_event(message: str, level: str = "info", **extra):
    """Capture a custom event with optional extra data."""
    
    # Filter sensitive extra data
    filtered_extra = {
        k: v for k, v in extra.items()
        if not any(sensitive in k.lower() 
                  for sensitive in ['key', 'secret', 'token', 'password'])
    }
    
    with sentry_sdk.configure_scope() as scope:
        for key, value in filtered_extra.items():
            scope.set_extra(key, value)
        
        sentry_sdk.capture_message(message, level)


# Context managers for automatic error capture
class SentryContext:
    """Context manager for automatic error capture with tags."""
    
    def __init__(self, operation: str, **tags):
        self.operation = operation
        self.tags = tags
    
    def __enter__(self):
        self.scope = sentry_sdk.configure_scope()
        self.scope.__enter__()
        
        # Set operation tag
        self.scope.set_tag("operation", self.operation)
        
        # Set custom tags
        for key, value in self.tags.items():
            if not any(sensitive in key.lower() 
                      for sensitive in ['key', 'secret', 'token', 'password']):
                self.scope.set_tag(key, value)
        
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            # Automatically capture exceptions
            sentry_sdk.capture_exception()
        
        self.scope.__exit__(exc_type, exc_val, exc_tb)
    
    def add_context(self, key: str, data: Dict[str, Any]):
        """Add context data."""
        # Filter sensitive data
        filtered_data = {
            k: v for k, v in data.items()
            if not any(sensitive in k.lower() 
                      for sensitive in ['key', 'secret', 'token', 'password'])
        }
        self.scope.set_context(key, filtered_data)


# Integration with structured logging
def get_sentry_context() -> Dict[str, Any]:
    """Get current Sentry context for inclusion in logs."""
    try:
        with sentry_sdk.configure_scope() as scope:
            return {
                "sentry_trace_id": scope._span.trace_id if scope._span else None,
                "sentry_span_id": scope._span.span_id if scope._span else None,
            }
    except:
        return {}