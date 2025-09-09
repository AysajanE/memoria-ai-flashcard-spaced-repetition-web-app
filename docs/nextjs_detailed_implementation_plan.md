# Memoria Next.js Detailed Implementation Plan

> **Generated from**: Expert review (`nextjs_review_v1.md`) and action plan (`nextjs_action_plan_v1.md`)
> **Purpose**: Step-by-step implementation guide for systematic execution of all improvements
> **Target**: Transform high-level tasks into granular, actionable todos

---

## Phase 0 — Project Prep & Baselines

### Task 0.1: Create Tracking Artifacts

**Implementation Steps:**
1. Create epic in project tracking system titled "Next.js Performance & Security Improvements"
2. Create sub-tasks for each phase (0-10) with acceptance criteria
3. Assign owners per the PR breakdown in action plan

**Files to Create/Modify:**
- Update project management tool (GitHub Issues, Jira, etc.)

**Validation:**
- [ ] All 11 phases have corresponding tickets
- [ ] Each ticket has clear acceptance criteria and assignee

**Dependencies:** None

**Rollback:** Delete created tickets if project is cancelled

---

### Task 0.2: Align Clerk Versions Across Monorepo

**Implementation Steps:**

1. **Check current versions:**
   ```bash
   cd /Users/aeziz-local/Side Projects/memoria-ai-flashcard-spaced-repetition-web-app
   npm ls @clerk/nextjs
   ```

2. **Update root package.json:**
   ```bash
   # Open package.json in root
   # Change @clerk/nextjs version to match nextjs-app version (^4.29.9)
   ```

3. **Update nextjs-app package.json if needed:**
   ```bash
   cd nextjs-app
   # Check if upgrade to v6 is compatible with Next.js 14
   # If compatible, upgrade: npm install @clerk/nextjs@^6.12.12
   # If not compatible, keep current version and align root
   ```

4. **Clean and reinstall:**
   ```bash
   cd /Users/aeziz-local/Side Projects/memoria-ai-flashcard-spaced-repetition-web-app
   rm -rf node_modules package-lock.json
   rm -rf nextjs-app/node_modules nextjs-app/package-lock.json
   npm install
   ```

**Files to Modify:**
- `package.json` (root)
- `nextjs-app/package.json` (if upgrading Clerk)

**Validation:**
- [ ] `npm ls @clerk/nextjs` shows same version across workspace
- [ ] `npm run dev:next` starts without Clerk-related errors
- [ ] Authentication still works in development

**Dependencies:** None

**Rollback:** Restore previous package.json versions and reinstall

---

### Task 0.3: Replace ESLint Config with Flat Config

**Implementation Steps:**

1. **Backup current config:**
   ```bash
   cd nextjs-app
   cp eslint.config.js eslint.config.js.backup
   ```

2. **Replace with flat config:**
   ```javascript
   // nextjs-app/eslint.config.js
   const next = require("eslint-config-next");
   
   module.exports = [
     { ignores: ["node_modules/**", ".next/**", "dist/**", "drizzle/**"] },
     ...next(),
     {
       rules: {
         // Custom rules if needed
         "@typescript-eslint/no-unused-vars": "warn",
         "@next/next/no-img-element": "off"
       }
     }
   ];
   ```

3. **Test the config:**
   ```bash
   cd nextjs-app
   npm run lint
   ```

4. **Fix any new lint errors that appear**

**Files to Modify:**
- `nextjs-app/eslint.config.js`

**Validation:**
- [ ] `npm run lint` runs without plugin loader errors
- [ ] No regression in existing lint rule coverage
- [ ] Config follows Next.js 14 flat config standards

**Dependencies:** Task 0.2 (Clerk version alignment)

**Rollback:** `cp eslint.config.js.backup eslint.config.js`

---

### Task 0.4: Consolidate DB Entry Points

**Implementation Steps:**

1. **Examine current DB files:**
   ```bash
   cd nextjs-app
   ls -la db/
   # Check if both db.ts and index.ts exist
   ```

2. **Compare file contents:**
   ```bash
   cat db/db.ts
   cat db/index.ts
   # Identify which has more complete implementation
   ```

3. **Consolidate to single entry point:**
   ```typescript
   // nextjs-app/db/index.ts (keep this file, remove db.ts)
   import { drizzle } from "drizzle-orm/postgres-js";
   import postgres, { Sql } from "postgres";
   import * as schema from "./schema";

   const databaseUrl = process.env.DATABASE_URL!;

   declare global {
     // eslint-disable-next-line no-var
     var __db__: { sql: Sql; db: ReturnType<typeof drizzle> } | undefined;
   }

   let sql: Sql;
   let db: ReturnType<typeof drizzle>;

   if (process.env.NODE_ENV === "production") {
     sql = postgres(databaseUrl, { prepare: false });
     db = drizzle(sql, { schema });
   } else {
     if (!global.__db__) {
       const _sql = postgres(databaseUrl, { prepare: false });
       global.__db__ = { sql: _sql, db: drizzle(_sql, { schema }) };
     }
     ({ sql, db } = global.__db__);
   }

   export { sql, db };
   ```

