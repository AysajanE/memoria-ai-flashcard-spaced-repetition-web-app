from prometheus_client import Counter, Histogram, Gauge, Info, generate_latest
from prometheus_fastapi_instrumentator import Instrumentator, metrics
from fastapi import FastAPI, Response
import logging
import asyncio
import time
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Custom metrics
ai_requests_total = Counter(
    'ai_requests_total',
    'Total AI API requests',
    ['provider', 'model', 'status', 'card_type']
)

ai_request_duration = Histogram(
    'ai_request_duration_seconds',
    'AI API request duration',
    ['provider', 'model'],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0]
)

ai_tokens_used = Counter(
    'ai_tokens_used_total', 
    'Total AI tokens consumed',
    ['provider', 'model', 'token_type']
)

ai_cost_usd = Counter(
    'ai_cost_usd_total',
    'Total AI costs in USD',
    ['provider', 'model']
)

queue_size = Gauge(
    'queue_size',
    'Current queue size',
    ['queue_name']
)

circuit_breaker_state = Gauge(
    'circuit_breaker_state',
    'Circuit breaker state (0=closed, 1=open, 2=half-open)',
    ['service']
)

cards_generated_total = Counter(
    'cards_generated_total',
    'Total flashcards generated',
    ['model', 'card_type', 'quality']
)

job_processing_duration = Histogram(
    'job_processing_duration_seconds',
    'Job processing duration from start to completion',
    buckets=[1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0, 600.0]
)

webhook_delivery_total = Counter(
    'webhook_delivery_total',
    'Total webhook delivery attempts',
    ['status', 'job_status']
)

webhook_delivery_duration = Histogram(
    'webhook_delivery_duration_seconds',
    'Webhook delivery duration',
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
)

concurrent_requests = Gauge(
    'concurrent_requests',
    'Current number of concurrent requests',
    ['provider']
)

fallback_attempts_total = Counter(
    'fallback_attempts_total',
    'Total fallback attempts',
    ['primary_model', 'fallback_model', 'reason']
)

# Application info
app_info = Info(
    'ai_service_info',
    'AI Service application information'
)


def setup_metrics(app: FastAPI):
    """Setup Prometheus metrics for the FastAPI app."""
    
    instrumentator = Instrumentator(
        should_group_status_codes=False,
        should_ignore_untemplated=True,
        should_respect_env_var=True,
        should_instrument_requests_inprogress=True,
        excluded_handlers=["/metrics", "/health", "/ready"],
        env_var_name="ENABLE_METRICS",
        inprogress_name="http_requests_inprogress",
        inprogress_labels=True,
    )

    # Add default metrics
    instrumentator.instrument(app)

    # Add custom metrics endpoint
    @app.get("/metrics")
    async def metrics_endpoint():
        """Expose Prometheus metrics."""
        return Response(generate_latest(), media_type="text/plain")

    # Set application info
    app_info.info({
        'version': '1.0.0',
        'python_version': '3.11',
        'environment': 'production'
    })

    logger.info("Prometheus metrics configured")


def record_ai_request(
    provider: str, 
    model: str, 
    status: str, 
    card_type: str, 
    duration: float, 
    tokens: Dict[str, int] = None, 
    cost: float = None
):
    """Record metrics for an AI API request."""
    
    ai_requests_total.labels(
        provider=provider,
        model=model, 
        status=status,
        card_type=card_type
    ).inc()

    ai_request_duration.labels(
        provider=provider,
        model=model
    ).observe(duration)

    # Record token usage
    if tokens:
        for token_type, count in tokens.items():
            if token_type in ['prompt_tokens', 'completion_tokens', 'total_tokens']:
                ai_tokens_used.labels(
                    provider=provider,
                    model=model,
                    token_type=token_type
                ).inc(count)

    # Record cost
    if cost and cost > 0:
        ai_cost_usd.labels(
            provider=provider,
            model=model
        ).inc(cost)


def record_cards_generated(model: str, card_type: str, count: int, quality: str = "good"):
    """Record metrics for generated cards."""
    cards_generated_total.labels(
        model=model,
        card_type=card_type,
        quality=quality
    ).inc(count)


def record_job_processing_duration(duration: float):
    """Record job processing duration."""
    job_processing_duration.observe(duration)


