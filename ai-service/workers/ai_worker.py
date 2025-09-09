#!/usr/bin/env python3
"""
AI Worker for processing flashcard generation jobs.

Usage:
    python -m workers.ai_worker
"""

import sys
import os
import logging
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from rq import Connection, Worker
from app.queue import r
from app.core.config_validator import log_configuration

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

def main():
    """Start the RQ worker."""
    log_configuration()
    
    logger.info("Starting AI worker...")
    
    with Connection(r):
        worker = Worker(
            ["memoria-ai"], 
            connection=r,
            name="ai-worker"
        )
        
        # Handle graceful shutdown
        import signal
        
        def signal_handler(signum, frame):
            logger.info(f"Received signal {signum}, shutting down gracefully...")
            worker.stop()

        signal.signal(signal.SIGTERM, signal_handler)
        signal.signal(signal.SIGINT, signal_handler)
        
        try:
            worker.work(with_scheduler=True)
        except KeyboardInterrupt:
            logger.info("Worker stopped by user")
        except Exception as e:
            logger.error(f"Worker error: {e}", exc_info=True)
            sys.exit(1)

if __name__ == "__main__":
    main()