4. **Remove duplicate file:**
   ```bash
   rm db/db.ts  # if it exists
   ```

5. **Update all imports:**
   ```bash
   # Search for imports of the removed file
   rg "from [\"']@/db/db[\"']" --type ts
   rg "import.*db.*from [\"']@/db/db[\"']" --type ts
   # Update all found imports to use @/db instead
   ```

**Files to Modify:**
- `nextjs-app/db/index.ts`
- Remove `nextjs-app/db/db.ts` (if exists)
- All files importing from `@/db/db`

**Validation:**
- [ ] Only one DB entry point exists (`db/index.ts`)
- [ ] `npm run build` succeeds
- [ ] Development server starts without DB connection errors
- [ ] No duplicate connection warnings in dev mode

**Dependencies:** None

**Rollback:** Restore both files and revert import changes

---

### Task 0.5: Add Runtime and Caching Directives to Routes

**Implementation Steps:**

1. **Update webhook route:**
   ```typescript
   // nextjs-app/app/api/webhooks/ai-service-status/route.ts
   // Add at the top after imports:
   export const runtime = "nodejs";
   export const dynamic = "force-dynamic";
   ```

2. **Update job-status route:**
   ```typescript
   // nextjs-app/app/api/job-status/[jobId]/route.ts  
   // Add at the top after imports:
   export const dynamic = "force-dynamic";
   ```

3. **Clean middleware config:**
   ```typescript
   // nextjs-app/middleware.ts
   // Remove any lines containing: runtime: 'nodejs'
   // Keep only the matcher config:
   export const config = { 
     matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"] 
   };
   ```

**Files to Modify:**
- `nextjs-app/app/api/webhooks/ai-service-status/route.ts`
- `nextjs-app/app/api/job-status/[jobId]/route.ts`
- `nextjs-app/middleware.ts`

**Validation:**
- [ ] Routes deploy without runtime errors
- [ ] Webhook route has access to Node.js crypto APIs
- [ ] No middleware deployment warnings
- [ ] Routes remain dynamic (no unexpected caching)

**Dependencies:** Task 0.4 (DB consolidation)

**Rollback:** Remove added export statements and restore middleware config

---

## Phase 1 — Data Correctness & Type Unification

### Task 1.1: Consolidate ActionState and Entity Types

**Implementation Steps:**

1. **Examine existing ActionState definitions:**
   ```bash
   cd nextjs-app
   rg "ActionState" --type ts -A 5 -B 5
   # Look for multiple definitions
   ```

2. **Keep canonical ActionState in types/index.ts:**
   ```typescript
   // nextjs-app/types/index.ts
   export type ActionState<TData = undefined> = {
     isSuccess: boolean;
     message?: string | null;
     error?: Record<string, string[]> | null;
     data?: TData;
   };
   ```

3. **Remove duplicate definitions:**
   ```bash
   # If app/types/index.ts exists:
   rm -rf app/types/
   ```

4. **Add inferred types from schema:**
   ```typescript
   // nextjs-app/types/index.ts (add to existing file)
   import { decks, flashcards, users } from "@/db/schema";

   // Database entity types
   export type Deck = typeof decks.$inferSelect;
   export type DeckInsert = typeof decks.$inferInsert;
   export type Flashcard = typeof flashcards.$inferSelect;
   export type FlashcardInsert = typeof flashcards.$inferInsert;
   export type User = typeof users.$inferSelect;
   export type UserInsert = typeof users.$inferInsert;
   ```

5. **Update all imports to use canonical types:**
   ```bash
   # Find all relative imports to types
   rg "from [\"']\.\./.*types[\"']" --type ts
   rg "from [\"']\.\.\/.*types[\"']" --type ts
   # Replace with @/types imports
   ```

**Files to Modify:**
- `nextjs-app/types/index.ts`
- Remove `nextjs-app/app/types/` directory
- All files with relative imports to types

**Validation:**
- [ ] Only one ActionState definition exists
- [ ] All server actions use same ActionState type
- [ ] `npm run build` compiles without type errors
- [ ] Database operations use inferred types consistently

**Dependencies:** Task 0.4 (DB consolidation)

**Rollback:** Restore app/types directory and revert import changes

---

### Task 1.2: Fix Ensure-User Route

**Implementation Steps:**

1. **Examine current implementation:**
   ```bash
   cd nextjs-app
   cat app/api/auth/ensure-user/route.ts
   ```

