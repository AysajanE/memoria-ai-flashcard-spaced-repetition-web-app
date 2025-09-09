# Webhook HMAC Secret Management

## HMAC Secret Rotation Procedure

### Prerequisites
- Access to production environment variables
- Access to AI service configuration
- Deployment access (Vercel dashboard or equivalent)

### Steps for Secret Rotation

1. **Generate new HMAC secret:**
   ```bash
   # Generate cryptographically secure secret (32+ characters)
   openssl rand -hex 32
   # Or use: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Update AI service first:**
   ```bash
   # Update ai-service/.env.local with new secret
   INTERNAL_WEBHOOK_HMAC_SECRET="new-secret-here"
   
   # Restart AI service
   # For local: Ctrl+C and restart with uvicorn
   # For production: Deploy updated environment configuration
   ```

3. **Update Next.js app:**
   ```bash
   # Update nextjs-app/.env.local
   INTERNAL_WEBHOOK_HMAC_SECRET="new-secret-here"
   
   # For Vercel production:
   # 1. Go to Vercel dashboard > Project Settings > Environment Variables
   # 2. Update INTERNAL_WEBHOOK_HMAC_SECRET with new value
   # 3. Redeploy application
   ```

4. **Verify rotation worked:**
   ```bash
   # Test webhook endpoint with new secret
   curl -X POST https://your-app.vercel.app/api/webhooks/ai-service-status \
     -H "Content-Type: application/json" \
     -H "x-internal-api-key: your-api-key" \
     -H "x-webhook-timestamp: $(date +%s)000" \
     -H "x-webhook-signature: sha256=$(echo -n "$(date +%s)000.{test payload}" | openssl dgst -sha256 -hmac 'your-new-secret' -binary | xxd -p)" \
     -d '{"jobId": "test-job-id", "status": "completed"}'
   
   # Should return 404 (job not found) rather than 401 (invalid signature)
   ```

## Webhook Troubleshooting Guide

### Common Issues

#### 1. Invalid Signature (401 Error)
**Symptoms:** Webhook returns `{"error": "Invalid signature", "errorCode": "INVALID_SIGNATURE"}`

**Diagnosis:**
```bash
# Check if HMAC secrets match between services
# AI service logs should show the signature it's generating
# Next.js logs should show the expected vs received signature
```

**Solutions:**
- Verify HMAC secrets match exactly between AI service and Next.js
- Check timestamp is within 5-minute window
- Ensure signature format is `sha256=<hex-digest>`

#### 2. Timestamp Expired (401 Error)
**Symptoms:** `{"error": "Signature timestamp expired", "errorCode": "TIMESTAMP_EXPIRED"}`

**Solutions:**
- Check system clocks are synchronized between services
- Reduce delay between AI service completing and sending webhook
- Consider increasing timestamp tolerance if needed (currently 5 minutes)

#### 3. Missing Signature Headers (401 Error)
**Symptoms:** `{"error": "Missing signature headers", "errorCode": "MISSING_SIGNATURE"}`

**Solutions:**
- Ensure AI service includes both `x-webhook-timestamp` and `x-webhook-signature` headers
- Verify header names are exact (case-sensitive)

#### 4. Job State Conflicts (409 Error)
**Symptoms:** `{"error": "Illegal transition", "errorCode": "ILLEGAL_TRANSITION"}`

**Solutions:**
- Check job isn't already in terminal state (completed/failed)
- Verify state transition is legal per job state machine
- Consider if duplicate webhooks are being sent

### Emergency Procedures

#### Disable HMAC Verification Temporarily
```bash
# In production emergency only:
# Remove or comment out INTERNAL_WEBHOOK_HMAC_SECRET
# Webhook will fall back to API key only
# IMPORTANT: Re-enable HMAC as soon as issue is resolved
```

#### Webhook Debugging
```bash
# Enable verbose logging to see signature calculations
# Check both AI service logs and Next.js function logs
# Look for exact signature strings and timestamp values
```