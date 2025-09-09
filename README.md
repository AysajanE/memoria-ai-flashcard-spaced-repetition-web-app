# Memoria - AI-Powered Flashcard Creation with Spaced Repetition

Memoria is an application that helps you create flashcards from your learning materials using AI, and then study them with a spaced repetition system (SRS) for efficient memorization.

## Project Structure

The project consists of two main parts:

1. **Next.js Web Application** (`/nextjs-app`): The frontend and main application logic
2. **AI Service** (`/ai-service`): A Python FastAPI service for AI-powered flashcard generation

### Key Features

- **AI-Powered Flashcard Generation**: Convert your notes and texts into well-structured flashcards
- **Spaced Repetition**: Study cards using an optimized algorithm based on the Anki SM-2 variant (implementation in `/nextjs-app/src/lib/srs.ts`)
- **Progress Tracking**: Track your learning progress with detailed statistics
- **Educational Content**: Access articles about spaced repetition and effective learning techniques

## Getting Started

## Environment Configuration

### Required Environment Variables

Copy `.env.example` to `.env.local` in the `nextjs-app` directory and configure:

#### Authentication (Clerk)
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
CLERK_WEBHOOK_SECRET="whsec_..." # For user creation webhooks
```

#### Database
```bash
DATABASE_URL="postgresql://user:pass@host:5432/memoria_db"
```

#### AI Service Integration
```bash
AI_SERVICE_BASE_URL="http://localhost:8000"  # Python service URL
INTERNAL_API_KEY="your-secure-api-key"       # Shared secret
INTERNAL_WEBHOOK_HMAC_SECRET="hmac-secret"   # Webhook signing (optional but recommended)
```

#### Rate Limiting (Production)
```bash
REDIS_URL="redis://localhost:6379"           # For Redis rate limiting
UPSTASH_REDIS_REST_URL="https://..."         # Alternative for Vercel/serverless
UPSTASH_REDIS_REST_TOKEN="token..."          # Upstash auth token
```

#### Application URLs
```bash
NEXT_PUBLIC_APP_URL="https://your-domain.com" # Production URL for webhooks
```

#### File Storage (Optional)
```bash
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
SUPABASE_SERVICE_KEY="service-role-key"
UPLOADS_BUCKET_NAME="uploads-bucket"
```

### Security Headers

The application includes comprehensive security headers:
- Content Security Policy (CSP)
- HSTS (HTTP Strict Transport Security) 
- X-Frame-Options, X-Content-Type-Options
- CSRF protection via SameSite cookies

Configure CSP domains in production via `NEXT_PUBLIC_APP_URL`.

### Cache Tags Strategy

The application uses Next.js cache tags for granular invalidation:
- `user-{userId}` - User-specific data
- `deck-{deckId}` - Individual deck data
- `cards-{deckId}` - Cards belonging to a deck
- `processing-job-{jobId}` - AI processing status

Cache invalidation happens automatically on data mutations through Server Actions.

### Running the Next.js Application

The Next.js application is now consolidated in the `/nextjs-app` directory:

```bash
cd nextjs-app
npm install
npm run dev
```

### Running the AI Service

```bash
cd ai-service
pip install -r requirements.txt
python -m app.main
```

## Architecture

### Tech Stack

- **Frontend**: Next.js with React and TypeScript
- **Authentication**: Clerk
- **Database**: PostgreSQL with Drizzle ORM
- **AI Processing**: Python FastAPI service using OpenAI/Claude APIs
  - Synchronized type definitions between frontend and backend
  - Configurable card generation (type, count, model)
  - Comprehensive error handling with categorization and suggestions

### Database Schema

The application uses several related tables:
- Users: Store user accounts and study statistics
- Decks: Organize flashcards into topic-based collections
- Flashcards: Store the actual cards with SRS metadata (interval, ease factor, due date)
- Processing Jobs: Track AI processing operations

The canonical schema is defined in `/nextjs-app/db/schema` and is accessible via:
- Direct import from `/nextjs-app/db/schema`

## Development

### Database Migrations

```bash
cd nextjs-app
npm run db:generate
npm run db:migrate
```

### Linting and Formatting

```bash
cd nextjs-app
npm run lint
npm run format
```

## Documentation

- [Detailed Implementation Plan](./docs/nextjs_detailed_implementation_plan.md) - Step-by-step implementation guide
- [Action Plan](./docs/nextjs_action_plan_v1.md) - High-level roadmap and phases
- [Expert Review](./docs/nextjs_review_v1.md) - Architecture analysis and recommendations