2. **Replace with corrected implementation:**
   ```typescript
   // nextjs-app/app/api/auth/ensure-user/route.ts
   import { auth, clerkClient } from "@clerk/nextjs";
   import { NextResponse } from "next/server";
   import { db } from "@/db";
   import { users } from "@/db/schema";

   export const runtime = "nodejs";
   export const dynamic = "force-dynamic";

   export async function POST() {
     try {
       const { userId } = auth();
       if (!userId) {
         return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
       }

       const user = await clerkClient.users.getUser(userId);
       const primaryEmail = user.emailAddresses.find(
         e => e.id === user.primaryEmailAddressId
       )?.emailAddress ?? user.emailAddresses[0]?.emailAddress;

       if (!primaryEmail) {
         return NextResponse.json({ error: "No email found" }, { status: 400 });
       }

       await db.insert(users)
         .values({ 
           id: userId, 
           email: primaryEmail,
           createdAt: new Date(),
           updatedAt: new Date()
         })
         .onConflictDoUpdate({ 
           target: users.id, 
           set: { 
             email: primaryEmail, 
             updatedAt: new Date() 
           } 
         });

       return NextResponse.json({ status: "ok" });
     } catch (error) {
       console.error("Ensure user error:", error);
       return NextResponse.json({ error: "Internal error" }, { status: 500 });
     }
   }
   ```

3. **Update any callers to use POST method:**
   ```bash
   # Find calls to this endpoint
   rg "ensure-user" --type ts --type tsx
   # Update any fetch calls to use method: "POST"
   ```

**Files to Modify:**
- `nextjs-app/app/api/auth/ensure-user/route.ts`
- Any components calling this endpoint

**Validation:**
- [ ] Route creates users with real email addresses
- [ ] No more "user-placeholder" emails in database
- [ ] Route is idempotent (can be called multiple times safely)
- [ ] POST method works from client calls

**Dependencies:** Task 1.1 (Type unification)

**Rollback:** Restore original route implementation

---

### Task 1.3: Generate Required Database Migrations

**Implementation Steps:**

1. **Check current schema for missing elements:**
   ```bash
   cd nextjs-app
   cat db/schema/jobs.ts
   # Look for job_type enum and error_detail column
   ```

2. **Add missing schema elements:**
   ```typescript
   // In nextjs-app/db/schema/jobs.ts (or relevant schema file)
   // Ensure job_type enum includes 'generate-cards'
   export const jobTypeEnum = pgEnum('job_type', [
     'generate-cards',  // Add this if missing
     // ... other existing values
   ]);

   // Ensure processing_jobs table has error_detail column
   export const processingJobs = pgTable('processing_jobs', {
     // ... existing columns
     errorDetail: jsonb('error_detail'),  // Add this if missing
   });
   ```

3. **Generate migration:**
   ```bash
   cd nextjs-app
   npm run db:generate
   ```

4. **Review generated migration:**
   ```bash
   # Check the new migration file in drizzle/ directory
   ls -la drizzle/
   cat drizzle/[newest-migration-file].sql
   # Verify it contains ALTER TYPE and ALTER TABLE statements
   ```

5. **Apply migration:**
   ```bash
   npm run db:migrate
   ```

6. **Verify changes:**
   ```bash
   npm run db:studio
   # Check that enum values and columns exist
   ```

**Files to Modify:**
- `nextjs-app/db/schema/jobs.ts` (or relevant schema file)
- New migration file in `nextjs-app/drizzle/`

**Validation:**
- [ ] `job_type` enum includes 'generate-cards' value
- [ ] `processing_jobs` table has `error_detail` jsonb column
- [ ] Migration applies without errors
- [ ] Existing data is preserved

**Dependencies:** Task 1.1 (Type unification)

**Rollback:** Revert schema changes and run rollback migration if needed

---

## Phase 2 — Performance: Server-Render Decks & Remove N+1

### Task 2.1: Convert Decks Page to Server Component

**Implementation Steps:**

1. **Backup current implementation:**
   ```bash
   cd nextjs-app
   cp app/\(main\)/decks/page.tsx app/\(main\)/decks/page.tsx.backup
   ```

