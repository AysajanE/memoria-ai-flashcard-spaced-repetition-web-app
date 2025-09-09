# AI Service Operations Runbook

## Emergency Procedures

### Service Down
**Symptoms**: Health checks failing, 5xx errors, no response from service
**Immediate Actions**:
1. Check service logs: `docker-compose logs ai-service`
2. Verify Redis connectivity: `redis-cli -u $REDIS_URL ping`
3. Check resource usage: `docker stats`
4. Restart service: `docker-compose restart ai-service`
5. If Redis is down: `docker-compose restart redis`

**Escalation**: If restart doesn't resolve within 5 minutes, page on-call engineer.

### Queue Backed Up
**Symptoms**: Queue length > 100, slow job processing, user complaints about delays
**Immediate Actions**:
1. Check queue status: `curl -H "X-Internal-API-Key: $KEY" localhost:8000/api/v1/admin/queue-status`
2. Scale workers: `docker-compose up -d --scale ai-worker=5`
3. Check worker logs: `docker-compose logs ai-worker`
4. Monitor queue length for 10 minutes

**If queue continues growing**:
1. Check for problematic jobs: Look for repeated failures in logs
2. Consider temporarily pausing job intake
3. Page on-call engineer

### High Error Rate
**Symptoms**: Error rate > 10%, circuit breakers opening, Sentry alerts
**Investigation Steps**:
1. Check circuit breaker status:
   ```bash
   curl -H "X-Internal-API-Key: $KEY" \
        localhost:8000/api/v1/admin/circuit-breaker-status
   ```
2. Review error logs from last 30 minutes
3. Check AI provider status pages:
   - OpenAI: https://status.openai.com/
   - Anthropic: https://status.anthropic.com/
4. Check recent deployments in git log
5. Review Sentry error dashboard

**Mitigation Steps**:
1. If circuit breaker is open unnecessarily:
   ```bash
   curl -X POST -H "X-Internal-API-Key: $KEY" \
        localhost:8000/api/v1/admin/reset-circuit-breaker/openai
   ```
2. If specific model is failing, enable fallback:
   ```bash
   export ENABLE_FALLBACK=true
   docker-compose restart ai-service
   ```
3. If API provider is down, switch default model temporarily

### Memory Leak / High Memory Usage
**Symptoms**: Docker stats showing high memory, OOM kills in logs
**Immediate Actions**:
1. Check memory usage: `docker stats --no-stream`
2. Restart workers (they process memory-intensive tasks):
   ```bash
   docker-compose restart ai-worker
   ```
3. Monitor for 15 minutes
4. If memory continues growing, restart entire service:
   ```bash
   docker-compose restart ai-service
   ```

### API Key Compromise
**Symptoms**: Unusual usage patterns, unauthorized charges, security alert
**Immediate Actions**:
1. **Revoke compromised keys immediately**:
   - OpenAI: https://platform.openai.com/api-keys
   - Anthropic: https://console.anthropic.com/
2. Generate new API keys
3. Update environment variables:
   ```bash
   export OPENAI_API_KEY="new-key"
   export ANTHROPIC_API_KEY="new-key"
   docker-compose restart
   ```
4. Review access logs for the compromise period
5. Notify security team
6. Update any other systems using the compromised keys

## Routine Maintenance

### Daily Checks
- [ ] Review error logs and metrics dashboard
- [ ] Check queue depth and processing times
- [ ] Verify all circuit breakers are closed
- [ ] Monitor cost expenditure vs budget
- [ ] Check for any failed webhook deliveries

### Weekly Tasks  
- [ ] Restart workers to prevent memory leaks:
  ```bash
  docker-compose restart ai-worker
  ```
- [ ] Clean up old Redis keys:
  ```bash
  curl -X POST -H "X-Internal-API-Key: $KEY" \
       localhost:8000/api/v1/admin/cleanup-inflight
  ```
- [ ] Review performance trends in Grafana
- [ ] Update dependencies if security patches available
- [ ] Verify backup and monitoring systems

### Monthly Tasks
- [ ] Rotate API keys
- [ ] Review and update cost budgets
- [ ] Analyze usage patterns for optimization opportunities
- [ ] Update documentation with any operational learnings
- [ ] Review and test disaster recovery procedures

## Configuration Management

### Feature Flag Changes

**Enabling Queue Mode** (Recommended for Production):
```bash
export USE_QUEUE=true
docker-compose restart ai-service
# Monitor for 15 minutes to ensure workers are processing jobs
```

**Enabling Fallback** (For High Availability):
```bash
export ENABLE_FALLBACK=true
docker-compose restart ai-service
# Test with a known failing model to verify fallback works
```

**Enabling Progress Updates** (For Long Jobs):
```bash
export ENABLE_PROGRESS_UPDATES=true
docker-compose restart ai-service
# Verify webhooks are being sent during long-running jobs
```

**Rollback Procedure** (If Issues Arise):
```bash
# Revert to previous configuration
export USE_QUEUE=false
export ENABLE_FALLBACK=false
docker-compose restart ai-service
```

### Scaling Operations

