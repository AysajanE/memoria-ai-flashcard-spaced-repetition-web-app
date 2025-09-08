# Memoria Next.js Action Plan — Phased, Step‑by‑Step

> **Goal:** Implement the suggested improvements safely and incrementally with clear ownership, test coverage, and rollback points.
> **Roles used below:** FE = Frontend, BE = Backend, DevOps = Platform/Infra

---

## Phase 0 — Project Prep & Baselines

**Objective:** Align dependencies, unify conventions, and establish a safe baseline for subsequent changes.

**Steps**

1. **Create tracking artifacts (PM)**

   * [ ] Create epic “Next.js Improvements” and sub‑tasks for each phase in your tracker.
   * [ ] Add acceptance criteria and “Definition of Done” (DoD) per task as listed below.

2. **Version alignment & workspace hygiene (DevOps)**

   * [ ] Align `@clerk/nextjs` to a single version across the monorepo (prefer latest supported by Next 14 in the Next.js app).
   * [ ] Run `npm ls @clerk/nextjs` at root to verify hoisting issues are gone.

3. **ESLint config normalization (FE)**

   * [ ] Replace current ESLint config with a flat config extending `next/core-web-vitals`.
   * [ ] Ensure TypeScript, React, Tailwind, and import rules are active.

4. **Single DB entry point + dev HMR caching (BE)**

   * [ ] Remove `db/db.ts`. Keep `db/index.ts` only.
   * [ ] Implement `globalThis.__db__` cache for dev to reuse connections.

5. **Route runtime & caching directives (BE)**

   * [ ] Add `export const runtime = "nodejs"` and `export const dynamic = "force-dynamic"` to:

     * `app/api/webhooks/ai-service-status/route.ts`
     * `app/api/job-status/[jobId]/route.ts`
   * [ ] Remove unsupported `runtime: 'nodejs'` from `middleware.ts` config.

**Definition of Done**

* `pnpm/npm run ci` passes locally.
* No duplicate Clerk versions; ESLint runs without plugin loader errors.
* One DB module (`db/index.ts`) compiled and used everywhere.

**Rollback**

* Revert ESLint change and DB entrypoint merge PR if build fails.

---

## Phase 1 — Data Correctness & Type Unification

**Objective:** Ensure consistent types, prevent placeholder emails, and finish missing DB migration bits.

**Steps**

1. **ActionState & entity types consolidation (BE)**

   * [ ] Keep canonical `ActionState` in `nextjs-app/types/index.ts`:

     ```ts
     export type ActionState<TData = undefined> = {
       isSuccess: boolean;
       message?: string | null;
       error?: Record<string, string[]> | null;
       data?: TData;
     };
     ```
   * [ ] Remove `/app/types/index.ts`; fix imports to `@/types`.
   * [ ] Export inferred types from schema (in `db/schema/index.ts` or `types/index.ts`):

     ```ts
     export type Deck = typeof decks.$inferSelect;
     export type Flashcard = typeof flashcards.$inferSelect;
     ```

2. **Ensure‑user route fix (BE)**

   * [ ] Replace `auth().user` usage with `clerkClient.users.getUser(userId)`.
   * [ ] Make route `POST` and idempotent with `onConflictDoUpdate`.
   * [ ] If the Clerk webhook is reliable, **optionally** delete this route and rely solely on webhook.

3. **Generate required DB migration(s) (BE)**

   * [ ] Ensure `job_type` enum contains `'generate-cards'`.
   * [ ] Ensure `processing_jobs.error_detail jsonb` exists.
   * [ ] Commands:

     ```
     cd nextjs-app
     npm run db:generate
     npm run db:migrate
     ```
   * [ ] Commit generated SQL files.

**Definition of Done**

* No placeholder emails written.
* All server actions import the same `ActionState`.
* Fresh DB passes all migrations without manual SQL.

**Rollback**

* Revert migrations (if needed) using migration journal and restore previous enum.

---

## Phase 2 — Performance: Server‑Render Decks & Remove N+1

**Objective:** Make `/decks` fast and SSR-friendly; avoid per‑deck API fetching.

**Steps**

1. **Convert `app/(main)/decks/page.tsx` to Server Component (FE)**

   * [ ] Remove client hooks (`useEffect`, `toast`) and replace with direct DB query.
   * [ ] Single query for decks + `cardCount` (correlated subquery or `groupBy`).

