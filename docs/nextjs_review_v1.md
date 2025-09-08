<review>
<summary>
**Overall**: Solid foundation. You’re using Next.js App Router with server actions, Clerk auth, Drizzle ORM, and a clean SRS core. The AI webhook flow and job-state FSM are thoughtfully designed with HMAC support and idempotent updates. Shadcn/ui + Tailwind v4 keep the UI tidy.

**Main gaps**: (1) unnecessary client-side round trips (N+1 fetching on `/decks`), (2) duplicate/competing types & actions, (3) a broken “ensure-user” route that can write placeholder emails, (4) cache/revalidation strategy not wired to webhooks (users wait on polling), (5) in-memory rate limit & mixed DB clients, (6) middleware and ESLint config quirks, and (7) stats are placeholders despite schema support.

Below are prioritized improvements with step‑by‑step fixes and code you can drop in.

</summary>

<improvements>

<improvement>
<title>Eliminate N+1 requests on “Your Decks” and move data loading to a Server Component</title>
<description>
**Why**: The `/decks` page runs on the client, calls a server action to get decks, and then fires one API request per deck to get `cardCount`. This is slow, chatty, and makes SSR/streaming impossible there.

**What to do**:

1. Convert `/app/(main)/decks/page.tsx` to a **Server Component** and fetch decks + counts in one DB query.
2. If you still want a client experience, render the initial list from the server and hydrate later for interactions.
3. Tag the query so webhooks can revalidate it after new cards are saved.

**DB query patterns** (pick one):

* **Correlated subquery** per deck (simple, readable).
* **Left join + groupBy** (what you do in the API currently) but for *all* decks at once.

Add a revalidation tag (e.g., `decks:list:<userId>`). </description>
\<code\_example>
// app/(main)/decks/page.tsx (Server Component)
import { auth } from "@clerk/nextjs";
import { db } from "@/db";
import { decks, flashcards } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";

export const revalidate = 0; // or use tags instead of fully dynamic

export default async function DecksPage() {
const { userId } = auth();
if (!userId) return null;

// One round-trip: deck with count via correlated subquery
const rows = await db.select({
id: decks.id,
name: decks.name,
cardCount: sql<number>`(
      select count(*) from ${flashcards}
      where ${flashcards.deckId} = ${decks.id}
        and ${flashcards.userId} = ${userId}
    )`.as("card\_count")
})
.from(decks)
.where(eq(decks.userId, userId))
.orderBy(decks.createdAt);

return ( <div className="container mx-auto py-8"> <h1 className="mb-8 text-3xl font-bold">Your Decks</h1>
{rows.length === 0 ? ( <div className="text-muted-foreground">
You haven't created any decks yet. Create some flashcards first! </div>
) : ( <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
{rows.map((deck) => (
\<Link key={deck.id} href={`/study/${deck.id}`}> <Card className="hover:bg-accent/50 h-full transition-colors flex flex-col"> <CardHeader> <CardTitle>{deck.name}</CardTitle> </CardHeader> <CardContent className="flex-grow"> <div className="flex items-center text-muted-foreground mb-4"> <BookOpen className="h-4 w-4 mr-2" /> <span>{deck.cardCount} {deck.cardCount === 1 ? "card" : "cards"}</span> </div> </CardContent> <CardFooter> <Button variant="secondary" className="w-full">Study</Button> </CardFooter> </Card> </Link>
))} </div>
)} </div>
);
}
\</code\_example> </improvement>

<improvement>
<title>Fix the “ensure-user” endpoint (it currently writes placeholder emails)</title>
<description>
**Issue**: `/app/api/auth/ensure-user/route.ts` uses `const { userId, user: clerkUser } = auth();` — but `auth()` does **not** return a `user`. This leads to inserting a placeholder email into your `users` table.

**Fix**:

* Use `clerkClient.users.getUser(userId)` to read the primary email.
* Keep this route idempotent (ON CONFLICT DO NOTHING / UPDATE).
* Consider making it a POST and calling it in a deliberate place (e.g., after sign-in) rather than every layout.

