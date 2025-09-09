# Database Migration Checklist

## Pre-Migration Checklist

### 1. Backup Procedures
```bash
# Create full database backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup integrity
pg_restore --list backup_*.sql | head -10

# Store backup securely (production)
aws s3 cp backup_*.sql s3://your-backup-bucket/db-backups/
```

### 2. Migration Validation
```bash
cd nextjs-app

# Generate migration and review SQL
npm run db:generate

# Review generated SQL in drizzle/ directory
cat drizzle/0000_*.sql

# Check migration is reversible (document rollback steps)
```

### 3. Environment Preparation
```bash
# Ensure database is accessible
psql $DATABASE_URL -c "SELECT version();"

# Check current schema version
npm run db:studio
# Look for __drizzle_migrations table

# Verify no other migrations running
# Check for locks: SELECT * FROM pg_locks WHERE locktype = 'advisory';
```

## Migration Execution

### 1. Apply Migration
```bash
cd nextjs-app

# Apply migration
npm run db:migrate

# Verify migration applied successfully
# Check __drizzle_migrations table for new entry
```

### 2. Post-Migration Smoke Tests
```bash
# Test critical application functions

# 1. User authentication
curl -X GET https://your-app.com/api/user/profile \
  -H "Authorization: Bearer test-token"

# 2. Database reads
curl -X GET https://your-app.com/api/decks

# 3. Database writes  
curl -X POST https://your-app.com/api/decks \
  -H "Content-Type: application/json" \
  -d '{"title": "Migration Test Deck"}'

# 4. AI service integration
curl -X POST https://your-app.com/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{"content": "Test content", "type": "basic"}'
```

### 3. Performance Validation
```bash
# Check query performance didn't degrade
# Run EXPLAIN ANALYZE on critical queries

psql $DATABASE_URL << EOF
EXPLAIN ANALYZE 
SELECT * FROM flashcards 
WHERE user_id = 'test-user' AND due_date <= NOW()
ORDER BY due_date ASC;
EOF

# Monitor application metrics
# - Response times should be similar to pre-migration
# - Error rates should not increase
# - Database connection pool should be stable
```

## Rollback Procedures

### Automatic Rollback (if migration fails)
```bash
# Drizzle doesn't auto-rollback, manual steps required

# 1. Restore from backup
dropdb memoria_db_temp  # if exists
pg_restore -C -d postgres backup_*.sql

# 2. Update application to point to restored database
# 3. Verify application functionality
```

### Manual Rollback (if issues discovered after migration)
```bash
# 1. Document current state
pg_dump $DATABASE_URL > post_migration_backup.sql

# 2. Identify problematic changes
# Compare pre/post migration schemas

# 3. Create reverse migration
# Write SQL to undo the changes

# 4. Test reverse migration on backup first
# 5. Apply to production during maintenance window
```

## Emergency Procedures

### Database Connection Issues
```bash
# Check connection limits
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Kill long-running queries if needed
psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query_start < NOW() - INTERVAL '5 minutes';"
```

### Application Downtime Minimization
```bash
# For zero-downtime migrations:
# 1. Ensure migration is backward-compatible
# 2. Deploy code that works with both old and new schema
# 3. Run migration
# 4. Deploy code that uses new schema features
```