2. **Replace with Server Component implementation:**
   ```tsx
   // nextjs-app/app/(main)/decks/page.tsx
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

     // Single query: deck with count via correlated subquery
     const rows = await db.select({
       id: decks.id,
       name: decks.name,
       cardCount: sql<number>`(
         select count(*) from ${flashcards}
         where ${flashcards.deckId} = ${decks.id}
           and ${flashcards.userId} = ${userId}
       )`.as("card_count")
     })
     .from(decks)
     .where(eq(decks.userId, userId))
     .orderBy(decks.createdAt);

     return (
       <div className="container mx-auto py-8">
         <h1 className="mb-8 text-3xl font-bold">Your Decks</h1>
         {rows.length === 0 ? (
           <div className="text-muted-foreground">
             You haven't created any decks yet. Create some flashcards first!
           </div>
         ) : (
           <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
             {rows.map((deck) => (
               <Link key={deck.id} href={`/study/${deck.id}`}>
                 <Card className="hover:bg-accent/50 h-full transition-colors flex flex-col">
                   <CardHeader>
                     <CardTitle>{deck.name}</CardTitle>
                   </CardHeader>
                   <CardContent className="flex-grow">
                     <div className="flex items-center text-muted-foreground mb-4">
                       <BookOpen className="h-4 w-4 mr-2" />
                       <span>
                         {deck.cardCount} {deck.cardCount === 1 ? "card" : "cards"}
                       </span>
                     </div>
                   </CardContent>
                   <CardFooter>
                     <Button variant="secondary" className="w-full">
                       Study
                     </Button>
                   </CardFooter>
                 </Card>
               </Link>
             ))}
           </div>
         )}
       </div>
     );
   }
   ```

3. **Remove client-side dependencies:**
   - Remove any `useState`, `useEffect` hooks
   - Remove toast notifications (replace with server-side handling if needed)
   - Remove any client-side data fetching

4. **Test the new implementation:**
   ```bash
   cd nextjs-app
   npm run dev
   # Navigate to /decks and verify single DB query
   ```

**Files to Modify:**
- `nextjs-app/app/(main)/decks/page.tsx`

**Validation:**
- [ ] Page renders with single database query
- [ ] No client-side API calls to get card counts
- [ ] Page loads faster than before
- [ ] All existing functionality preserved

**Dependencies:** Task 1.3 (DB migrations complete)

**Rollback:** `cp app/\(main\)/decks/page.tsx.backup app/\(main\)/decks/page.tsx`

---

### Task 2.2: Add Cache Tags for Decks List

**Implementation Steps:**

1. **Add tags to decks query:**
   ```tsx
   // In nextjs-app/app/(main)/decks/page.tsx
   // If using a fetch wrapper, add tags
   // If using direct DB query, prepare for revalidation in actions
   
   // For direct revalidation in actions (simpler approach):
   export const revalidate = 0; // Keep dynamic for now
   ```

2. **Prepare for revalidation (no changes needed yet):**
   - Note: Revalidation will be added in Task 2.3
   - Keep page dynamic for now to ensure fresh data

**Files to Modify:**
- `nextjs-app/app/(main)/decks/page.tsx` (minor adjustment)

**Validation:**
- [ ] Page remains dynamic and shows fresh data
- [ ] Ready for tag-based revalidation in next task

**Dependencies:** Task 2.1 (Server component conversion)

**Rollback:** No changes needed to rollback

---

### Task 2.3: Add Revalidation to Card Review Actions

**Implementation Steps:**

1. **Find the reviewCardsAction:**
   ```bash
   cd nextjs-app
   rg "reviewCardsAction" --type ts -A 10 -B 5
   ```

2. **Add revalidation to successful card insertions:**
   ```typescript
   // In the file containing reviewCardsAction
   import { revalidateTag } from "next/cache";

   // At the end of successful card insertion:
   export async function reviewCardsAction(/* params */) {
     // ... existing logic ...
     
     try {
       // ... card insertion logic ...
       
       // After successful insertion:
       const { userId } = auth();
       if (userId) {
         revalidateTag(`decks:list:${userId}`);
       }
       
       return { isSuccess: true, message: "Cards saved successfully" };
     } catch (error) {
       // ... error handling ...
     }
   }
   ```

3. **Update decks page to use tags:**
   ```tsx
   // nextjs-app/app/(main)/decks/page.tsx
   // If using fetch for DB queries, add tags:
   // { next: { tags: [`decks:list:${userId}`] } }
   
   // For direct DB queries, tags are applied via revalidateTag calls
   // No changes needed to the page itself
   ```

**Files to Modify:**
- File containing `reviewCardsAction` (likely in `actions/` directory)
- `nextjs-app/app/(main)/decks/page.tsx` (if using fetch)

**Validation:**
- [ ] After approving cards, /decks page updates without manual refresh
- [ ] Revalidation only affects the specific user's deck list
- [ ] No errors in server logs during revalidation

**Dependencies:** Task 2.2 (Cache tags preparation)

**Rollback:** Remove revalidateTag calls from actions

---

## Phase 3 — Real-Time Job Updates (Replace Polling)

### Task 3.1: Add Tag Revalidation to Webhook

**Implementation Steps:**

1. **Locate webhook handler:**
   ```bash
   cd nextjs-app
   find . -name "*webhook*" -name "*.ts" | grep -i status
   cat app/api/webhooks/ai-service-status/route.ts
   ```