**Bonus**: you already have a Clerk webhook that syncs users correctly. You can remove this route entirely if the webhook runs reliably. Otherwise, fix it as below. </description>
\<code\_example>
// app/api/auth/ensure-user/route.ts
import { auth, clerkClient } from "@clerk/nextjs";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
try {
const { userId } = auth();
if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

```
const user = await clerkClient.users.getUser(userId);
const primaryEmail = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress
  ?? user.emailAddresses[0]?.emailAddress;

if (!primaryEmail) {
  return NextResponse.json({ error: "No email" }, { status: 400 });
}

await db.insert(users)
  .values({ id: userId, email: primaryEmail })
  .onConflictDoUpdate({ target: users.id, set: { email: primaryEmail, updatedAt: new Date() } });

return NextResponse.json({ status: "ok" });
```

} catch (e) {
return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
}
\</code\_example> </improvement>

<improvement>
<title>Real-time job status via tags or SSE (stop polling every 3s)</title>
<description>
**Why**: `/create/[jobId]` polls `/api/job-status/:id` every 3 seconds. That’s wasteful and slow to feel responsive.

**Option A — Revalidation Tags (no infra)**

* Fetch job status in a Server Component with `{ next: { tags: [\`job:\${jobId}\`] } }\`.
* On webhook success, call `revalidateTag(\`job:\${jobId}\`)\`. The page re-renders instantly.

**Option B — SSE (still infra-free)**

* Add `/api/job-status/:id/stream` that uses `BroadcastChannel` to push events when webhooks arrive.
* The page listens with `EventSource` and updates immediately.

Below is **Option A** (simplest and robust on Vercel). </description>
\<code\_example>
// app/api/webhooks/ai-service-status/route.ts (after successful update)
import { revalidateTag } from "next/cache";
// ...
return NextResponse.json({ message: "Status updated successfully" }, { status: 200, headers: {} });
// after return inside the tx result, *outside* of tx block:
try {
revalidateTag(`job:${validatedPayload.jobId}`);
} catch {}

// app/(main)/create/\[jobId]/page.tsx (convert to Server Component for status header)
export const dynamic = "force-dynamic";

async function getJob(jobId: string) {
const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/job-status/${jobId}`, {
cache: "no-store",
next: { tags: \[`job:${jobId}`] },
});
return res.json();
}
\</code\_example> </improvement>

<improvement>
<title>Unify and harden your types: single ActionState + DB-inferred entity types</title>
<description>
**Issue**: `ActionState` is defined twice (`/types/index.ts` and `/app/types/index.ts`), and some actions import relatively using `../../types`. This invites drift.

**Fix**:

* Keep one canonical `ActionState` at `nextjs-app/types/index.ts`.
* Remove `/app/types/index.ts`.
* Use Drizzle-inferred types for entities:

  * `export type Deck = typeof decks.$inferSelect`
  * `export type Flashcard = typeof flashcards.$inferSelect`

**Benefit**: Fewer casting issues (e.g., numeric vs string for `srsEaseFactor`) and consistent action responses. </description>
\<code\_example>
// types/index.ts
export type ActionState\<TData = undefined> = {
isSuccess: boolean;
message?: string | null;
error?: Record\<string, string\[]> | null;
data?: TData;
};

// db/schema/exports...
export type Deck = typeof decks.\$inferSelect;
export type Flashcard = typeof flashcards.\$inferSelect;
\</code\_example> </improvement>

<improvement>
<title>Connect webhooks to cache invalidation for decks</title>
<description>
**Why**: After a successful generation/approval, the decks list/card counts should reflect new cards without a manual refresh.

**What**:

