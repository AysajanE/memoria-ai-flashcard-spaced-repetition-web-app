# Memoria: AI Flashcard Creation with Spaced Repetition

Memoria is a full-stack learning product that turns source material into flashcards and then helps users review those cards with a spaced-repetition workflow.

This repository is more than a quick demo. It combines product design, full-stack application logic, an AI generation service, and study-system mechanics in one codebase.

## Architecture

The project has two main application surfaces:

- `nextjs-app/`: the main web application built with Next.js, TypeScript, Clerk, and Drizzle
- `ai-service/`: a Python FastAPI service responsible for AI-assisted flashcard generation

Supporting materials live in:

- `docs/`: implementation plans, reviews, and design notes
- root workspace files: monorepo wiring, shared scripts, and local development helpers

## Product capabilities

- AI-assisted flashcard generation from notes and study material
- deck and card workflows for organizing learning content
- spaced-repetition scheduling for review sessions
- user accounts and progress tracking
- authenticated web application flows
- testable separation between frontend application logic and AI processing logic

## Tech stack

- Next.js + React + TypeScript
- Python + FastAPI
- Clerk authentication
- PostgreSQL + Drizzle ORM
- Playwright / Vitest / service-side test tooling

## Local development

At the repo root:

```bash
npm install
```

Run the frontend:

```bash
npm run dev:next
```

Run the AI service:

```bash
cd ai-service
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

Environment setup starts from the checked-in `.env.example` files in the root, `nextjs-app/`, and `ai-service/`.

## Why this repo matters

For portfolio purposes, Memoria shows:

- product thinking rather than just model experimentation
- full-stack implementation across web, API, auth, and data layers
- a concrete AI use case with operational boundaries between application code and model-serving code

## Suggested review path

If you want the fastest tour of the repo, start with:

1. `README.md`
2. `nextjs-app/README.md`
3. `ai-service/README.md`
4. `nextjs-app/package.json`
5. `ai-service/pyproject.toml`
