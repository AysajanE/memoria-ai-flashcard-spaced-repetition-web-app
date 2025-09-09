# Rate Limiting Operations

## Rate Limit Override Procedure

### Emergency Override (Redis-based)

When legitimate users are being rate-limited inappropriately:

1. **Identify the rate limit key:**
   ```bash
   # Rate limit keys follow pattern: "rate_limit:{identifier}:{window}"
   # Examples:
   # rate_limit:user:clm123:3600 (user-based, 1 hour window)
   # rate_limit:ip:192.168.1.100:3600 (IP-based, 1 hour window)
   ```

2. **Clear specific rate limit:**
   ```bash
   # Using Redis CLI (if direct access available)
   redis-cli DEL "rate_limit:user:clm123:3600"
   
   # Or via Upstash REST API
   curl -X POST https://your-redis.upstash.io/del/rate_limit:user:clm123:3600 \
     -H "Authorization: Bearer your-token"
   ```

3. **Temporary rate limit increase:**
   ```bash
   # Set higher limit temporarily (e.g., 1000 instead of 100)
   redis-cli SET "rate_limit:user:clm123:3600" 50 EX 3600
   # This gives user 950 more requests (1000 - 50 used) for next hour
   ```

### Monitoring Rate Limits

```bash
# Check current rate limit status for user
redis-cli GET "rate_limit:user:clm123:3600"

# List all active rate limits
redis-cli KEYS "rate_limit:*" | head -20

# Get rate limit statistics
redis-cli SCAN 0 MATCH "rate_limit:*" COUNT 100
```

### Rate Limit Configuration Changes

Production rate limits are defined in:
- `nextjs-app/middleware.ts` - Route-specific limits
- `nextjs-app/lib/rate-limit.ts` - Limit values and windows

**To update rate limits:**
1. Modify rate limit constants in code
2. Deploy changes
3. Clear existing rate limit keys to apply new limits immediately:
   ```bash
   redis-cli --scan --pattern "rate_limit:*" | xargs redis-cli DEL
   ```

### Performance Monitoring

**Key metrics to monitor:**
- Rate limit hit rate (should be <5% for legitimate traffic)
- Redis response times (should be <10ms)
- Rate limit bypass attempts

**Dashboard queries (if using monitoring tools):**
```sql
-- Rate limit hit percentage
SELECT 
  COUNT(CASE WHEN status = 429 THEN 1 END) * 100.0 / COUNT(*) as rate_limit_hit_rate
FROM request_logs 
WHERE timestamp > NOW() - INTERVAL 1 HOUR;

-- Top rate-limited endpoints
SELECT path, COUNT(*) as rate_limit_hits
FROM request_logs 
WHERE status = 429 AND timestamp > NOW() - INTERVAL 1 DAY
GROUP BY path
ORDER BY rate_limit_hits DESC;
```