def record_webhook_delivery(status: str, job_status: str, duration: float = None):
    """Record webhook delivery metrics."""
    webhook_delivery_total.labels(
        status=status,
        job_status=job_status
    ).inc()
    
    if duration is not None:
        webhook_delivery_duration.observe(duration)


def record_concurrent_request(provider: str, increment: bool = True):
    """Record concurrent request changes."""
    if increment:
        concurrent_requests.labels(provider=provider).inc()
    else:
        concurrent_requests.labels(provider=provider).dec()


def record_fallback_attempt(primary_model: str, fallback_model: str, reason: str):
    """Record fallback attempt."""
    fallback_attempts_total.labels(
        primary_model=primary_model,
        fallback_model=fallback_model,
        reason=reason
    ).inc()


def update_queue_metrics():
    """Update queue size metrics."""
    try:
        # Import here to avoid circular imports
        from app.queue import get_queue_info
        info = get_queue_info()
        queue_size.labels(queue_name="memoria-ai").set(info.get("queue_length", 0))
    except Exception as e:
        logger.error(f"Failed to update queue metrics: {e}")


def update_circuit_breaker_metrics():
    """Update circuit breaker state metrics."""
    try:
        # Import here to avoid circular imports
        from app.core.circuit_breaker import openai_circuit, anthropic_circuit
        
        async def _update():
            try:
                openai_status = await openai_circuit.get_status()
                anthropic_status = await anthropic_circuit.get_status()
                
                state_mapping = {
                    "closed": 0,
                    "open": 1, 
                    "half_open": 2
                }
                
                circuit_breaker_state.labels(service="openai").set(
                    state_mapping.get(openai_status.get("state", "closed"), 0)
                )
                circuit_breaker_state.labels(service="anthropic").set(
                    state_mapping.get(anthropic_status.get("state", "closed"), 0)
                )
            except Exception as e:
                logger.error(f"Failed to update circuit breaker metrics: {e}")
        
        # Run the async function
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.create_task(_update())
            else:
                loop.run_until_complete(_update())
        except Exception as e:
            logger.error(f"Failed to run circuit breaker update: {e}")
            
    except ImportError:
        # Circuit breakers not implemented yet
        logger.debug("Circuit breaker module not available for metrics")
    except Exception as e:
        logger.error(f"Failed to update circuit breaker metrics: {e}")


class MetricsContext:
    """Context manager for tracking request metrics."""
    
    def __init__(self, provider: str, model: str, card_type: str = "qa"):
        self.provider = provider
        self.model = model
        self.card_type = card_type
        self.start_time = None
        self.status = "success"
    
    def __enter__(self):
        self.start_time = time.time()
        record_concurrent_request(self.provider, increment=True)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.start_time:
            duration = time.time() - self.start_time
            
            # Determine status based on exception
            if exc_type:
                self.status = "error"
            
            record_ai_request(
                provider=self.provider,
                model=self.model,
                status=self.status,
                card_type=self.card_type,
                duration=duration
            )
        
        record_concurrent_request(self.provider, increment=False)
    
    def set_success_metrics(self, tokens: Dict[str, int] = None, cost: float = None):
        """Set success-specific metrics."""
        self.status = "success"
        if self.start_time:
            duration = time.time() - self.start_time
            record_ai_request(
                provider=self.provider,
                model=self.model,
                status=self.status,
                card_type=self.card_type,
                duration=duration,
                tokens=tokens,
                cost=cost
            )


def get_metrics_summary() -> Dict[str, Any]:
    """Get a summary of current metrics for debugging/admin purposes."""
    try:
        # This is a simplified version - in production you'd query the actual metrics
        return {
            "metrics_enabled": True,
            "available_metrics": [
                "ai_requests_total",
                "ai_request_duration",
                "ai_tokens_used_total",
                "ai_cost_usd_total",
                "queue_size",
                "circuit_breaker_state",
                "cards_generated_total",
                "job_processing_duration",
                "webhook_delivery_total",
                "concurrent_requests",
                "fallback_attempts_total"
            ],
            "info": "Use /metrics endpoint for full Prometheus metrics"
        }
    except Exception as e:
        logger.error(f"Failed to get metrics summary: {e}")
        return {"error": str(e)}