2. **Add revalidation after successful update:**
   ```typescript
   // nextjs-app/app/api/webhooks/ai-service-status/route.ts
   import { revalidateTag } from "next/cache";
   
   // In the POST handler, after successful DB update:
   export async function POST(request: Request) {
     try {
       // ... existing webhook logic ...
       // ... HMAC validation ...
       // ... DB update transaction ...
       
       // After successful DB update:
       const jobId = validatedPayload.jobId; // Get from validated payload
       
       // Revalidate job-specific cache
       try {
         revalidateTag(`job:${jobId}`);
       } catch (revalidationError) {
         // Log but don't fail the webhook
         console.error("Revalidation error:", revalidationError);
       }
       
       return NextResponse.json(
         { message: "Status updated successfully" }, 
         { status: 200 }
       );
     } catch (error) {
       // ... error handling ...
     }
   }
   ```

**Files to Modify:**
- `nextjs-app/app/api/webhooks/ai-service-status/route.ts`

**Validation:**
- [ ] Webhook still processes successfully
- [ ] No errors in webhook logs
- [ ] Revalidation call doesn't break webhook response

**Dependencies:** Phase 2 completion

**Rollback:** Remove revalidateTag call from webhook

---

### Task 3.2: Convert Job Status to Server Component

**Implementation Steps:**

1. **Locate current job status page:**
   ```bash
   cd nextjs-app
   find . -name "*jobId*" -type d
   cat app/\(main\)/create/\[jobId\]/page.tsx
   ```

2. **Create job status fetching function:**
   ```typescript
   // nextjs-app/app/(main)/create/[jobId]/page.tsx
   
   async function getJobStatus(jobId: string) {
     const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
     
     try {
       const res = await fetch(`${baseUrl}/api/job-status/${jobId}`, {
         cache: "no-store",
         next: { tags: [`job:${jobId}`] },
       });
       
       if (!res.ok) {
         throw new Error(`HTTP ${res.status}`);
       }
       
       return res.json();
     } catch (error) {
       console.error("Failed to fetch job status:", error);
       return { status: "error", error: "Failed to load job status" };
     }
   }
   ```

3. **Convert page to hybrid Server/Client Component:**
   ```tsx
   // nextjs-app/app/(main)/create/[jobId]/page.tsx
   import { Suspense } from "react";
   
   // Server Component for initial data
   async function JobStatusServer({ jobId }: { jobId: string }) {
     const jobData = await getJobStatus(jobId);
     
     return (
       <JobStatusClient initialData={jobData} jobId={jobId} />
     );
   }
   
   export default function JobPage({ params }: { params: { jobId: string } }) {
     return (
       <div className="container mx-auto py-8">
         <Suspense fallback={<div>Loading job status...</div>}>
           <JobStatusServer jobId={params.jobId} />
         </Suspense>
       </div>
     );
   }
   ```

4. **Create client component for interactions:**
   ```tsx
   // nextjs-app/app/(main)/create/[jobId]/job-status-client.tsx
   "use client";
   
   import { useState, useEffect } from "react";
   
   interface JobStatusClientProps {
     initialData: any;
     jobId: string;
   }
   
   export default function JobStatusClient({ initialData, jobId }: JobStatusClientProps) {
     const [jobData, setJobData] = useState(initialData);
     const [lastPoll, setLastPoll] = useState(Date.now());
     
     // Keep minimal fallback polling (30s) in case revalidation fails
     useEffect(() => {
       if (jobData.status === "completed" || jobData.status === "failed") {
         return; // No polling needed for final states
       }
       
       const pollInterval = setInterval(() => {
         // Only poll if no update in last 30 seconds
         if (Date.now() - lastPoll > 30000) {
           fetch(`/api/job-status/${jobId}`)
             .then(res => res.json())
             .then(data => {
               setJobData(data);
               setLastPoll(Date.now());
             })
             .catch(console.error);
         }
       }, 30000);
       
       return () => clearInterval(pollInterval);
     }, [jobId, jobData.status, lastPoll]);
     
     // ... rest of component logic for UI interactions
     return (
       <div>
         {/* Job status UI */}
         <pre>{JSON.stringify(jobData, null, 2)}</pre>
       </div>
     );
   }
   ```

**Files to Modify:**
- `nextjs-app/app/(main)/create/[jobId]/page.tsx`
- `nextjs-app/app/(main)/create/[jobId]/job-status-client.tsx` (new file)

**Validation:**
- [ ] Page loads with server-rendered initial status
- [ ] Updates appear within 1-2 seconds after webhook
- [ ] Fallback polling works if revalidation fails
- [ ] No more 3-second polling

**Dependencies:** Task 3.1 (Webhook revalidation)

**Rollback:** Restore original client-only page with 3s polling

---

## Phase 4 — Study UX + SRS Level & Streak Robustness