**Scale Workers Based on Load**:
```bash
# Light load (off-hours)
docker-compose up -d --scale ai-worker=2

# Normal load (business hours)
docker-compose up -d --scale ai-worker=3

# High load (peak times)
docker-compose up -d --scale ai-worker=5

# Emergency scaling
docker-compose up -d --scale ai-worker=8
```

**Update Concurrency Limits**:
```bash
# Increase throughput (if providers allow)
export OPENAI_MAX_CONCURRENCY=12
export ANTHROPIC_MAX_CONCURRENCY=12
docker-compose restart ai-service

# Decrease to reduce load on providers
export OPENAI_MAX_CONCURRENCY=4
export ANTHROPIC_MAX_CONCURRENCY=4
docker-compose restart ai-service
```

## Monitoring Setup

### Key Metrics to Watch

**Service Health**:
- HTTP response times (p50, p95, p99)
- Error rate by endpoint
- Request rate
- Service uptime

**AI Processing**:
- AI request duration by provider
- Token usage and costs
- Circuit breaker states
- Fallback attempt rate

**Queue Performance**:
- Queue depth
- Job processing time
- Worker utilization
- Failed job rate

**Infrastructure**:
- CPU and memory usage
- Redis connection health
- Disk usage

### Grafana Dashboard Queries

```promql
# Request rate
rate(ai_requests_total[5m])

# Error rate
rate(ai_requests_total{status!="success"}[5m]) / rate(ai_requests_total[5m]) * 100

# Response time percentiles  
histogram_quantile(0.95, rate(ai_request_duration_seconds_bucket[5m]))

# Queue depth
queue_size{queue_name="memoria-ai"}

# Cost per hour
rate(ai_cost_usd_total[1h]) * 3600

# Circuit breaker status
circuit_breaker_state

# Memory usage
container_memory_usage_bytes{container_label_com_docker_compose_service="ai-service"}
```

### Alert Rules

```yaml
groups:
  - name: ai_service_critical
    rules:
      - alert: ServiceDown
        expr: up{job="ai-service"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "AI Service is down"
          
      - alert: CircuitBreakerOpen
        expr: circuit_breaker_state > 0
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Circuit breaker open for {{ $labels.service }}"

      - alert: HighErrorRate
        expr: rate(ai_requests_total{status!="success"}[5m]) / rate(ai_requests_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate: {{ $value | humanizePercentage }}"

      - alert: QueueDepthHigh
        expr: queue_size > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Queue depth high: {{ $value }} jobs"

      - alert: HighMemoryUsage
        expr: container_memory_usage_bytes / container_spec_memory_limit_bytes > 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage: {{ $value | humanizePercentage }}"
```

## Deployment Procedures

### Production Deployment Checklist

**Pre-Deployment**:
- [ ] Run full test suite: `pytest tests/`
- [ ] Build and test Docker image locally
- [ ] Review configuration changes
- [ ] Notify team of deployment window
- [ ] Ensure rollback plan is ready

**Deployment Steps**:
1. Pull latest changes: `git pull origin main`
2. Build new image: `docker build -t ai-service:latest .`
3. Test image locally: `docker run --rm ai-service:latest python -c "import app.main"`
4. Deploy with zero-downtime:
   ```bash
   docker-compose -f docker-compose.prod.yml pull
   docker-compose -f docker-compose.prod.yml up -d
   ```
5. Monitor health checks: `curl localhost:8000/health`
6. Check logs for errors: `docker-compose logs -f ai-service`
7. Run smoke tests: `python tests/load_test.py --scenario smoke`

**Post-Deployment**:
- [ ] Monitor metrics dashboard for 30 minutes
- [ ] Check error rates and response times
- [ ] Verify queue processing is working
- [ ] Test a few manual requests
- [ ] Update team on deployment status

### Rollback Procedure
```bash
# Quick rollback to previous image
docker-compose -f docker-compose.prod.yml down
docker tag ai-service:previous ai-service:latest
docker-compose -f docker-compose.prod.yml up -d

# Verify service health
curl http://localhost:8000/health

# Check logs
docker-compose logs -f ai-service
```

### Blue-Green Deployment (Advanced)
```bash
# Start green environment
docker-compose -f docker-compose.green.yml up -d

# Health check green environment
curl http://localhost:8001/health

# Switch load balancer to green
# (Update nginx/load balancer configuration)

# Monitor for issues
# If all good, shut down blue environment
docker-compose -f docker-compose.blue.yml down
```

## Performance Optimization

### High Latency Issues
1. **Check AI provider latency**: Review `ai_request_duration_seconds` metric
2. **Optimize model selection**: Use faster models for simple tasks
3. **Enable caching**: Consider response caching for repeated requests
4. **Tune concurrency**: Increase `OPENAI_MAX_CONCURRENCY` if provider allows
5. **Check chunking**: Large texts may need better chunking strategies

**Investigation Commands**:
```bash
# Check current concurrency stats
curl -H "X-Internal-API-Key: $KEY" localhost:8000/api/v1/admin/concurrency-stats

# Review slow requests in logs
docker-compose logs ai-service | grep "duration.*[1-9][0-9]\."

# Check for failed fast models vs slow models
docker-compose logs | grep "fallback"
```

