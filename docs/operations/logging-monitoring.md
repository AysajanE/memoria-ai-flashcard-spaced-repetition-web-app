# Logging & Monitoring Guide

## Log Structure

All logs follow structured JSON format:
```json
{
  "ts": "2025-01-15T10:30:00.000Z",
  "level": "info|warn|error|debug",
  "message": "Human-readable message",
  "component": "webhook|ai_service|auth|database",
  "operation": "process_status_update|submit_request|authenticate",
  "errorCategory": "invalid_input|token_limit|auth_error|rate_limit|ai_model_error|parse_error|network_error|webhook_error|internal_error|unknown_error",
  "errorCode": "SPECIFIC_ERROR_CODE",
  "additional": "context-specific fields"
}
```

## Key Log Categories

### Webhook Logs
- **Success**: `component: "webhook", operation: "process_status_update"`
- **Authentication Failures**: `errorCategory: "auth_error"`
- **Validation Failures**: `errorCategory: "invalid_payload"`
- **HMAC Failures**: `errorCode: "INVALID_SIGNATURE"`

### AI Service Integration
- **Request Initiation**: `component: "ai_service", operation: "submit_request"`
- **Service Communication**: `component: "ai_service", operation: "send_webhook"`
- **Processing Status**: `operation: "process_status_update"`

### Error Categories
| Category | Description | Action Required |
|----------|-------------|-----------------|
| `invalid_input` | User provided invalid content | User notification |
| `token_limit` | Content too large for AI model | Chunking or user guidance |
| `auth_error` | Authentication/authorization failed | Check API keys |
| `rate_limit` | Rate limit exceeded | Implement backoff |
| `ai_model_error` | AI service returned error | Check AI service status |
| `parse_error` | Failed to parse AI response | AI prompt engineering |
| `network_error` | Network connectivity issue | Retry mechanism |
| `webhook_error` | Webhook delivery failed | Check webhook config |
| `internal_error` | Application logic error | Code fix required |

## Platform-Specific Monitoring

### Vercel (Production)
```bash
# View function logs
vercel logs --app=memoria-app

# Filter specific errors
vercel logs --app=memoria-app | grep '"level":"error"'

# Monitor webhook failures
vercel logs --app=memoria-app | grep 'webhook.*error'
```

### Local Development
```bash
# All logs go to stdout in JSON format
cd nextjs-app && npm run dev | jq '.'

# Filter for errors only
cd nextjs-app && npm run dev | grep '"level":"error"' | jq '.'
```

### CloudWatch (if using AWS)
```sql
-- Sample CloudWatch Insights queries

-- Error rate by component
fields @timestamp, component, errorCategory
| filter level = "error"
| stats count() by component
| sort count() desc

-- Webhook authentication failures
fields @timestamp, message, errorCode, headers
| filter component = "webhook" and errorCategory = "auth_error"
| sort @timestamp desc

-- AI processing performance
fields @timestamp, operation, processingTimeMs
| filter component = "ai_service" and operation = "process_status_update"
| stats avg(processingTimeMs) by bin(5m)
```

## Alert Configuration

### Critical Alerts (Immediate Response)
- Error rate > 5% over 5 minutes
- Webhook authentication failures > 10/minute
- Database connection failures
- AI service unavailable (100% failure rate)

### Warning Alerts (Monitor)
- Error rate > 1% over 15 minutes  
- Rate limiting triggered frequently
- Slow response times (> 5s for AI requests)
- High memory/CPU usage

### Example Alert Queries
```bash
# Error rate alert
vercel logs --since=5m | grep '"level":"error"' | wc -l
# Alert if > 50 errors in 5 minutes

# Webhook auth failures
vercel logs --since=1m | grep '"errorCode":"INVALID_SIGNATURE"' | wc -l
# Alert if > 10 failures in 1 minute
```