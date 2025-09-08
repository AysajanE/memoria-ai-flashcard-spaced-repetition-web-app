## Executive Summary (≤1 page)

**P0 / P1 Risks & One‑Line Fixes**

1. **(P0) Client-side secret leak** – `/app/(main)/create/debug/page.tsx` sends `x-internal-api-key` from the browser (hardcoded).
   **Fix:** Move webhook simulation to a **server action** that reads secrets from env; guard in dev only; **rotate** `INTERNAL_API_KEY`.

2. **(P1) Webhook stores errorDetail as string** – `/api/webhooks/ai-service-status` stringifies JSON into a `jsonb` column; no state transition checks; replayable.
   **Fix:** Store `errorDetail` as **object**, not string; **verify HMAC** (optional but recommended); **enforce legal transitions** & idempotency; ignore replays.

3. **(P1) Schema/type duplication** – Duplicate DB client & schema under `/app/db/*` with drift from canonical `/db/*`.
   **Fix:** Make `/app/db/*` **re-export** from canonical modules (or remove entirely); keep a single source of truth.

4. **(P1) Inconsistent job state semantics** – One path sets `processing` immediately, another defers to AI service/webhook.
   **Fix:** **Do not** set `processing` in `submitTextForCardsAction`; let AI service update state via webhook for consistency.

**Top Opportunities**

* **Observability:** Add stable **job state machine** helper & **JSON logging** with request/job IDs; unit-test transitions.
* **SRS Confidence:** Add **unit tests** for learning‑phase, EF clamps, interval monotonicity, due date UTC.
* **Webhook Robustness:** Add **HMAC** auth + timestamp window; idempotency and transition rules.
* **DX & Safety:** Add **Vitest** with preset config; CI to prevent schema duplication & drift; prune legacy files.

---

## Findings Table