2. **Add cache tags for decks list (BE+FE)**

   * [ ] Fetch with `{ next: { tags: [\`decks\:list:\${userId}\`] } }\` (if using fetch wrappers); or render dynamic (no caching) for simplicity initially.

3. **Revalidate on writes (BE)**

   * [ ] In `reviewCardsAction`, call `revalidateTag(\`decks\:list:\${userId}\`)\` after inserts.

**Definition of Done**

* `/decks` renders with a single DB call.
* Adding cards via approval updates `/decks` on reload or automatically if using tags elsewhere.

**Rollback**

* Keep old client page around with a route flag; swap back if needed.

---

## Phase 3 — Real‑Time Job Updates (Replace or Reduce Polling)

**Objective:** Make `/create/[jobId]` update immediately when the webhook arrives.

**Steps (Option A — Revalidation Tags)**

1. **Emit tag revalidation on webhook (BE)**

   * [ ] After successful DB update in `ai-service-status` webhook, call:

     ```ts
     import { revalidateTag } from "next/cache";
     revalidateTag(`job:${validatedPayload.jobId}`);
     ```

2. **Read job with tags (FE)**

   * [ ] In `/create/[jobId]`, make the status-containing part a Server Component that fetches with `next: { tags: [\`job:\${jobId}\`] }\`.
   * [ ] Retain a small client component for interactions (approvals, dialog).

3. **Keep minimal fallback polling (FE)**

   * [ ] If desired, keep a 30s fallback poll when status hasn’t changed after N seconds.

**(Optional) Steps (Option B — SSE)**

* [ ] Implement `/api/job-status/[jobId]/stream` with `ReadableStream` & `BroadcastChannel`.
* [ ] On webhook, broadcast job updates; in client, `EventSource` to apply state.

**Definition of Done**

* In local dev, completing `simulate-webhook` updates the page within 1–2 seconds without refresh.
* Polling reduced or disabled.

**Rollback**

* Remove tag read and go back to 3s polling.

---

## Phase 4 — Study UX + SRS Level & Streak Robustness

**Objective:** Improve learning flow and ensure SRS metadata is fully updated.

**Steps**

1. **SRS writeback update (BE)**

   * [ ] In `recordStudyRatingAction`:

     * Increment `srsLevel` for Good/Easy; reset to 0 for Again; keep for Hard.
     * Keep ease/interval updates as implemented.
   * [ ] Use integer day diff for streak:

     ```ts
     const MS_PER_DAY = 86_400_000;
     const dayDiff = lastStudiedDayUTC
       ? Math.floor((todayUTC.getTime() - lastStudiedDayUTC.getTime()) / MS_PER_DAY)
       : Infinity;
     // if dayDiff >= 1 reset daily, increment streak if === 1
     ```

2. **Keyboard shortcuts & a11y (FE)**

   * [ ] Space toggles answer; `1/2/3/4` select ratings.
   * [ ] Add `aria-live="polite"` announcements for “Answer shown”, “Card N of M”, and “Session complete”.

3. **Unit tests (BE)**

   * [ ] Extend `lib/srs.test.ts` for `srsLevel` update expectations.
   * [ ] Add tests that verify streak updates across UTC day boundaries.

**Definition of Done**

* Keyboard shortcuts work; screen readers announce state changes.
* SRS level is updated and visible in DB.

**Rollback**

* Feature flag the keyboard shortcuts; revert writeback to prior version.

---

## Phase 5 — Real Progress Stats

**Objective:** Show real user statistics instead of zeros.

**Steps**

1. **Compute stats in `getUserStatsAction` (BE)**

   * [ ] Read `dailyStudyCount`, `weeklyStudyCount`, `totalReviews`, `totalCorrectReviews`, `consecutiveStudyDays`.
   * [ ] Compute `accuracy = totalCorrectReviews / totalReviews * 100`.

2. **Wire to `StatsDisplay` (FE)**

   * [ ] Verify the numbers render and format to 1 decimal place for accuracy.

3. **E2E sanity check (QA)**

   * [ ] Run a small session; verify counters increment and UI updates.

**Definition of Done**

* Dashboard and Progress pages show live stats values from DB.

**Rollback**

* Return temporary default values if query fails.

---

## Phase 6 — Durable Rate Limiting

**Objective:** Replace in-memory rate-limit with a durable mechanism.

**Steps**

1. **Choose backend (DevOps)**

   * [ ] Upstash Redis (simple) or Vercel KV. Provision and capture credentials.

2. **Implement limiter (BE)**

   * [ ] Wrap existing `enforceRateLimit(userId, namespace)` to call the Redis/KV limiter.
   * [ ] Keep a dev fallback (in-memory) when no `REDIS_URL` is present.

3. **Env & observability (DevOps)**

   * [ ] Add `REDIS_URL` / `UPSTASH_REDIS_REST_URL` to `.env.example`, set secrets in hosting platform.

4. **Tests**

   * [ ] Simulate hitting limit and assert 429-like failure path.

**Definition of Done**

* AI submission endpoints reject excess requests consistently across instances.

**Rollback**

* Fallback to in-memory limiter by feature flag.

---

## Phase 7 — Security Headers & Markdown Sanitization

**Objective:** Reduce XSS and clickjacking risks.

**Steps**

1. **Security headers in middleware (BE)**

   * [ ] Append headers:

     * `X-Frame-Options: DENY`
     * `Referrer-Policy: strict-origin-when-cross-origin`
     * `X-Content-Type-Options: nosniff`
     * CSP (minimal):
       `default-src 'self'; img-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none';`
   * [ ] Adjust CSP tokens based on Clerk assets if needed.

2. **Sanitize Markdown (FE)**

   * [ ] In `components/shared/markdown-renderer.tsx`, add `rehype-sanitize` to the `react-markdown` pipeline to strip unsafe HTML.

**Definition of Done**

* Headers visible in network tab.
* Rendering safe with untrusted Markdown.

**Rollback**

* Loosen CSP directives for specific assets while keeping core protections.

---

## Phase 8 — CI Hardening & Tests

**Objective:** Strengthen CI to catch regressions and enforce rules.

**Steps**

1. **Fix “forbidden import” script (DevOps)**

   * [ ] Update path searched by ripgrep to `.` instead of `nextjs-app` from inside the app.
   * [ ] Fail build if any `@/app/db` imports exist.

2. **Action tests & route tests (BE)**

   * [ ] Add Vitest tests for:

     * `recordStudyRatingAction` (happy & edge paths)
     * Webhook handler (`ai-service-status`) valid/invalid signature payloads
     * Job-state transitions (already present—extend coverage)

3. **Basic e2e (QA)**

   * [ ] Add Playwright (or Cypress) tests for:

     * Sign-in flow (dev-only stub if needed)
     * Submit text, receive webhook (use `simulateWebhookAction`)
     * Approve & save → decks update without N+1 calls
     * Study a card and see stats update

**Definition of Done**

* CI runs unit + e2e; PRs fail on forbidden imports.
* Coverage threshold agreed by the team (e.g., statements 70%+).

**Rollback**

* Make e2e optional (non-blocking) initially, then enforce once stable.

---

## Phase 9 — Cleanup & Routing

**Objective:** Remove duplication, unused code, and clarify routing.

**Steps**

1. **Remove duplicate Landing page (FE)**

   * [ ] Delete `/app/landing/page.tsx` or add a redirect to `/` in `next.config.js`.

2. **Remove unused imports & dead code (FE/BE)**

   * [ ] Sweep API routes (e.g., `count` imported but unused).
   * [ ] Ensure all types import from `@/types`.

3. **Middleware config simplification (BE)**

   * [ ] Adjust `authMiddleware` public routes list to explicit patterns for `/sign-in(.*)`, `/sign-up(.*)`, `/articles(.*)`.

**Definition of Done**

* No duplicate pages; clean imports; predictable auth guard behavior.

**Rollback**

* Retain redirect rather than delete if needed for marketing campaigns.

---

## Phase 10 — Documentation, Ops & Rollout

**Objective:** Make the changes operable, discoverable, and easy to maintain.

**Steps**

1. **Docs updates (All)**

   * [ ] `README.md`: Update env vars (`REDIS_URL`, `NEXT_PUBLIC_APP_URL`), security headers, and cache tags strategy.
   * [ ] `docs/nextjs_action_plan.md`: Move this action plan there; link from root README.

2. **Operational runbooks (DevOps)**

   * [ ] Webhook HMAC rotation steps and troubleshooting guide.
   * [ ] Rate limit overrides procedure.
   * [ ] DB migration checklist (preflight backup, smoke tests).

3. **Monitoring & logging (BE/DevOps)**

   * [ ] Ensure `lib/log.ts` JSON logs are visible in your platform (e.g., Vercel/CloudWatch).
   * [ ] Log webhook failures with payload category & code (already modeled in `errorDetail`).

**Definition of Done**

* Docs accurately reflect the new architecture and ops practices.
* Team can onboard without context loss.

**Rollback**

* Keep prior docs; add a note pointing to the old behavior if rollbacks occur.

---

## Acceptance Criteria Summary (Per Major Deliverable)

* **Decks Page Refactor**

  * [ ] Single DB query returns decks with counts.
  * [ ] No client‑side fetch loop; page is a Server Component.
  * [ ] Post‑approval, deck list updates via `revalidateTag`.

* **Job Status Real‑Time**

  * [ ] Webhook revalidates job tag.
  * [ ] `/create/[jobId]` updates without active polling.
  * [ ] Fallback polling (optional) is > 20s or disabled.

* **SRS Updates**

  * [ ] `srsLevel` reflects ratings.
  * [ ] Streak math robust over UTC day boundaries.

* **Stats**

  * [ ] Dashboard shows live accuracy, daily, weekly, streak.
  * [ ] Values match DB after study actions.

* **Rate Limiting**

  * [ ] Exceeding limit returns a friendly error.
  * [ ] Works across multiple instances (non in-memory).

* **Security**

  * [ ] Security headers present.
  * [ ] Markdown sanitized.

* **CI**

  * [ ] “Forbidden imports” script correctly blocks bad imports.
  * [ ] Unit + basic e2e execute in CI.

---

## Suggested PR Breakdown & Owners

1. **PR-1 (DevOps/BE):** DB client unification + ESLint flat config + Clerk version alignment.
2. **PR-2 (BE):** ActionState/type unification; ensure‑user fix; migrations for `job_type` & `error_detail`.
3. **PR-3 (FE/BE):** Decks page server component + tag-based revalidation in `reviewCardsAction`.
4. **PR-4 (BE/FE):** Webhook tag revalidation + `/create/[jobId]` SSR status; reduce polling.
5. **PR-5 (BE/FE):** SRS writeback (`srsLevel`, streak) + keyboard shortcuts & a11y.
6. **PR-6 (BE):** Stats endpoint real values; UI integration.
7. **PR-7 (BE/DevOps):** Durable rate limiting (Upstash/KV) + env + docs.
8. **PR-8 (BE/FE):** Security headers + Markdown sanitization.
9. **PR-9 (DevOps/QA):** CI script fix + action tests + basic e2e.
10. **PR-10 (All):** Cleanups, redirects, final docs.

---

## Risks & Mitigations

* **Risk:** Enum migrations on existing DBs.

  * **Mitigation:** `ADD VALUE IF NOT EXISTS`, backup & apply in maintenance window.
* **Risk:** CSP breaks Clerk/asset loading.

  * **Mitigation:** Start with report-only CSP in staging; widen directives as necessary.
* **Risk:** Tag revalidation not firing in prod.

  * **Mitigation:** Add debug logs on webhook; add a manual revalidate endpoint (admin only) during rollout.
* **Risk:** Rate limiter false positives.

  * **Mitigation:** Namespaced keys per action; increased thresholds initially; telemetry.

---

## Communication Plan

* **Kickoff:** Share this plan in `docs/nextjs_action_plan.md`; assign owners per PR.
* **Changelog:** Maintain `docs/CHANGELOG.md` by PR.
* **Release notes:** Summarize user-visible changes (faster decks, real-time job updates, better security).

---

## Post‑Deployment Verification Checklist

* [ ] Create sample text → job created → webhook simulate → page updates without refresh.
* [ ] Approve cards to new deck → deck count updates on `/decks`.
* [ ] Study session → streak and stats reflect accurately.
* [ ] Hitting submission repeatedly triggers rate limit error (friendly UI).
* [ ] Security headers present; Markdown renders safely.
* [ ] CI green; error logs quiet in normal flow.

---

**Done right**, these phases will make the app faster, safer, and more maintainable while preserving your current user flows and minimizing disruption.