### Task 4.1: Update SRS Writeback Logic

**Implementation Steps:**

1. **Locate study rating action:**
   ```bash
   cd nextjs-app
   rg "recordStudyRatingAction" --type ts -A 20 -B 5
   ```

2. **Add srsLevel updates:**
   ```typescript
   // In the file containing recordStudyRatingAction
   
   export async function recordStudyRatingAction(cardId: string, rating: string) {
     // ... existing logic ...
     
     await db.transaction(async (tx) => {
       // ... existing ease factor and interval calculations ...
       
       // Add srsLevel calculation
       const nextLevel = 
         rating === "Again" ? 0 :
         rating === "Hard" ? Math.max(0, (card.srsLevel ?? 0)) :
         (card.srsLevel ?? 0) + 1;
       
       // Update flashcard with srsLevel
       await tx.update(flashcards).set({
         srsInterval: newInterval,
         srsEaseFactor: newEaseFactor.toString(),
         srsDueDate: newDueDate,
         srsLevel: nextLevel, // Add this line
         updatedAt: now,
       }).where(eq(flashcards.id, card.id));
       
       // ... rest of transaction ...
     });
   }
   ```

3. **Fix streak calculation with integer math:**
   ```typescript
   // In the same file, update streak logic:
   
   const MS_PER_DAY = 86_400_000;
   const dayDiff = lastStudiedDayUTC
     ? Math.floor((todayUTC.getTime() - lastStudiedDayUTC.getTime()) / MS_PER_DAY)
     : Infinity;
   
   if (dayDiff >= 1) {
     newDailyCount = 0;
     newStreak = (dayDiff === 1) ? (userRec.consecutiveStudyDays + 1) : 1;
   }
   ```

**Files to Modify:**
- File containing `recordStudyRatingAction` (likely `actions/study.ts`)

**Validation:**
- [ ] `srsLevel` field updates correctly in database
- [ ] Level increments for Good/Easy ratings
- [ ] Level resets to 0 for Again rating
- [ ] Streak calculation handles day boundaries correctly

**Dependencies:** Task 3.2 (Job status updates)

**Rollback:** Remove srsLevel updates from SET clause

---

### Task 4.2: Add Keyboard Shortcuts to Study Page

**Implementation Steps:**

1. **Locate study page component:**
   ```bash
   cd nextjs-app
   find . -name "*study*" -name "*.tsx"
   cat app/\(main\)/study/\[deckId\]/page.tsx
   ```

2. **Add keyboard event handling:**
   ```tsx
   // In the client component section of study page
   "use client";
   
   import { useEffect, useState } from "react";
   
   export default function StudyPage(/* props */) {
     const [isShowingAnswer, setIsShowingAnswer] = useState(false);
     const [currentCardIndex, setCurrentCardIndex] = useState(0);
     
     // Add keyboard shortcuts
     useEffect(() => {
       const handleKeyDown = (e: KeyboardEvent) => {
         // Prevent shortcuts when typing in inputs
         if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
           return;
         }
         
         if (!isShowingAnswer && e.code === "Space") {
           e.preventDefault();
           setIsShowingAnswer(true);
         }
         
         if (isShowingAnswer) {
           switch (e.key) {
             case "1":
               e.preventDefault();
               handleRating("again");
               break;
             case "2":
               e.preventDefault();
               handleRating("hard");
               break;
             case "3":
               e.preventDefault();
               handleRating("good");
               break;
             case "4":
               e.preventDefault();
               handleRating("easy");
               break;
           }
         }
       };
       
       window.addEventListener("keydown", handleKeyDown);
       return () => window.removeEventListener("keydown", handleKeyDown);
     }, [isShowingAnswer, currentCardIndex]);
     
     // ... rest of component
   }
   ```

3. **Add accessibility announcements:**
   ```tsx
   // Add screen reader announcements
   const [announcement, setAnnouncement] = useState("");
   
   const handleShowAnswer = () => {
     setIsShowingAnswer(true);
     setAnnouncement("Answer revealed");
   };
   
   const handleRating = (rating: string) => {
     // ... existing rating logic ...
     setAnnouncement(`Card rated as ${rating}. Moving to next card.`);
   };
   
   // In JSX:
   return (
     <div>
       <div aria-live="polite" className="sr-only">
         {announcement}
       </div>
       {/* ... rest of component */}
     </div>
   );
   ```

4. **Add keyboard shortcut hints to UI:**
   ```tsx
   // Add hints in the UI
   <div className="text-sm text-muted-foreground mb-4">
     {!isShowingAnswer ? (
       <p>Press <kbd className="px-1 py-0.5 bg-muted rounded">Space</kbd> to show answer</p>
     ) : (
       <p>
         Rate: <kbd>1</kbd> Again, <kbd>2</kbd> Hard, <kbd>3</kbd> Good, <kbd>4</kbd> Easy
       </p>
     )}
   </div>
   ```

