# Memoria Documentation

This directory contains comprehensive documentation for the Memoria AI flashcard application.

## Implementation Documentation

- [Next.js Detailed Implementation Plan](./nextjs_detailed_implementation_plan.md) - Complete step-by-step implementation guide
- [Next.js Action Plan v1](./nextjs_action_plan_v1.md) - High-level roadmap and phase breakdown
- [Next.js Expert Review](./nextjs_review_v1.md) - Architecture analysis and recommendations
- [AI Service Implementation Plan](./ai_service_detailed_implementation_plan.md) - AI service implementation guide
- [AI Service Action Plan](./ai_service_action_plan_v1.md) - AI service roadmap

## Operations Documentation

- [Webhook Management](./operations/webhook-management.md) - HMAC rotation and troubleshooting
- [Rate Limiting Operations](./operations/rate-limiting.md) - Rate limit management and monitoring
- [Database Migration Procedures](./operations/database-migrations.md) - Safe migration practices
- [Logging & Monitoring Guide](./operations/logging-monitoring.md) - Log structure and monitoring setup
- [Deployment Readiness Checklist](./operations/deployment-checklist.md) - Production deployment verification

## Architecture

### System Overview
- **Frontend**: Next.js 14 with App Router, React, TypeScript
- **Authentication**: Clerk with webhook integration
- **Database**: PostgreSQL with Drizzle ORM, optimized queries
- **AI Processing**: Python FastAPI service with OpenAI/Anthropic integration
- **Caching**: Next.js cache tags with Redis rate limiting
- **Security**: Comprehensive headers, HMAC webhook signing, CSRF protection

### Key Features Implemented
- Spaced Repetition System (SRS) with Anki SM-2 algorithm
- AI-powered flashcard generation with error categorization
- Real-time processing status with webhooks
- Comprehensive rate limiting and security measures
- Structured JSON logging for observability
- Type-safe API integration between services

## Development Workflow

1. Review [Implementation Plan](./nextjs_detailed_implementation_plan.md) for detailed steps
2. Follow [Operations Runbooks](./operations/) for deployment procedures  
3. Use structured logging for debugging and monitoring
4. Test webhook integrations thoroughly before deployment
5. Follow database migration checklist for schema changes

## Getting Help

- Check [Troubleshooting sections](./operations/webhook-management.md#webhook-troubleshooting-guide) in operations docs
- Review [Error Categories](./operations/logging-monitoring.md#error-categories) for debugging
- Consult [Expert Review](./nextjs_review_v1.md) for architectural decisions