* When `reviewCardsAction` inserts cards, call `revalidateTag(\`decks\:list:\${userId}\`)\`.
* When you render the decks page, fetch with `{ next: { tags: [\`decks\:list:\${userId}\`] } }\`.

This pairs nicely with the “single query” Decks page refactor. </description>
\<code\_example>
// actions/db/decks.ts (at the end of reviewCardsAction success)
import { revalidateTag } from "next/cache";
// ...
revalidateTag(`decks:list:${userId}`);

// app/(main)/decks/page.tsx
const rows = await db.select(/\* ... \*/);
// when fetching via fetch wrapper: { next: { tags: \[`decks:list:${userId}`] } }
\</code\_example> </improvement>

<improvement>
<title>Update SRS writeback: maintain <code>srsLevel</code> and tighten streak math</title>
<description>
**Issue**:
- `recordStudyRatingAction` updates interval/ease/due date but never adjusts `srsLevel`. Many SRS flows track a stage/level for UX (e.g., count steps until graduation).
- Streak logic compares dayDiff with strict equality; floating deltas can appear (DST, etc.) even in UTC math.

**Fix**:

* Increment `srsLevel` when rating is Good/Easy; reset on Again.
* Use integer arithmetic for streak comparisons.

</description>
<code_example>
// actions/study.ts (inside transaction)
const nextLevel =
  rating === "Again" ? 0 :
  rating === "Hard" ? Math.max(0, (card.srsLevel ?? 0)) :
  (card.srsLevel ?? 0) + 1;

await tx.update(flashcards).set({
srsInterval: newInterval,
srsEaseFactor: newEaseFactor.toString(),
srsDueDate: newDueDate,
srsLevel: nextLevel,
updatedAt: now,
}).where(eq(flashcards.id, card.id));

// streak calc
const MS\_PER\_DAY = 86\_400\_000;
const dayDiff = lastStudiedDayUTC
? Math.floor((todayUTC.getTime() - lastStudiedDayUTC.getTime()) / MS\_PER\_DAY)
: Infinity;
if (dayDiff >= 1) {
newDailyCount = 0;
newStreak = (dayDiff === 1) ? (userRec.consecutiveStudyDays + 1) : 1;
}
\</code\_example> </improvement>

<improvement>
<title>Compute and show real progress stats</title>
<description>
**Why**: The stats endpoint returns zeros even though the `users` schema has `totalReviews`, `totalCorrectReviews`, and study counts.

**What**:

* Read those fields and compute `accuracy = totalCorrectReviews / totalReviews * 100`.
* Use `dailyStudyCount`, `weeklyStudyCount`, `consecutiveStudyDays`.

</description>
<code_example>
// actions/db/users.ts
export async function getUserStatsAction(): Promise<ActionState<{
  dailyCount: number;
  weeklyCount: number;
  accuracy: number;
  streak: number;
}>> {
  const { userId } = auth();
  if (!userId) return { isSuccess: false, message: "Unauthorized" };

const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
if (!user) return { isSuccess: false, message: "User not found" };

const total = user.totalReviews ?? 0;
const correct = user.totalCorrectReviews ?? 0;
const accuracy = total > 0 ? Math.round((correct / total) \* 1000) / 10 : 0;

return {
isSuccess: true,
data: {
dailyCount: user.dailyStudyCount ?? 0,
weeklyCount: user.weeklyStudyCount ?? 0,
accuracy,
streak: user.consecutiveStudyDays ?? 0,
}
};
}
\</code\_example> </improvement>

<improvement>
<title>Consolidate DB client and support dev HMR correctly</title>
<description>
**Issue**: Two DB entry points (`db/db.ts` and `db/index.ts`). HMR can spawn multiple Postgres connections.

**Fix**:

* Keep a single `db/index.ts`.
* Use a `globalThis` cache in dev to reuse the Postgres client across reloads.

</description>
<code_example>
// db/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { Sql } from "postgres";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE\_URL!;
declare global { // eslint-disable-next-line no-var
var **db**: { sql: Sql; db: ReturnType<typeof drizzle> } | undefined;
}

let sql: Sql;
let db: ReturnType<typeof drizzle>;

if (process.env.NODE\_ENV === "production") {
sql = postgres(databaseUrl, { prepare: false });
db = drizzle(sql, { schema });
} else {
if (!global.**db**) {
const \_sql = postgres(databaseUrl, { prepare: false });
global.**db** = { sql: \_sql, db: drizzle(\_sql, { schema }) };
}
({ sql, db } = global.**db**);
}

export { sql, db };
\</code\_example> </improvement>

<improvement>
<title>Make webhook and job-status routes explicitly dynamic & Node runtime</title>
<description>
**Why**: Prevent accidental caching and ensure Node crypto APIs are available.

**What**:

* Add `export const dynamic = "force-dynamic"` to `job-status` and webhook handlers.
* Add `export const runtime = "nodejs"` to webhook handler.
* Remove unsupported `runtime: 'nodejs'` from `middleware.ts` (middleware always runs on Edge).

</description>
<code_example>
// app/api/job-status/[jobId]/route.ts
export const dynamic = "force-dynamic";

// app/api/webhooks/ai-service-status/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// nextjs-app/middleware.ts — remove this:
// export const config = { ..., runtime: 'nodejs' }
\</code\_example> </improvement>

<improvement>
<title>Replace in-memory rate limiting with a durable limiter</title>
<description>
**Why**: The current in-memory bucket resets per function instance and doesn’t scale across regions.

**Fix**:

* Use Upstash Redis Rate Limit (or Vercel KV + sliding window).
* Namespace by user and action.

</description>
<code_example>
// lib/rate-limit.ts (Upstash example)
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const limiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m") });

export async function enforceRateLimit(userId: string, namespace: string) {
const key = `${namespace}:${userId}`;
const { success } = await limiter.limit(key);
if (!success) throw new Error("Rate limit exceeded. Please try again later.");
}
\</code\_example> </improvement>

<improvement>
<title>Connect webhook → deck/job cache via tags, not only page revalidation</title>
<description>
You’re already calling `revalidatePath` in some actions. Prefer **tags** for granular cache punching:
- On webhook complete: `revalidateTag(\`job:${id}\`)`.
- On `reviewCardsAction`: `revalidateTag(\`decks:list:${userId}\`)` and optionally `revalidateTag(\`deck:${deckId}:cards\`)`.

This gives instant updates without client polling. </description>
\<code\_example>
// examples shown in earlier improvements
\</code\_example> </improvement>

<improvement>
<title>Fix ESLint & middleware config; align Clerk versions in the monorepo</title>
<description>
**Issues**:
- ESLint config mixes FlatCompat and plugin in CJS. Use a native flat config for Next 14 to reduce brittleness.
- Root `package.json` depends on `@clerk/nextjs@^6.12.12` while the app uses `^4.29.9`. Hoisting can break runtime. Align to one version (prefer the latest and update your code accordingly).
- `middleware.ts` has an unsupported `runtime` key in `config`.

**Actions**:

1. Align Clerk to one major version (upgrade app to v6 if possible).
2. Replace `eslint.config.js` with a flat config that extends `next/core-web-vitals`.
3. Remove `runtime: 'nodejs'` from middleware config.

</description>
<code_example>
// eslint.config.js (flat config style)
const next = require("eslint-config-next");
module.exports = [
  { ignores: ["node_modules/**", ".next/**", "dist/**"] },
  ...next(),
  {
    rules: {
      // your custom rules
    }
  }
];
</code_example>
</improvement>

<improvement>
<title>Harden CI: fix the “forbidden import” script and add action tests</title>
<description>
**Issues**:
- `verify:no-app-db-imports` runs `rg ... nextjs-app` from inside `nextjs-app`, so it never matches.  
- No tests around server actions & routes.

**Fix**:

* Search current directory (`.`). Add Playwright for a minimal e2e and Vitest for action tests with a temp DB.

</description>
<code_example>
// package.json (scripts)
"verify:no-app-db-imports": "node -e \"const {spawnSync}=require('node:child_process'); const r=spawnSync('rg',['-n','@/app/db','.' ],{stdio:'inherit'}); process.exit(r.status===0?1:0);\"",

// test example (vitest)
import { describe, it, expect } from "vitest";
import { isLegalTransition } from "@/lib/job-state";
describe("job-state", () => {
it("pending -> processing", () => expect(isLegalTransition("pending","processing")).toBe(true));
});
\</code\_example> </improvement>

<improvement>
<title>Make job-status route explicitly “no-store” and simplify its shape</title>
<description>
**Why**: Avoid any intermediary caching, return exactly what the client needs, and keep types consistent.

**How**:

* Add `export const dynamic = "force-dynamic"`.
* Return a minimal DTO (id, status, payload/error) — you already do most of this.

  </description>

\<code\_example>
// app/api/job-status/\[jobId]/route.ts
export const dynamic = "force-dynamic";
\</code\_example> </improvement>

<improvement>
<title>Security headers & CSP via middleware</title>
<description>
**Why**: Strengthen protection against XSS and clickjacking, especially with `react-markdown`.

**How**:

* Add basic CSP, frame-ancestors, and referrer-policy via a lightweight middleware.
* Loosen CSP as needed for Clerk/Svix endpoints.

</description>
<code_example>
// middleware.ts (append after authMiddleware export)
import { NextResponse } from "next/server";
export function middleware(req: Request) {
  const res = NextResponse.next();
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Content-Type-Options", "nosniff");
  // Minimal CSP; adjust for Clerk/Svix if needed
  res.headers.set("Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none';");
  return res;
}
</code_example>
</improvement>

<improvement>
<title>Improve Study UX: keyboard shortcuts & accessible controls</title>
<description>
**Why**: Faster reviews and better accessibility.

**What**:

* Space toggles “Show Answer”.
* 1/2/3/4 map to Again/Hard/Good/Easy.
* Add `aria-live="polite"` for status text.

</description>
<code_example>
// app/(main)/study/[deckId]/page.tsx (client)
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (!isShowingAnswer && e.code === "Space") { e.preventDefault(); setIsShowingAnswer(true); }
    if (isShowingAnswer) {
      if (e.key === "1") handleRating("again");
      if (e.key === "2") handleRating("hard");
      if (e.key === "3") handleRating("good");
      if (e.key === "4") handleRating("easy");
    }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [isShowingAnswer, currentCardIndex]);
</code_example>
</improvement>

<improvement>
<title>Migrations: generate a follow-up migration for new enums/columns</title>
<description>
**Issue**: Schema comments reference added enum values (`generate-cards`) and `error_detail` but only a single initial migration exists. You risk runtime errors when deploying fresh.

**Fix**:

1. `npm run db:generate` to emit a migration that:

   * Ensures `job_type` enum includes `generate-cards`.
   * Adds `error_detail jsonb null`.
2. `npm run db:migrate` and commit the SQL.

**Tip**: Add a quick SQL assertion script in CI to validate enums/columns exist. </description>
\<code\_example>
// Example SQL (Postgres)
ALTER TYPE job\_type ADD VALUE IF NOT EXISTS 'generate-cards';
ALTER TABLE processing\_jobs ADD COLUMN IF NOT EXISTS error\_detail jsonb;
\</code\_example> </improvement>

<improvement>
<title>Set explicit runtime per route and clean Clerk middleware config</title>
<description>
**Why**: Keep routes on the proper runtime and avoid middleware surprises.

**What**:

* For webhook route: `export const runtime = 'nodejs'`.
* For public pages, Edge is fine.
* Update Clerk `authMiddleware` `ignoredRoutes` to a simpler, known-good pattern.

</description>
<code_example>
// middleware.ts (simplified)
export default authMiddleware({
  publicRoutes: [
    "/",
    "/landing",
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/articles(.*)",
    "/api/webhooks/clerk",
    "/api/webhooks/ai-service-status",
    "/api/auth/ensure-user"
  ],
  ignoredRoutes: ["/_next(.*)", "/favicon.ico", "/assets(.*)"],
});
export const config = { matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"] };
</code_example>
</improvement>

<improvement>
<title>Small cleanup: dedupe utils and remove unused imports</title>
<description>
- Remove `/app/landing/page.tsx` (it duplicates `/app/page.tsx`) or redirect `/landing` → `/`.
- Remove dead imports (`count` in `/api/decks/[deckId]/cards/route.ts`).
- Co-locate UI-only components under `components/shared`, server-only logic under `actions` or `app/api/*`.
- Keep all imports of types from `@/types` (no relative `../../types`).
</description>
<code_example>
// app/landing/page.tsx → delete
// next.config.js → (optional) add redirects
async redirects() {
  return [{ source: "/landing", destination: "/", permanent: true }];
}
</code_example>
</improvement>

</improvements>

<conclusion>
If you apply the top 5 changes — **Server-rendered Decks**, **fixed ensure-user**, **tag-based revalidation (or SSE)**, **type consolidation**, and **durable rate-limiting** — you’ll get immediate gains in speed, correctness, and scalability. The rest (runtime flags, ESLint/Clerk alignment, SRS level updates, real stats, migration hygiene, security headers, and UX shortcuts) tighten the system for production-grade reliability and a more delightful study experience.
</conclusion>
</review>
