import json
import time
import hmac
import hashlib
import requests
import logging
from typing import Dict, Any
from app.config import settings
from app.schemas.responses import WebhookPayload

logger = logging.getLogger(__name__)

async def send_webhook_async(payload: Dict[str, Any]) -> None:
    """Send webhook asynchronously (simplified version for progress updates)."""
    try:
        # Create webhook payload
        webhook_payload = WebhookPayload(**payload)
        
        # Serialize to JSON
        json_obj = webhook_payload.model_dump(mode="json")
        raw = json.dumps(json_obj, separators=(",", ":"))

        headers = {
            "x-internal-api-key": settings.INTERNAL_API_KEY,
            "content-type": "application/json",
            "user-agent": "ai-service-webhook/1.0",
        }
        
        # Add HMAC signature if configured
        if settings.INTERNAL_WEBHOOK_HMAC_SECRET:
            ts = str(int(time.time() * 1000))
            mac = hmac.new(
                settings.INTERNAL_WEBHOOK_HMAC_SECRET.encode("utf-8"),
                f"{ts}.{raw}".encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()
            headers["x-webhook-timestamp"] = ts
            headers["x-webhook-signature"] = f"sha256={mac}"

        # Send webhook (fire and forget for progress updates)
        response = requests.post(
            settings.NEXTJS_APP_STATUS_WEBHOOK_URL,
            data=raw,
            headers=headers,
            timeout=5,  # Shorter timeout for progress updates
        )
        
        if response.status_code >= 400:
            logger.warning(f"Webhook failed with status {response.status_code}: {response.text[:200]}")
        else:
            logger.debug(f"Webhook sent successfully for {payload.get('status', 'unknown')} status")
            
    except Exception as e:
        # Don't raise for progress updates - just log and continue
        logger.warning(f"Failed to send webhook: {e}")