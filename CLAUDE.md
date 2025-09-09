# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Memoria is an AI-powered flashcard creation app with spaced repetition learning. It consists of:
- **Next.js Web App** (`/nextjs-app`): Frontend and main application logic
- **Python AI Service** (`/ai-service`): FastAPI microservice for AI-powered flashcard generation

## Commands

### Development Setup
```bash
# Install all dependencies (run from root)
npm run install:all

# Start Next.js development server
npm run dev:next
# or
cd nextjs-app && npm run dev

# Start AI service
npm run dev:ai  
# or
cd ai-service && python -m uvicorn app.main:app --reload
```

### Database Operations
```bash
# Generate migrations (from root or nextjs-app)
npm run db:generate
# or 
cd nextjs-app && npm run db:generate

# Apply migrations
npm run db:migrate
# or
cd nextjs-app && npm run db:migrate

# Open database studio
npm run db:studio
# or
cd nextjs-app && npm run db:studio
```

### Next.js App Commands
```bash
cd nextjs-app

# Development
npm run dev

# Build and testing
npm run build
npm run lint
npm run format
npm run test
npm run ci  # Runs lint, test, and import verification

# Database operations
npm run db:generate
npm run db:migrate
npm run db:studio
```

### AI Service Commands
```bash
cd ai-service

# Development
python -m uvicorn app.main:app --reload

# Testing (when implemented)
pytest
```

## Architecture

### Monorepo Structure
- **Root**: Workspace configuration with shared dependencies
- **`/nextjs-app`**: Main Next.js application with full-stack functionality
- **`/ai-service`**: Dedicated Python FastAPI service for AI processing

### Key Technologies
- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS, Shadcn/ui
- **Authentication**: Clerk
- **Database**: PostgreSQL with Drizzle ORM
- **AI Service**: FastAPI, OpenAI/Anthropic APIs, Python
- **Payments**: Stripe (if implemented)

### Database Schema
Located in `nextjs-app/db/schema/` with the following main entities:
- `users`: User accounts and study statistics
- `decks`: Organize flashcards into topic-based collections  
- `flashcards`: Store cards with SRS metadata (interval, ease factor, due date)
- `processingJobs`: Track AI processing operations
- `cardTypes`: Define different types of flashcards

### Spaced Repetition System
The SRS implementation is in `nextjs-app/src/lib/srs.ts` and uses Anki's SM-2 variant algorithm with:
- Learning phase handling (interval = 0)
- Ease factor adjustments based on ratings (Again, Hard, Good, Easy)
- UTC-based date calculations to avoid timezone issues

### AI Processing Flow
1. User submits content via Next.js frontend
2. Next.js Server Action creates `processingJobs` record
3. Async HTTP request sent to Python AI Service
4. AI Service processes using OpenAI/Anthropic APIs
5. Results sent back via webhook to Next.js
6. Database updated with results/status

## Code Conventions

### Next.js App (`nextjs-app/`)
- Use `@/` path aliases for imports
- Component files: `PascalCase.tsx`
- Other files: `kebab-case`
- Tag all `.tsx` files with `"use server"` or `"use client"`
- Server Actions must return `Promise<ActionState<TData>>`
- Use Shadcn/ui components, avoid modifying `components/ui` directly
- Database schema exports from `@/db/schema`

### Python AI Service (`ai-service/`)
- FastAPI framework with async/await patterns
- Pydantic models for request/response validation
- Background task processing using FastAPI `BackgroundTasks`
- Structured logging with JSON format
- Environment configuration via Pydantic Settings

### Important Rules from .cursorrules
- **Completeness**: Write complete code with all necessary imports and configurations
- **Environment Variables**: Store secrets in `.env.local`, maintain `.env.example` files
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Database Migrations**: Always use `drizzle-kit generate` and review generated SQL
- **Authentication**: Check `auth()` in all protected Server Actions
- **File Naming**: `kebab-case` except React components (`PascalCase.tsx`)

## Development Workflow

1. **Database Changes**: Generate migrations with `npm run db:generate` and apply with `npm run db:migrate`
2. **Frontend Development**: Use Server Components for data fetching, Client Components for interactivity
3. **AI Integration**: Use the established webhook pattern for async AI processing
4. **Testing**: Run `npm run ci` in nextjs-app for comprehensive checks
5. **Code Quality**: Use provided lint, format, and test commands before committing

## Important Files

- `nextjs-app/lib/srs.ts`: Spaced repetition algorithm implementation
- `nextjs-app/db/schema/`: Database schema definitions
- `.cursorrules`: Comprehensive development guidelines and rules
- `docs/`: Contains action plans and architecture reviews
- Always git add and commit with descriptive message after each task.