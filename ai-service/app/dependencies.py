from fastapi import HTTPException, status, Header
from app.config import settings

async def validate_internal_api_key(x_internal_api_key: str = Header(...)):
    """Validate the internal API key for service-to-service communication."""
    if x_internal_api_key != settings.INTERNAL_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal API Key"
        )
    return True


async def verify_internal_api_key(x_internal_api_key: str = Header(None)):
    """Verify internal API key for admin endpoints."""
    
    if not settings.INTERNAL_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Internal API key not configured"
        )
    
    if not x_internal_api_key or x_internal_api_key != settings.INTERNAL_API_KEY:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing internal API key"
        )
