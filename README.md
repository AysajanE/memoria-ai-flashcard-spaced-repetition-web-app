# Memoria - AI-Powered Flashcard Creation with Spaced Repetition

Memoria is an application that helps you create flashcards from your learning materials using AI, and then study them with a spaced repetition system (SRS) for efficient memorization.

## Project Structure

The project consists of two main parts:

1. **Next.js Web Application** (`/nextjs-app`): The frontend and main application logic
2. **AI Service** (`/ai-service`): A Python FastAPI service for AI-powered flashcard generation

### Key Features

- **AI-Powered Flashcard Generation**: Convert your notes and texts into well-structured flashcards
- **Spaced Repetition**: Study cards using an optimized algorithm based on the Anki SM-2 variant
- **Progress Tracking**: Track your learning progress with detailed statistics
- **Educational Content**: Access articles about spaced repetition and effective learning techniques

## Getting Started

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

### Database Schema

The application uses several related tables:
- Users: Store user accounts and study statistics
- Decks: Organize flashcards into topic-based collections
- Flashcards: Store the actual cards with SRS metadata (interval, ease factor, due date)
- Processing Jobs: Track AI processing operations

The canonical schema is defined in `/nextjs-app/src/db/schema` and is accessible via:
- Import from `@/db/schema`
- Direct import from `/nextjs-app/src/db/schema`

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