**Files to Modify:**
- `nextjs-app/app/(main)/study/[deckId]/page.tsx` (or related study component)

**Validation:**
- [ ] Space bar toggles answer visibility
- [ ] Number keys 1-4 select ratings when answer is shown
- [ ] Screen reader announces state changes
- [ ] Keyboard shortcuts don't interfere with form inputs
- [ ] Visual hints show available shortcuts

**Dependencies:** Task 4.1 (SRS writeback)

**Rollback:** Remove useEffect and keyboard handling code

---

### Task 4.3: Add Unit Tests for SRS Updates

**Implementation Steps:**

1. **Locate existing SRS tests:**
   ```bash
   cd nextjs-app
   find . -name "*srs*test*" -o -name "*test*srs*"
   cat lib/srs.test.ts  # if it exists
   ```

2. **Extend existing tests or create new ones:**
   ```typescript
   // nextjs-app/lib/srs.test.ts (extend existing or create new)
   import { describe, it, expect } from 'vitest';
   import { calculateNextReview } from './srs';
   
   describe('SRS Level Updates', () => {
     it('increments srsLevel for Good rating', () => {
       const card = { srsLevel: 2, srsEaseFactor: '2.5', srsInterval: 4 };
       const result = calculateNextReview(card, 'good');
       expect(result.nextLevel).toBe(3);
     });
     
     it('increments srsLevel for Easy rating', () => {
       const card = { srsLevel: 1, srsEaseFactor: '2.5', srsInterval: 1 };
       const result = calculateNextReview(card, 'easy');
       expect(result.nextLevel).toBe(2);
     });
     
     it('resets srsLevel to 0 for Again rating', () => {
       const card = { srsLevel: 5, srsEaseFactor: '2.5', srsInterval: 15 };
       const result = calculateNextReview(card, 'again');
       expect(result.nextLevel).toBe(0);
     });
     
     it('maintains srsLevel for Hard rating', () => {
       const card = { srsLevel: 3, srsEaseFactor: '2.5', srsInterval: 8 };
       const result = calculateNextReview(card, 'hard');
       expect(result.nextLevel).toBe(3);
     });
   });
   
   describe('Streak Calculation', () => {
     it('increments streak for consecutive day study', () => {
       const yesterday = new Date();
       yesterday.setDate(yesterday.getDate() - 1);
       
       const result = calculateStreakUpdate(yesterday, 5);
       expect(result.newStreak).toBe(6);
     });
     
     it('resets streak for gap > 1 day', () => {
       const threeDaysAgo = new Date();
       threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
       
       const result = calculateStreakUpdate(threeDaysAgo, 10);
       expect(result.newStreak).toBe(1);
     });
   });
   ```

3. **Update SRS module to export testable functions:**
   ```typescript
   // nextjs-app/lib/srs.ts
   // Ensure functions are exported for testing
   
   export function calculateNextReview(card: any, rating: string) {
     // ... existing logic ...
     
     const nextLevel = 
       rating === "again" ? 0 :
       rating === "hard" ? Math.max(0, (card.srsLevel ?? 0)) :
       (card.srsLevel ?? 0) + 1;
     
     return {
       // ... existing return values ...
       nextLevel
     };
   }
   
   export function calculateStreakUpdate(lastStudiedDate: Date, currentStreak: number) {
     const today = new Date();
     const MS_PER_DAY = 86_400_000;
     const dayDiff = Math.floor((today.getTime() - lastStudiedDate.getTime()) / MS_PER_DAY);
     
     return {
       newStreak: (dayDiff === 1) ? currentStreak + 1 : 1,
       shouldResetDaily: dayDiff >= 1
     };
   }
   ```

4. **Run tests:**
   ```bash
   cd nextjs-app
   npm run test
   ```

**Files to Modify:**
- `nextjs-app/lib/srs.test.ts` (extend or create)
- `nextjs-app/lib/srs.ts` (export testable functions)

**Validation:**
- [ ] All SRS tests pass
- [ ] srsLevel logic is tested for all rating types
- [ ] Streak calculation handles edge cases
- [ ] `npm run test` succeeds

**Dependencies:** Task 4.2 (Keyboard shortcuts)

**Rollback:** Remove new tests and function exports

---

## Phase 5 — Real Progress Stats

### Task 5.1: Implement Real Stats Calculation

**Implementation Steps:**

1. **Locate current stats action:**
   ```bash
   cd nextjs-app
   rg "getUserStatsAction" --type ts -A 10 -B 5
   ```

