#!/bin/bash
set -e

# Security checks
echo "Running pre-startup security checks..."

# Check that we're running as non-root
if [ "$(id -u)" = "0" ]; then
    echo "ERROR: Running as root is not allowed in production"
    exit 1
fi

# Check required environment variables
required_vars=("OPENAI_API_KEY" "INTERNAL_WEBHOOK_HMAC_SECRET")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "ERROR: Required environment variable $var is not set"
        exit 1
    fi
done

# Check file permissions
if [ -w "/app" ]; then
    echo "WARNING: Application directory is writable"
fi

echo "Security checks passed. Starting application..."

# Start the application
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 80 \
    --workers 2 \
    --timeout-keep-alive 20 \
    --log-level info \
    --access-log