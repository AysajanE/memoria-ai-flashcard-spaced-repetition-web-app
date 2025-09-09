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

# Alias for backward compatibility and readability
verify_internal_api_key = validate_internal_api_key