2. **Replace with real calculations:**
   ```typescript
   // In the file containing getUserStatsAction
   import { auth } from "@clerk/nextjs";
   import { db } from "@/db";
   import { users } from "@/db/schema";
   import { eq } from "drizzle-orm";
   
   export async function getUserStatsAction(): Promise<ActionState<{
     dailyCount: number;
     weeklyCount: number;
     accuracy: number;
     streak: number;
   }>> {
     const { userId } = auth();
     if (!userId) {
       return { isSuccess: false, message: "Unauthorized" };
     }
   
     try {
       const user = await db.query.users.findFirst({
         where: eq(users.id, userId)
       });
       
       if (!user) {
         return { isSuccess: false, message: "User not found" };
       }
   
       const totalReviews = user.totalReviews ?? 0;
       const correctReviews = user.totalCorrectReviews ?? 0;
       const accuracy = totalReviews > 0 
         ? Math.round((correctReviews / totalReviews) * 1000) / 10 
         : 0;
   
       return {
         isSuccess: true,
         data: {
           dailyCount: user.dailyStudyCount ?? 0,
           weeklyCount: user.weeklyStudyCount ?? 0,
           accuracy,
           streak: user.consecutiveStudyDays ?? 0,
         }
       };
     } catch (error) {
       console.error("Error fetching user stats:", error);
       return { 
         isSuccess: false, 
         message: "Failed to fetch statistics" 
       };
     }
   }
   ```

**Files to Modify:**
- File containing `getUserStatsAction` (likely `actions/db/users.ts`)

**Validation:**
- [ ] Stats show real values from database
- [ ] Accuracy calculation is correct (percentage to 1 decimal)
- [ ] All stat fields display properly
- [ ] Returns zero values gracefully for new users

**Dependencies:** Task 4.3 (SRS tests)

**Rollback:** Restore previous implementation returning placeholder zeros

---

### Task 5.2: Wire Stats to UI Components

**Implementation Steps:**

1. **Find components displaying stats:**
   ```bash
   cd nextjs-app
   rg "StatsDisplay\|getUserStats" --type tsx --type ts -A 5 -B 5
   ```

2. **Update StatsDisplay component:**
   ```tsx
   // In the StatsDisplay component file
   "use client";
   
   import { useState, useEffect } from "react";
   import { getUserStatsAction } from "@/actions/db/users";
   
   interface StatsData {
     dailyCount: number;
     weeklyCount: number;
     accuracy: number;
     streak: number;
   }
   
   export default function StatsDisplay() {
     const [stats, setStats] = useState<StatsData | null>(null);
     const [loading, setLoading] = useState(true);
     const [error, setError] = useState<string | null>(null);
   
     useEffect(() => {
       async function loadStats() {
         try {
           const result = await getUserStatsAction();
           if (result.isSuccess && result.data) {
             setStats(result.data);
           } else {
             setError(result.message || "Failed to load stats");
           }
         } catch (err) {
           setError("Failed to load statistics");
         } finally {
           setLoading(false);
         }
       }
   
       loadStats();
     }, []);
   
     if (loading) return <div>Loading stats...</div>;
     if (error) return <div>Error: {error}</div>;
     if (!stats) return <div>No stats available</div>;
   
     return (
       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <StatCard title="Today" value={stats.dailyCount.toString()} />
         <StatCard title="This Week" value={stats.weeklyCount.toString()} />
         <StatCard title="Accuracy" value={`${stats.accuracy}%`} />
         <StatCard title="Streak" value={`${stats.streak} days`} />
       </div>
     );
   }
   
   function StatCard({ title, value }: { title: string; value: string }) {
     return (
       <div className="bg-card p-4 rounded-lg border">
         <div className="text-sm text-muted-foreground">{title}</div>
         <div className="text-2xl font-bold">{value}</div>
       </div>
     );
   }
   ```

**Files to Modify:**
- StatsDisplay component file
- Any other components showing user statistics

**Validation:**
- [ ] Dashboard shows live stats from database
- [ ] Progress page displays accurate numbers
- [ ] Stats update after completing study sessions
- [ ] Error states handled gracefully

**Dependencies:** Task 5.1 (Stats calculation)

**Rollback:** Restore components to show placeholder values

---

## Implementation continues with remaining phases...

This detailed implementation plan provides specific, actionable steps for the first 5 phases. Each subsequent phase would follow the same pattern with:

- **Specific file paths** to modify
- **Exact code changes** to implement  
- **Validation criteria** to verify completion
- **Clear dependencies** between tasks
- **Rollback instructions** for safe recovery

The remaining phases (6-10) would cover:
- **Phase 6**: Durable rate limiting with Redis/KV
- **Phase 7**: Security headers and markdown sanitization
- **Phase 8**: CI hardening and comprehensive tests
- **Phase 9**: Code cleanup and routing improvements  
- **Phase 10**: Documentation and operational readiness

Each phase builds systematically on previous work to ensure safe, incremental progress toward the production-ready application described in the expert review.