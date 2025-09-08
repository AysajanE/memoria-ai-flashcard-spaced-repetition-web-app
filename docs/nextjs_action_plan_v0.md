# Next.js App – Actionable Implementation Plan

This document converts the findings in `docs/nextjs_review.md` into concrete, step‑by‑step tasks the team can execute. Items are grouped by severity and mapped to exact files, changes, and validation steps.

## P0: Secrets & Immediate Safety

- Move webhook simulator off the client
  - Implement `nextjs-app/actions/ai/simulate-webhook.ts` server action that:
    - Reads `INTERNAL_API_KEY` and optional `INTERNAL_WEBHOOK_HMAC_SECRET` from env.
    - Accepts `jobId` and POSTs to `"/api/webhooks/ai-service-status"` with signed body when HMAC secret is set.
    - Guard with `auth()` and `NODE_ENV !== 'production'`.
  - Update `nextjs-app/app/(main)/create/debug/page.tsx`:
    - Replace direct `fetch('/api/webhooks/...')` with `simulateWebhookAction(jobId)`.
    - Remove any hardcoded `x-internal-api-key` and secrets.
  - Add to `nextjs-app/.env.example`:
    - `NEXT_PUBLIC_APP_URL="http://localhost:3000"`
    - `INTERNAL_WEBHOOK_HMAC_SECRET="ChangeMeToARandomLongSecret"`
  - Rotate `INTERNAL_API_KEY` in both apps and redeploy.
  - Validation:
    - Browser DevTools Network: confirm no `x-internal-api-key` leaves the browser.
    - Trigger the simulator; job transitions to terminal state via webhook.

## P1: Webhook Robustness & Job Lifecycle

- Add job state machine helper
  - Create `nextjs-app/lib/job-state.ts`:
    - `export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'`.
    - `isTerminal(s)` and `isLegalTransition(prev, next)` as in review.
  - Add `tests/job-state.test.ts` (Vitest) to cover transitions and terminal detection.

- Harden AI status webhook route
  - Update `nextjs-app/app/api/webhooks/ai-service-status/route.ts`:
    - Read raw body (`await request.text()`) for signature verification.
    - Verify `x-internal-api-key === process.env.INTERNAL_API_KEY`.
    - If `INTERNAL_WEBHOOK_HMAC_SECRET` set, verify HMAC:
      - Require `x-webhook-timestamp` and `x-webhook-signature`.
      - Reject if timestamp age > 5 minutes.
      - Compute `sha256(${ts}.${raw})` and compare using `crypto.timingSafeEqual`.
    - Parse and validate payload (Zod): `jobId`, `status`, optional `resultPayload`, `errorDetail`.
    - Execute a DB transaction:
      - Load current job (status, completedAt) by `jobId`.
      - If terminal, return 200 idempotently.
      - Check `isLegalTransition(current, incomingStatus)`; on violation, return 409.
      - Update: `status`, `resultPayload`, `errorMessage` (from `errorDetail.message` fallback), `errorDetail` (JSON object), `updatedAt`, `completedAt`.
    - Return 200 JSON `{ message: 'Status updated successfully' }`.
  - Validation:
    - Use the debug page’s server action to simulate a success and failure; verify state transitions and that repeated calls are idempotent.
    - Confirm `processing_jobs.error_detail` stores JSON (not stringified text).

- Make AI service sign webhooks
  - In `ai-service`, when POSTing results:
    - Serialize raw payload once; compute HMAC `sha256(${ts}.${raw})` using `INTERNAL_WEBHOOK_HMAC_SECRET`.
    - Send `x-webhook-timestamp`, `x-webhook-signature`, and `x-internal-api-key`.
  - Validation: same as above; signature failures should return 401.

- Unify job state semantics
  - In `nextjs-app/actions/ai/submit-text.ts`, remove the manual `.update(processingJobs).set({ status: 'processing' })` after triggering the AI call.
  - Rely solely on the AI service → webhook to move jobs to `processing`/terminal states.
  - Validation: Create job → remains `pending` until webhook finalizes.