| ID | Sev | Area          | File\:Line                                                       | Problem                                                           | Why it matters                                    | Fix                                                                          | Tests                                                       | Effort               |
| -- | --- | ------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------- |
| A  | P0  | Secrets       | `nextjs-app/app/(main)/create/debug/page.tsx:~70`                | Client sends hardcoded `x-internal-api-key`                       | Leaks internal secret via client bundle & network | Move webhook trigger to **server action**, dev-guard; rotate key             | `simulateWebhookAction` happy-path; ensure no key in client | S                    |
| B  | P1  | Webhook/Error | `nextjs-app/app/api/webhooks/ai-service-status/route.ts:~38,~61` | `errorDetail` stringified into jsonb; no HMAC; replayable updates | Data loss (can't query JSON), tampering/replays   | Store object, add **HMAC+timestamp**, **legal transitions**, **idempotency** | `job-state.test.ts` transition tests                        | M                    |
| C  | P1  | Schema        | `/app/db/schema/*`, `/app/db/index.ts`                           | Duplicate schema/DB diverges from canonical                       | Drift & subtle prod bugs                          | Make `/app/db/*` **re-export** canonical or delete                           | None needed                                                 | S                    |
| D  | P2  | ESLint        | `nextjs-app/eslint.config.js:~7-12`                              | CJS using `import.meta.url`                                       | Breaks in CJS context                             | Use native `__dirname` sans `import.meta.url`                                | Lint runs                                                   | XS                   |
| E  | P2  | SRS/Stats     | `actions/study.ts`                                               | UTC only streak/day boundaries                                    | Wrong streaks for non‑UTC users                   | Add user timezone later; document UTC fallback                               | `srs.test.ts` covers UTC due dates                          | M (future DB change) |
| F  | P1  | Job state     | `actions/ai/submit-text.ts:~120`                                 | Forces `processing` immediately                                   | Violates webhook‑driven lifecycle; confusing      | Remove proactive `processing` set                                            | Covered by state machine                                    | S                    |
| G  | P2  | Clerk webhook | `app/api/webhooks/clerk/route.ts:~39`                            | Primary email selection uses first address, not primary           | Potential wrong email in DB                       | Use Clerk’s `primary_email_address_id` fallback to first                     | Add unit test later                                         | XS                   |
| H  | P2  | Tests/DX      | No test harness                                                  | Hard to validate logic/regressions                                | Add **Vitest** and targeted tests                 | `srs.test.ts`, `job-state.test.ts`                                           | S                                                           |                      |

> Line numbers are approximate; patches below show exact hunks.

---

## Architecture Notes

**Create → Job → Webhook → Approve → Study** (Happy Path)

1. **Create** (`/create`): User submits text → `submitTextForCardsAction` inserts **processing\_jobs** record with `status='pending'` and calls AI service (`/api/v1/generate-cards`) with `jobId`.
2. **Job**: AI processes async; on start/finish, AI service **POSTs** to our webhook `/api/webhooks/ai-service-status`.
3. **Webhook**: Validates API key (+ optional **HMAC**); **enforces state transitions** (`pending|processing` → `completed|failed`), stores `resultPayload` or `errorDetail`, sets `completedAt`.
4. **Approve** (`/create/[jobId]`): Polls job; on `completed`, user **approves** and saves cards to existing or new deck.
5. **Study** (`/study/[deckId]`): Shows due cards (<= now), user rates → **SRS** updates intervals/due dates; stats update.

**Core Data Invariants**

* `processing_jobs.status ∈ {pending, processing, completed, failed}`
* Legal transitions: `pending → processing → (completed|failed)` OR `pending → (completed|failed)`; no transitions from terminal states.
* `flashcards.srsEaseFactor ∈ [1.3, 2.5]` (stored as string due to `numeric(4,2)`)
* `flashcards.srsInterval ≥ 0`; if `0` ⇒ learning phase
* `srsDueDate` must be **≥ now** (UTC), never past due on update

---

## Security & Privacy Review

* **AuthZ:** All job & deck routes verify `userId` ownership (✅).
* **Secrets:** **P0 leak** fixed by removing client‑side secret; require rotation of `INTERNAL_API_KEY` (✅).
* **Webhooks:** Before: **API key only**, replayable, no state checks. After: optional **HMAC+timestamp window (5m)**, **idempotency**, **legal transitions** (✅).
* **Rate limiting:** Add later at edge (middleware) or via upstream reverse proxy (not included in patch).
* **CORS:** Webhook runs server‑to‑server (same origin). Keep tight. (Ensure AI service **allowlists** Next app origin.)
* **Input limits:** Consider max text length and card count enforced (client already caps 50). Recommend additional server-side caps + schema validation in AI service.
* **Logging:** Avoid PII in logs. We include jobId‑scoped logs; prefer JSON logs in prod.
* **CSRF:** Server actions protected by Clerk; webhook uses key/HMAC and is public route (OK).

---

## SRS Correctness Review

* **Learning phase**: `Again → 0`, `Hard → 1`, `Good → 1`, `Easy → 3` days (✓)
* **Ease Factor**: Adjusts by rating; clamped to `[1.3, 2.5]` (✓)
* **Intervals**: Monotonic for matured cards: `Easy ≥ Good ≥ Hard ≥ 1`, `Again → 0` (✓)
* **UTC Due Dates**: `setUTCDate` avoids local timezone drift (✓)
* **Idempotency**: `recordStudyRatingAction` applies once per click; encapsulated in a transaction with stats update (✓)

We add **tests** to validate: learning intervals, EF clamp, monotonicity, due dates not in past.

---

## Observability & DX Review

* **Tests (added):** Vitest config + **`srs.test.ts`** and **`job-state.test.ts`**.
* **State Machine helper (added):** `lib/job-state.ts` centralizes legal job transitions.
* **Logs:** Route logs include jobId & transition reason (suggest converting to JSON logger later).
* **CI Recommendation:** Add a check to ensure no imports from `/app/db/*` and no schema drift (not part of patch).
* **Developer Ergonomics:** Server‑side debug webhook simulator replaces unsafe client path.

---

## PR‑Ready Patches (unified diff)

> Apply in repo root. These include code fixes + minimal tests + dev guard.

### 1) **Fix P0: Remove client secret; add server action simulator**

```diff
diff --git a/nextjs-app/app/(main)/create/debug/page.tsx b/nextjs-app/app/(main)/create/debug/page.tsx
index 2c9c5c1..a09f7a8 100644
--- a/nextjs-app/app/(main)/create/debug/page.tsx
+++ b/nextjs-app/app/(main)/create/debug/page.tsx
@@ -1,36 +1,49 @@
 "use client";
 
 import { useState, useEffect } from "react";
-import { listPendingJobsAction } from "@/actions/ai";
+import { listPendingJobsAction } from "@/actions/ai";
+import { simulateWebhookAction } from "@/actions/ai/simulate-webhook";
 
 export default function DebugPage() {
   const [jobs, setJobs] = useState<any[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
 
+  // Disable this page in production builds
+  if (process.env.NODE_ENV === "production") {
+    return (
+      <div className="container mx-auto py-8">
+        <h1 className="text-2xl font-bold mb-4">Pending Jobs Debug</h1>
+        <p className="text-muted-foreground">
+          This debug page is disabled in production.
+        </p>
+      </div>
+    );
+  }
+
   const fetchJobs = async () => {
     setLoading(true);
     try {
       const result = await listPendingJobsAction();
       if (result.isSuccess) {
         setJobs(result.data || []);
       } else {
         setError(result.message || "Failed to load jobs");
       }
     } catch (err) {
       setError("Error fetching jobs");
       console.error(err);
     } finally {
       setLoading(false);
     }
   };
 
   useEffect(() => {
     fetchJobs();
   }, []);
 
-  const sendWebhook = async (jobId: string) => {
+  const sendWebhook = async (jobId: string) => {
     try {
-      const response = await fetch('/api/webhooks/ai-service-status', {
-        method: 'POST',
-        headers: {
-          'Content-Type': 'application/json',
-          'x-internal-api-key': 'memoria_ai_service_secret_key_2024'
-        },
-        body: JSON.stringify({
-          jobId: jobId,
-          status: "completed",
-          resultPayload: {
-            cards: [
-              {
-                front: "What is AI?",
-                back: "AI is intelligence demonstrated by machines, as opposed to natural intelligence displayed by animals including humans."
-              },
-              {
-                front: "How is AI different from natural intelligence?",
-                back: "AI is demonstrated by machines, while natural intelligence is displayed by animals including humans."
-              }
-            ]
-          }
-        })
-      });
-
-      if (!response.ok) {
-        const errorData = await response.json();
-        console.error("Webhook error:", errorData);
-        alert(`Error: ${JSON.stringify(errorData)}`);
-      } else {
-        alert("Webhook sent successfully");
-        await fetchJobs(); // Refresh the list
-      }
+      const res = await simulateWebhookAction(jobId);
+      if (!res.ok) {
+        alert(`Error: ${res.message}`);
+        return;
+      }
+      alert("Webhook sent successfully");
+      await fetchJobs();
     } catch (err) {
       console.error("Error sending webhook:", err);
       alert(`Error sending webhook: ${err}`);
     }
   };
 
   return (
@@ -82,7 +95,7 @@ export default function DebugPage() {
               <p><strong>Job ID:</strong> {job.id}</p>
               <p><strong>Status:</strong> {job.status}</p>
               <p><strong>Created:</strong> {new Date(job.createdAt).toLocaleString()}</p>
-              <button
+              <button
                 onClick={() => sendWebhook(job.id)}
                 className="bg-green-500 text-white px-4 py-2 rounded mt-2"
               >
                 Send Completion Webhook
               </button>
diff --git a/nextjs-app/actions/ai/simulate-webhook.ts b/nextjs-app/actions/ai/simulate-webhook.ts
new file mode 100644
index 0000000..d16ef7b
--- /dev/null
+++ b/nextjs-app/actions/ai/simulate-webhook.ts
@@ -0,0 +1,74 @@
+"use server";
+
+import { auth } from "@clerk/nextjs";
+import crypto from "crypto";
+
+/**
+ * Dev-only helper to simulate AI service completion webhook without exposing secrets to the client.
+ */
+export async function simulateWebhookAction(jobId: string): Promise<{ ok: boolean; message: string }> {
+  const { userId } = auth();
+  if (!userId) {
+    return { ok: false, message: "Unauthorized" };
+  }
+  if (process.env.NODE_ENV === "production") {
+    return { ok: false, message: "Disabled in production" };
+  }
+
+  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
+  const apiKey = process.env.INTERNAL_API_KEY || "";
+  if (!apiKey) {
+    return { ok: false, message: "Missing INTERNAL_API_KEY" };
+  }
+
+  const payload = {
+    jobId,
+    status: "completed" as const,
+    resultPayload: {
+      cards: [
+        { front: "What is AI?", back: "AI is intelligence demonstrated by machines." },
+        { front: "Define SRS.", back: "Spaced Repetition System optimizes review scheduling." },
+      ],
+    },
+  };
+  const raw = JSON.stringify(payload);
+
+  const headers: Record<string, string> = {
+    "Content-Type": "application/json",
+    "x-internal-api-key": apiKey,
+  };
+
+  // Optional HMAC for dev parity with production webhook verification
+  const hmacSecret = process.env.INTERNAL_WEBHOOK_HMAC_SECRET;
+  if (hmacSecret) {
+    const ts = Date.now().toString();
+    const mac = crypto.createHmac("sha256", hmacSecret).update(`${ts}.${raw}`).digest("hex");
+    headers["x-webhook-timestamp"] = ts;
+    headers["x-webhook-signature"] = `sha256=${mac}`;
+  }
+
+  const res = await fetch(`${baseUrl}/api/webhooks/ai-service-status`, {
+    method: "POST",
+    headers,
+    body: raw,
+  });
+
+  if (!res.ok) {
+    let errText = `${res.status}`;
+    try {
+      const data = await res.json();
+      errText += ` ${data.error || ""}`;
+    } catch {
+      // ignore
+    }
+    return { ok: false, message: `Webhook failed: ${errText}` };
+  }
+  return { ok: true, message: "OK" };
+}
```

---

### 2) **Fix P1: Webhook `errorDetail` + HMAC + State machine + Idempotency**

```diff
diff --git a/nextjs-app/app/api/webhooks/ai-service-status/route.ts b/nextjs-app/app/api/webhooks/ai-service-status/route.ts
index 5b9a0c0..309c8a7 100644
--- a/nextjs-app/app/api/webhooks/ai-service-status/route.ts
+++ b/nextjs-app/app/api/webhooks/ai-service-status/route.ts
@@ -1,12 +1,16 @@
-import { NextResponse } from "next/server";
+import { NextResponse } from "next/server";
 import { db } from "@/db";
 import { processingJobs } from "@/db/schema";
 import { eq } from "drizzle-orm";
 import { z } from "zod";
+import crypto from "crypto";
+import { isLegalTransition, isTerminal } from "@/lib/job-state";
 
 // Define error detail schema for better error handling
 const ErrorCategory = z.enum([
   "invalid_input",
   "token_limit",
   "auth_error",
   "rate_limit",
   "ai_model_error",
   "parse_error",
   "network_error",
   "webhook_error",
   "internal_error",
   "unknown_error"
 ]);
 
 const ErrorDetailSchema = z.object({
   message: z.string(),
   category: ErrorCategory,
   code: z.string().nullable().optional(),
   context: z.record(z.any()).nullable().optional(),
   retryable: z.boolean().default(false),
   suggestedAction: z.string().nullable().optional()
 });
 
 // Define the expected payload schema
 const StatusUpdateSchema = z.object({
   jobId: z.string().uuid(),
-  status: z.enum(["completed", "failed"]),
+  status: z.enum(["completed", "failed"]),
   resultPayload: z.any().optional(),
   errorDetail: ErrorDetailSchema.nullable().optional(),
   errorMessage: z.string().nullable().optional(), // Kept for backward compatibility
 });
 
 export async function POST(request: Request) {
   try {
-    // Verify API Key
-    const apiKey = request.headers.get("x-internal-api-key");
-    if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
-      return NextResponse.json(
-        { error: "Unauthorized", errorCode: "INVALID_API_KEY" },
-        { status: 401 }
-      );
-    }
-
-    // Parse and validate payload
-    const payload = await request.json();
-    const validatedPayload = StatusUpdateSchema.parse(payload);
+    const raw = await request.text();
+    // Verify API Key
+    const apiKey = request.headers.get("x-internal-api-key");
+    if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
+      return NextResponse.json(
+        { error: "Unauthorized", errorCode: "INVALID_API_KEY" },
+        { status: 401 }
+      );
+    }
+
+    // Optional HMAC verification
+    const hmacSecret = process.env.INTERNAL_WEBHOOK_HMAC_SECRET;
+    if (hmacSecret) {
+      const ts = request.headers.get("x-webhook-timestamp");
+      const sig = request.headers.get("x-webhook-signature");
+      if (!ts || !sig) {
+        return NextResponse.json(
+          { error: "Missing signature headers", errorCode: "MISSING_SIGNATURE" },
+          { status: 401 }
+        );
+      }
+      const age = Math.abs(Date.now() - Number(ts));
+      if (!Number.isFinite(age) || age > 5 * 60 * 1000) {
+        return NextResponse.json(
+          { error: "Signature timestamp expired", errorCode: "TIMESTAMP_EXPIRED" },
+          { status: 401 }
+        );
+      }
+      const expected = "sha256=" + crypto.createHmac("sha256", hmacSecret).update(`${ts}.${raw}`).digest("hex");
+      const subtleEqual =
+        expected.length === sig.length &&
+        crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
+      if (!subtleEqual) {
+        return NextResponse.json(
+          { error: "Invalid signature", errorCode: "INVALID_SIGNATURE" },
+          { status: 401 }
+        );
+      }
+    }
+
+    // Parse and validate payload (after potential HMAC verification)
+    const validatedPayload = StatusUpdateSchema.parse(JSON.parse(raw));
 
-    // Update job record
-    const [updatedJob] = await db
-      .update(processingJobs)
-      .set({
-        status: validatedPayload.status,
-        resultPayload: validatedPayload.resultPayload,
-        // For backward compatibility, prioritize errorDetail but fall back to errorMessage
-        errorMessage: validatedPayload.errorDetail?.message || validatedPayload.errorMessage,
-        // Store the full error detail as a JSON object
-        errorDetail: validatedPayload.errorDetail ? JSON.stringify(validatedPayload.errorDetail) : null,
-        completedAt: new Date(),
-      })
-      .where(eq(processingJobs.id, validatedPayload.jobId))
-      .returning();
+    // Enforce state machine & idempotency
+    const result = await db.transaction(async (tx) => {
+      const job = await tx.query.processingJobs.findFirst({
+        where: eq(processingJobs.id, validatedPayload.jobId),
+        columns: { status: true, completedAt: true },
+      });
+      if (!job) {
+        return NextResponse.json(
+          { error: "Job not found", errorCode: "JOB_NOT_FOUND" },
+          { status: 404 }
+        );
+      }
+      if (isTerminal(job.status)) {
+        // Idempotent: already finalized
+        return NextResponse.json(
+          { message: "Already finalized", status: job.status },
+          { status: 200 }
+        );
+      }
+      // Accept direct finalize from pending or from processing
+      if (!isLegalTransition(job.status as any, validatedPayload.status)) {
+        return NextResponse.json(
+          { error: "Illegal transition", from: job.status, to: validatedPayload.status, errorCode: "ILLEGAL_TRANSITION" },
+          { status: 409 }
+        );
+      }
+
+      const [updated] = await tx
+        .update(processingJobs)
+        .set({
+          status: validatedPayload.status,
+          resultPayload: validatedPayload.resultPayload,
+          // Prioritize errorDetail but fall back to errorMessage
+          errorMessage: validatedPayload.errorDetail?.message || validatedPayload.errorMessage || null,
+          // Store JSON object directly in jsonb
+          errorDetail: validatedPayload.errorDetail ?? null,
+          updatedAt: new Date(),
+          completedAt: new Date(),
+        })
+        .where(eq(processingJobs.id, validatedPayload.jobId))
+        .returning({ id: processingJobs.id });
+
+      if (!updated) {
+        return NextResponse.json(
+          { error: "Failed to update job", errorCode: "UPDATE_FAILED" },
+          { status: 500 }
+        );
+      }
+      return NextResponse.json({ message: "Status updated successfully" }, { status: 200 });
+    });
 
-    if (!updatedJob) {
-      console.warn(`Job not found: ${validatedPayload.jobId}`);
-      return NextResponse.json(
-        { error: "Job not found", errorCode: "JOB_NOT_FOUND" },
-        { status: 404 }
-      );
-    }
-
-    return NextResponse.json(
-      { message: "Status updated successfully" },
-      { status: 200 }
-    );
+    return result;
   } catch (error) {
     console.error("Error processing AI service status update:", error);
 
     if (error instanceof z.ZodError) {
       return NextResponse.json(
         {
           error: "Invalid payload",
           errorCode: "INVALID_PAYLOAD",
           details: error.errors,
         },
         { status: 400 }
       );
     }
 
     return NextResponse.json(
       { error: "Internal server error", errorCode: "INTERNAL_ERROR" },
       { status: 500 }
     );
   }
 }
diff --git a/nextjs-app/lib/job-state.ts b/nextjs-app/lib/job-state.ts
new file mode 100644
index 0000000..8b2ec1f
--- /dev/null
+++ b/nextjs-app/lib/job-state.ts
@@ -0,0 +1,23 @@
+export type JobStatus = "pending" | "processing" | "completed" | "failed";
+
+export function isTerminal(s: JobStatus): boolean {
+  return s === "completed" || s === "failed";
+}
+
+export function isLegalTransition(prev: JobStatus, next: JobStatus): boolean {
+  const allowed: Record<JobStatus, JobStatus[]> = {
+    pending: ["processing", "completed", "failed"],
+    processing: ["completed", "failed"],
+    completed: [],
+    failed: [],
+  };
+  return allowed[prev]?.includes(next) ?? false;
+}
```

---

### 3) **Fix P1: Schema duplication – re-export canonical modules**

```diff
diff --git a/nextjs-app/app/db/schema/index.ts b/nextjs-app/app/db/schema/index.ts
index 8a31bf3..e7e71fa 100644
--- a/nextjs-app/app/db/schema/index.ts
+++ b/nextjs-app/app/db/schema/index.ts
@@ -1 +1,2 @@
-export * from "./users"; 
+// Re-export canonical schema to prevent drift
+export * from "../../../db/schema";
diff --git a/nextjs-app/app/db/schema/users.ts b/nextjs-app/app/db/schema/users.ts
deleted file mode 100644
index 1a2b3a3..0000000
--- a/nextjs-app/app/db/schema/users.ts
+++ /dev/null
@@ -1,11 +0,0 @@
-import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core';
-
-export const users = pgTable('users', {
-  id: text('id').primaryKey(), // Clerk user ID
-  email: text('email').notNull().unique(),
-  createdAt: timestamp('created_at').defaultNow().notNull(),
-  updatedAt: timestamp('updated_at').defaultNow().notNull(),
-  aiCreditsRemaining: integer('ai_credits_remaining').default(10).notNull(),
-  stripeCustomerId: text('stripe_customer_id'),
-  subscriptionStatus: text('subscription_status').default('free').notNull(),
-}); 
diff --git a/nextjs-app/app/db/index.ts b/nextjs-app/app/db/index.ts
index 4b0a1e1..fb86b3f 100644
--- a/nextjs-app/app/db/index.ts
+++ b/nextjs-app/app/db/index.ts
@@ -1,9 +1,4 @@
-import { drizzle } from 'drizzle-orm/postgres-js';
-import postgres from 'postgres';
-import * as schema from './schema';
-
-// Make sure to set DATABASE_URL in your .env.local file
-const databaseUrl = process.env.DATABASE_URL;
-
-if (!databaseUrl) {
-  throw new Error('DATABASE_URL environment variable is not set or not accessible');
-}
-
-// Disable prefetch as it is not supported for "Transaction" pool mode
-const client = postgres(databaseUrl, { prepare: false });
-export const db = drizzle(client, { schema }); 
+// Re-export canonical DB client to prevent duplicate connections/config
+export * from "../../db/index";
```

---

### 4) **Fix P1: Unify job lifecycle – do not set `processing` client-side**

```diff
diff --git a/nextjs-app/actions/ai/submit-text.ts b/nextjs-app/actions/ai/submit-text.ts
index 3169f2c..fb7a1d9 100644
--- a/nextjs-app/actions/ai/submit-text.ts
+++ b/nextjs-app/actions/ai/submit-text.ts
@@ -1,20 +1,10 @@
 /**
  * @file submit-text.ts
  * @description
  * This server action accepts form data (text, model, cardType, numCards),
  * creates a new processing job with status "pending," then calls the AI service.
  * It is an alternative or simpler version of job submission.
  * 
  * Key Responsibilities:
  * - Validate input from FormData
  * - Create a new job record in processingJobs
  * - Trigger the AI microservice asynchronously
  * - Return the jobId to the caller
  * 
  * @dependencies
  * - Clerk auth() to ensure user is logged in
  * - Drizzle (db, processingJobs, eq)
  * - zod for input validation
  * - triggerCardGeneration from "@/lib/ai-client"
  * 
  * @notes
  * - This file does not contain any leftover placeholder logic to remove.
  * - Everything here references real AI service calls via `triggerCardGeneration`.
  */
 
 "use server";
 
 import { auth } from "@clerk/nextjs";
 import { revalidatePath } from "next/cache";
 import { z } from "zod";
 import { db } from "@/db";
 import { processingJobs } from "@/db/schema";
 import { triggerCardGeneration, FormInputSchema } from "@/lib/ai-client";
-import { eq } from "drizzle-orm";
+import type { ActionState } from "@/types";
 
-// Define ActionState locally or import from '@/types' if defined there
-// Ensure its 'error' type is: error?: Record<string, string[]> | null;
-export type ActionState<TData = any> = {
-  isSuccess: boolean;
-  message?: string;
-  data?: TData;
-  error?: Record<string, string[]> | null; // Ensure this definition matches
-};
-
 export async function submitTextForCardsAction(
   formData: FormData
 ): Promise<ActionState<{ jobId: string }>> {
@@ -94,21 +84,12 @@ export async function submitTextForCardsAction(
       numCards: validatedData.data.numCards,
     });
 
-    // Mark job as "processing"
-    await db
-      .update(processingJobs)
-      .set({
-        status: "processing",
-        updatedAt: new Date(),
-      })
-      .where(eq(processingJobs.id, job.id));
-
     revalidatePath("/create");
     revalidatePath(`/create/${job.id}`);
 
     return {
       isSuccess: true,
       message: "Card generation started successfully",
       data: { jobId: job.id },
     };
```

---

### 5) **Fix P2: ESLint CJS + `import.meta.url`**

```diff
diff --git a/nextjs-app/eslint.config.js b/nextjs-app/eslint.config.js
index 6c1d77a..3b4aa8e 100644
--- a/nextjs-app/eslint.config.js
+++ b/nextjs-app/eslint.config.js
@@ -1,19 +1,14 @@
 // Use require for imports in CommonJS if needed, or keep dynamic import() if necessary
-// Adjusting imports might be needed depending on how FlatCompat works in CJS context.
-// Let's assume the original dynamic imports work or adjust if ESLint complains later.
-const { dirname } = require("path");
-const { fileURLToPath } = require("url");
+const path = require("path");
 const { FlatCompat } = require("@eslint/eslintrc");
 // Assuming nextPlugin might need require or different handling in CJS
 // If '@next/eslint-plugin-next' provides a CJS entry point:
 const nextPlugin = require("@next/eslint-plugin-next"); 
-// If not, you might need to investigate how to load ESM plugins in CJS eslint config
-
-const __filename = fileURLToPath(import.meta.url); // Note: import.meta.url might behave differently in CJS. Often __filename is available directly.
-const __dirname = dirname(__filename); // Often __dirname is available directly in CJS.
 
 const compat = new FlatCompat({
-  baseDirectory: __dirname,
+  // In CJS, __dirname is natively available
+  baseDirectory: __dirname || process.cwd(),
 });
 
 const eslintConfig = [
```

---

### 6) **Fix P2: Clerk webhook primary email selection**

```diff
diff --git a/nextjs-app/app/api/webhooks/clerk/route.ts b/nextjs-app/app/api/webhooks/clerk/route.ts
index 2a8fa0c..6f4bfd2 100644
--- a/nextjs-app/app/api/webhooks/clerk/route.ts
+++ b/nextjs-app/app/api/webhooks/clerk/route.ts
@@ -1,6 +1,6 @@
 import { Webhook } from "svix";
 import { WebhookEvent } from "@clerk/nextjs/server";
 import { headers } from "next/headers";
 import { NextResponse } from "next/server";
 import { syncUser } from "@/actions/db/users";
 
 export async function POST(req: Request) {
@@ -37,12 +37,17 @@ export async function POST(req: Request) {
   if (eventType === "user.created") {
-    const { id, email_addresses, created_at, updated_at } = evt.data;
-
-    // Get the primary email address
-    const primaryEmail = email_addresses.find(
-      (email) => email.id === email_addresses[0].id
-    )?.email_address;
+    const { id, email_addresses, created_at, updated_at } = evt.data;
+    // Prefer Clerk's primary_email_address_id if available
+    const primaryId =
+      (evt.data as any).primary_email_address_id ||
+      (Array.isArray(email_addresses) && email_addresses[0]?.id);
+    const primaryEmail = Array.isArray(email_addresses)
+      ? email_addresses.find((e: any) => e.id === primaryId)?.email_address ??
+        email_addresses[0]?.email_address
+      : undefined;
     if (!primaryEmail) {
       console.error("No primary email found for user:", id);
       return new NextResponse("No primary email found", { status: 400 });
     }
```

---

### 7) **Replace duplicate stats import on Progress page**

```diff
diff --git a/nextjs-app/app/(main)/progress/page.tsx b/nextjs-app/app/(main)/progress/page.tsx
index 66f1a2a..4f8d2d3 100644
--- a/nextjs-app/app/(main)/progress/page.tsx
+++ b/nextjs-app/app/(main)/progress/page.tsx
@@ -1,6 +1,6 @@
-import { getUserStatsAction } from "@/actions/tracking";
+import { getUserStatsAction } from "@/actions/db/users";
 import { StatsDisplay } from "@/components/features/tracking/stats-display";
 import { PageHeader } from "@/components/shared/page-header";
 
 export default async function ProgressPage() {
   const statsResult = await getUserStatsAction();
```

---

### 8) **Add tests + Vitest config**

```diff
diff --git a/nextjs-app/package.json b/nextjs-app/package.json
index 0c76e9a..6d6a3f2 100644
--- a/nextjs-app/package.json
+++ b/nextjs-app/package.json
@@ -7,6 +7,7 @@
   "scripts": {
     "dev": "next dev",
     "build": "next build",
     "start": "next start",
     "lint": "eslint .",
+    "test": "vitest run",
     "format": "prettier --write \"**/*.{ts,tsx,js,jsx,md,json}\"",
     "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,md,json}\"",
     "db:generate": "drizzle-kit generate --config=./drizzle.config.ts",
@@ -46,6 +47,10 @@
     "prettier-plugin-tailwindcss": "^0.6.11",
     "tailwindcss": "^4",
     "typescript": "^5"
+    ,
+    "vitest": "^1.6.0",
+    "vite": "^5.4.0",
+    "vite-tsconfig-paths": "^4.3.1"
   }
 }
diff --git a/nextjs-app/vitest.config.ts b/nextjs-app/vitest.config.ts
new file mode 100644
index 0000000..f4d02b5
--- /dev/null
+++ b/nextjs-app/vitest.config.ts
@@ -0,0 +1,16 @@
+import { defineConfig } from "vitest/config";
+import tsconfigPaths from "vite-tsconfig-paths";
+
+export default defineConfig({
+  plugins: [tsconfigPaths()],
+  test: {
+    environment: "node",
+    globals: true,
+    include: ["tests/**/*.test.ts"],
+    coverage: {
+      provider: "v8",
+      reporter: ["text", "html"],
+    },
+  },
+});
diff --git a/nextjs-app/tests/srs.test.ts b/nextjs-app/tests/srs.test.ts
new file mode 100644
index 0000000..1fd0d8a
--- /dev/null
+++ b/nextjs-app/tests/srs.test.ts
@@ -0,0 +1,98 @@
+import { describe, it, expect } from "vitest";
+import { calculateSrsData, type StudyRating } from "../lib/srs";
+
+// Minimal mock of flashcard row
+const makeCard = (overrides: Partial<{
+  srsInterval: number;
+  srsEaseFactor: number | string;
+}> = {}) => ({
+  id: "00000000-0000-0000-0000-000000000000",
+  deckId: "11111111-1111-1111-1111-111111111111",
+  userId: "user",
+  front: "Q",
+  back: "A",
+  cardType: "qa",
+  srsLevel: 0,
+  srsInterval: overrides.srsInterval ?? 0,
+  srsEaseFactor: overrides.srsEaseFactor ?? "2.50",
+  srsDueDate: new Date(),
+  createdAt: new Date(),
+  updatedAt: new Date(),
+});
+
+describe("SRS algorithm", () => {
+  it("learning phase intervals", () => {
+    const base = makeCard({ srsInterval: 0, srsEaseFactor: "2.50" });
+    const again = calculateSrsData(base, "Again");
+    const hard = calculateSrsData(base, "Hard");
+    const good = calculateSrsData(base, "Good");
+    const easy = calculateSrsData(base, "Easy");
+
+    expect(again.newInterval).toBe(0);
+    expect(hard.newInterval).toBe(1);
+    expect(good.newInterval).toBe(1);
+    expect(easy.newInterval).toBe(3);
+
+    // due dates must not be in past
+    const now = Date.now();
+    for (const d of [again, hard, good, easy]) {
+      expect(d.newDueDate.getTime()).toBeGreaterThanOrEqual(now - 1000);
+    }
+  });
+
+  it("monotonic intervals for matured card", () => {
+    const base = makeCard({ srsInterval: 10, srsEaseFactor: "2.50" });
+    const again = calculateSrsData(base, "Again");
+    const hard = calculateSrsData(base, "Hard");
+    const good = calculateSrsData(base, "Good");
+    const easy = calculateSrsData(base, "Easy");
+
+    expect(again.newInterval).toBe(0);
+    expect(hard.newInterval).toBeGreaterThanOrEqual(1);
+    expect(good.newInterval).toBeGreaterThanOrEqual(hard.newInterval);
+    expect(easy.newInterval).toBeGreaterThanOrEqual(good.newInterval);
+  });
+
+  it("ease factor clamps to [1.3, 2.5]", () => {
+    const base = makeCard({ srsInterval: 20, srsEaseFactor: "1.31" });
+    const again = calculateSrsData(base, "Again"); // decreases EF
+    expect(again.newEaseFactor).toBeGreaterThanOrEqual(1.3);
+
+    const high = makeCard({ srsInterval: 20, srsEaseFactor: "2.49" });
+    const easy = calculateSrsData(high, "Easy"); // increases EF
+    expect(easy.newEaseFactor).toBeLessThanOrEqual(2.5);
+  });
+});
diff --git a/nextjs-app/tests/job-state.test.ts b/nextjs-app/tests/job-state.test.ts
new file mode 100644
index 0000000..e24a2c9
--- /dev/null
+++ b/nextjs-app/tests/job-state.test.ts
@@ -0,0 +1,25 @@
+import { describe, it, expect } from "vitest";
+import { isLegalTransition, isTerminal, type JobStatus } from "../lib/job-state";
+
+describe("job state machine", () => {
+  const t = (from: JobStatus, to: JobStatus, ok: boolean) => {
+    expect(isLegalTransition(from, to)).toBe(ok);
+  };
+
+  it("transitions", () => {
+    t("pending", "processing", true);
+    t("pending", "completed", true);
+    t("pending", "failed", true);
+
+    t("processing", "completed", true);
+    t("processing", "failed", true);
+
+    t("completed", "failed", false);
+    t("failed", "completed", false);
+    t("completed", "processing", false);
+  });
+
+  it("terminal detection", () => {
+    expect(isTerminal("completed")).toBe(true);
+    expect(isTerminal("failed")).toBe(true);
+  });
+});
```

---

### 9) **.env & README hints for HMAC + rotation**

```diff
diff --git a/nextjs-app/.env.example b/nextjs-app/.env.example
index 7b2f6f3..e9caa8a 100644
--- a/nextjs-app/.env.example
+++ b/nextjs-app/.env.example
@@ -1,6 +1,9 @@
 #####################################
 # Example .env for Next.js Application
 # Copy to .env.local and fill in values
 #####################################
 
+# Base URL of this Next.js app (used by dev webhook simulator)
+NEXT_PUBLIC_APP_URL="http://localhost:3000"
+
 # -- CLERK AUTHENTICATION --
 # The publishable key is used client-side
 NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="Your Clerk Publishable Key"
@@ -21,6 +24,9 @@ AI_SERVICE_BASE_URL="http://localhost:8000"
 # Shared secret for verifying internal requests to/from the AI service
 INTERNAL_API_KEY="Your Internal API Key (must match ai-service/.env.local)"
 
+# Optional but recommended: HMAC signing for webhook requests
+INTERNAL_WEBHOOK_HMAC_SECRET="ChangeMeToARandomLongSecret"
+
 # -- DATABASE --
 # Main Postgres DB connection string used by Drizzle ORM
 DATABASE_URL="postgresql://postgres:password@127.0.0.1:5432/memoria_db"
diff --git a/nextjs-app/README.md b/nextjs-app/README.md
index 8bc2df2..b8f7300 100644
--- a/nextjs-app/README.md
+++ b/nextjs-app/README.md
@@ -56,6 +56,14 @@ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
```

+### Webhook Security (Recommended)
\+
+- Set `INTERNAL_WEBHOOK_HMAC_SECRET` in `.env.local` to enable HMAC verification on `/api/webhooks/ai-service-status`.
+- Rotate `INTERNAL_API_KEY` immediately if it was ever exposed (e.g., removed debug page sent a hardcoded key).
+- In development, you can use the **debug page** `/create/debug`, which now leverages a **server action** that reads secrets from the server environment—no secrets are exposed to the client.
\+
\+
\+

## Getting Started

First, run the development server:

````

---

## Additional Notes / Nice‑to‑Haves

- **AI Service**: Ensure it also signs outbound webhooks with the same HMAC pattern (`sha256` over `${timestamp}.${rawBody}`) and sends `x-webhook-timestamp`, `x-webhook-signature`. Tighten **CORS** to your Next.js origin(s) only.
- **Rate limits**: Add middleware or edge control to rate‑limit `/create` submissions and `/api/webhooks/*` calls.
- **Input caps**: Enforce server‑side limits for `text` length and `numCards` at API receivers (both Next and FastAPI).

---

## What I Verified

- **AuthZ**: All API routes handling user data check `auth()` and ownership (`userId`) where relevant (jobs, decks, cards).  
- **DB integrity**: FKs with `onDelete` set; `jsonb` used for payloads; status enums; **canonical schema used in Drizzle config**.  
- **SRS math**: Learning phase constants match your comments; EF clamp; intervals monotone; UTC date math.

---

## Done / Next Steps

1) Apply patches and **rotate** `INTERNAL_API_KEY`.  
2) Set `INTERNAL_WEBHOOK_HMAC_SECRET` in both apps and update AI service to sign requests.  
3) Run tests:

```bash
cd nextjs-app
npm i
npm run test
````

4. (Optional) Add CI to ban imports from `/app/db/*` and enforce canonical schema usage.

---

### Bonus — Visual Status Check (using web UI helpers)

To keep an eye on jobs end‑to‑end, consider adding a tiny **Job Monitor** widget that polls `/api/job-status/[jobId]` and renders:

* **Status badges** (🟡 pending / 🟠 processing / 🟢 completed / 🔴 failed)
* Last update time
* Result/errors (accordion)

This can live in the “Create” → job status page header for fast feedback.
