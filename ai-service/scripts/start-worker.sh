#!/bin/bash
set -e

echo "Starting AI worker..."

# Activate virtual environment if it exists
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi

# Set environment
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# Start worker
python -m workers.ai_worker