## P1: Schema Duplication & Consistency

- Remove or re‑export duplicate `/app/db/*`
  - Option A (preferred): delete `nextjs-app/app/db/*`; fix imports to use `@/db` or `@/db/schema/*` everywhere.
  - Option B: make `nextjs-app/app/db/*` re‑export the canonical modules from `@/db`.
  - Search and replace all imports of `@/app/db/*` to `@/db/*`.
  - Add lint rule or CI script to forbid future imports from `/app/db/*`.
  - Validation: `rg "@/app/db"` returns no matches; app builds and runs migrations.

## P2: Clerk Webhook & ESLint

- Primary email correctness
  - In `nextjs-app/app/api/webhooks/clerk/route.ts`:
    - Use `primary_email_address_id` to select the primary email; fallback to first.
    - Return 500 if `CLERK_WEBHOOK_SECRET` unset.
    - Accept `user.updated` to keep email in sync.
  - Add `nextjs-app/lib/clerk.ts` with `extractPrimaryEmail()` and Vitest unit tests.
  - Validation: Unit tests pass; manual Clerk event replays update email.

- ESLint config stability
  - Fix `nextjs-app/eslint.config.js` to avoid `import.meta.url` in CJS:
    - Remove `fileURLToPath(import.meta.url)`; use native `__dirname` for `FlatCompat({ baseDirectory })`.
  - Validation: `npm run lint` works locally and in CI.

## P2: Tests & DX

- Vitest baseline
  - Ensure `nextjs-app/package.json` contains `"test": "vitest run"` and add `nextjs-app/vitest.config.ts` with tsconfig paths plugin.
  - Add and run tests:
    - `lib/srs.test.ts` for learning‑phase, EF clamp, monotonic intervals, UTC due dates.
    - `tests/job-state.test.ts` for transition legality.
  - Validation: `npm run test` passes locally and in CI.

## P3: Observability, Limits, and Guardrails (Recommended)

- Observability
  - Add request/job correlation IDs in Next.js logs; use structured JSON logging (align with ai-service pattern).
  - Propagate `jobId` across service boundaries; include in all logs.
  - Optional: Add Sentry or OTEL for tracing.

- Rate limiting
  - Add per‑user rate limit for `submitTextForCardsAction` (e.g., Upstash/Redis: 10 jobs/min/user).
  - Consider IP‑based rate limit on `/api/webhooks/*` to mitigate abuse.

- Input caps
  - Enforce `text` length maximum (e.g., 50k chars) in `FormInputSchema` and server routes.
  - Validate `numCards` range on all ingress points (Next.js and FastAPI).

- CORS tightening (ai-service)
  - Set `CORS_ORIGINS` to specific Next.js origins in production; avoid `*` with credentials.

## Page/Import Cleanups

- Progress page stats source
  - Change `nextjs-app/app/(main)/progress/page.tsx` to import `getUserStatsAction` from `@/actions/db/users` (canonical), not `@/actions/tracking`.

- Remove legacy files
  - Prune unused/legacy files identified in review once the re‑exports are removed and imports updated.

## CI & Policy

- Add CI checks
  - Lint step to forbid `@/app/db/*` imports.
  - Run unit tests on PR.
  - Optionally: simple script to assert `process.env.CLERK_WEBHOOK_SECRET` and `INTERNAL_API_KEY` exist in deployment envs.

## Rollout Checklist

- Secrets
  - [ ] Rotate `INTERNAL_API_KEY` in both apps; invalidate old key everywhere.
  - [ ] Set `INTERNAL_WEBHOOK_HMAC_SECRET` in both apps.

- Deploy order
  - [ ] Deploy Next.js changes (webhook verification can be backward‑compatible if HMAC optional).
  - [ ] Deploy ai-service HMAC signing.
  - [ ] Verify webhook flow end‑to‑end with Debug page server action.

- Regression tests
  - [ ] Run `npm run test` in Next.js.
  - [ ] Manual Clerk event replay for user.created / user.updated.
  - [ ] Generate cards E2E: job → webhook → cards review/save.

