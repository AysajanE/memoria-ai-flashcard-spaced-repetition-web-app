# Memoria AI Service (Next.js App)

This is the primary Next.js application for Memoria, an AI-powered flashcard and spaced repetition system.

## Features

- AI-driven flashcard generation
- Spaced repetition study mode
- Deck management
- Progress tracking
- User authentication (Clerk)
- Basic subscription/billing scaffolding (Stripe)

## Environment Variables

We have updated `.env.example` to unify and clarify variable names:

- `AI_SERVICE_BASE_URL` (instead of `AI_SERVICE_URL`) references the Python AI service location.
- `INTERNAL_API_KEY` is the shared secret for verifying requests to/from the AI microservice.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, etc., for Clerk authentication.
- `DATABASE_URL` for your Postgres database.
- Optional Stripe variables for payment (Phase 3).

After copying `.env.example` to `.env.local`, fill in all necessary values. **Never** commit `.env.local`.

## Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```
3. Copy the `.env.example` to `.env.local` and fill in the required values
4. Run the development server:
   ```bash
   npm run dev
   ```

### Tests

- Run unit tests (Vitest):
  ```bash
  npm run test
  ```
  This includes tests for SRS scheduling and Clerk webhook email extraction.

### AI Service Setup

1. Navigate to the `ai-service` directory
2. Create a Python virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy `.env.example` to `.env.local` and fill in the required values
5. Run the development server:
   ```bash
  uvicorn app.main:app --reload --port 8000
  ```

### Webhook Security (Recommended)

- Set `INTERNAL_WEBHOOK_HMAC_SECRET` in `.env.local` to enable HMAC verification on `/api/webhooks/ai-service-status`.
- Rotate `INTERNAL_API_KEY` immediately if it was ever exposed (older debug page sent a hardcoded key).
- In development, use the debug page `/create/debug`. It now uses a server action that reads secrets server-side — no secrets are sent from the browser.

## Environment Variables

### Next.js App

```
# Database
DATABASE_URL=postgresql://postgres:...

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# AI Service
AI_SERVICE_BASE_URL=http://localhost:8000
INTERNAL_API_KEY=your-internal-api-key

# Supabase Storage
NEXT_PUBLIC_SUPABASE_URL=https://...
SUPABASE_SERVICE_KEY=ey...
UPLOADS_BUCKET_NAME=uploads

# Stripe (Phase 3)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
```

### AI Service

```
# API Configuration
API_PORT=8000
INTERNAL_API_KEY=your-internal-api-key-here

# AI Service Configuration
NEXTJS_APP_STATUS_WEBHOOK_URL=http://localhost:3000/api/webhooks/ai-service-status

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here
DEFAULT_OPENAI_MODEL=gpt-4o-mini

# Anthropic Configuration
ANTHROPIC_API_KEY=your-anthropic-api-key-here
DEFAULT_ANTHROPIC_MODEL=claude-haiku-3-5-latest
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