### Cost Optimization
1. **Monitor cost metrics**: Track `ai_cost_usd_total` 
2. **Optimize model usage**: Use cheaper models when appropriate
3. **Implement request limits**: Add per-user rate limiting
4. **Review token budgets**: Optimize `TOKENS_PER_CARD_BUDGET`
5. **Enable cost accounting**: `ENABLE_COST_ACCOUNTING=true`

**Cost Analysis Commands**:
```bash
# Get cost breakdown by model
curl -H "X-Internal-API-Key: $KEY" \
     "localhost:8000/api/v1/admin/pricing-info"

# Estimate cost for typical request
curl -H "X-Internal-API-Key: $KEY" \
     "localhost:8000/api/v1/admin/cost-estimate?model=gpt-3.5-turbo&input_tokens=1000&output_tokens=500"
```

### Memory Optimization
1. **Regular worker restarts**: Restart workers daily
2. **Monitor memory patterns**: Watch for gradual increases
3. **Optimize text processing**: Reduce memory allocation in chunking
4. **Limit concurrent requests**: Reduce concurrency if memory-bound

## Security Incident Response

### Data Breach Response
1. **Isolate affected systems**: Stop processing if needed
2. **Preserve evidence**: Capture logs and current state
3. **Notify security team**: Follow company incident response procedures
4. **Document timeline**: Record all actions taken
5. **Conduct post-incident review**: Identify improvements

### API Abuse Detection
**Signs of abuse**:
- Unusual request patterns
- High cost increase without expected usage
- Repeated failures from specific IPs
- Large text inputs designed to consume tokens

**Response Actions**:
1. **Identify abuse pattern**: Review logs and metrics
2. **Implement rate limiting**: Add temporary IP-based limits
3. **Block abusive requests**: Update firewall rules if needed
4. **Notify stakeholders**: Alert team of potential abuse
5. **Implement longer-term controls**: Add authentication, better validation

### Security Hardening Checklist
- [ ] All API keys rotated regularly (monthly)
- [ ] HMAC verification enabled (`ENABLE_INBOUND_HMAC=true`)
- [ ] CORS origins restricted (`CORS_ORIGINS` not wildcard)
- [ ] Internal API key is strong and rotated
- [ ] Container runs as non-root user
- [ ] No secrets in logs or error messages
- [ ] TLS enabled for all external communications
- [ ] Dependencies updated to latest security patches

## Contact Information

### Escalation Path
1. **Level 1**: Operations team member
2. **Level 2**: Senior engineer on-call
3. **Level 3**: Engineering manager
4. **Level 4**: Director of Engineering

### Key Contacts
- **On-call Engineer**: See PagerDuty rotation
- **Engineering Team Lead**: team-lead@company.com
- **Infrastructure Team**: infra@company.com
- **Security Team**: security@company.com
- **Product Team**: product@company.com

### External Contacts
- **OpenAI Support**: https://help.openai.com/
- **Anthropic Support**: support@anthropic.com
- **Cloud Provider Support**: (varies by provider)

## Disaster Recovery

### Data Loss Scenarios
**Redis Data Loss**:
- Impact: In-flight job tracking lost, may cause duplicate processing
- Recovery: Redis data is transient, restart workers to clear state
- Prevention: Use Redis persistence and backups if needed

**Configuration Loss**:
- Impact: Service may start with incorrect settings
- Recovery: Restore from git repository and environment backups
- Prevention: Store all configuration in version control

**Complete Service Loss**:
- Impact: No flashcard generation available
- Recovery: Deploy from Docker Hub image and configuration backup
- Prevention: Regular testing of deployment procedures

### Backup Procedures
```bash
# Backup configuration
tar -czf config-backup-$(date +%Y%m%d).tar.gz .env docker-compose*.yml

# Export Redis data (if persistence enabled)
redis-cli -u $REDIS_URL --rdb redis-backup-$(date +%Y%m%d).rdb

# Backup Docker images
docker save ai-service:latest | gzip > ai-service-$(date +%Y%m%d).tar.gz
```

### Recovery Testing
- **Monthly**: Test service restart procedures
- **Quarterly**: Full disaster recovery drill
- **Annually**: Complete environment rebuild test

## Performance Baselines

### Normal Operating Ranges
- **Response Time**: p95 < 5s, p99 < 15s
- **Error Rate**: < 2%
- **Queue Depth**: < 50 jobs
- **Memory Usage**: < 512MB per worker
- **CPU Usage**: < 70% during peak hours
- **Cost**: < $X per 1000 requests (define based on budget)

### Peak Load Handling
- **Expected Peak**: 100 requests/minute
- **Maximum Tested**: 500 requests/minute
- **Scaling Strategy**: Auto-scale workers, enable fallback
- **Circuit Breaker Thresholds**: 5 failures in 60 seconds

### SLA Targets
- **Uptime**: 99.9% (8.76 hours downtime/year)
- **Response Time**: 95% of requests < 10 seconds
- **Error Rate**: < 1% excluding provider outages
- **Queue Processing**: Jobs processed within 5 minutes during normal load