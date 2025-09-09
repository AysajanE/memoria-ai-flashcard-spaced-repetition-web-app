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

## Phase 6 — Durable Rate Limiting with Redis/KV

### Task 6.1: Set Up Redis/KV Infrastructure

**Implementation Steps:**

1. **Choose Redis provider:**
   ```bash
   # Option A: Upstash Redis (recommended for flexibility)
   # Sign up at https://upstash.com and create a Redis instance
   # Copy connection URL and token
   
   # Option B: Vercel KV (if deploying to Vercel)
   # Enable KV in Vercel dashboard
   # Copy KV_REST_API_URL and KV_REST_API_TOKEN
   ```

2. **Install Redis client dependency:**
   ```bash
   cd nextjs-app
   npm install @upstash/redis
   ```

3. **Update environment configuration:**
   ```bash
   # Add to .env.example
   echo "
   # -- REDIS RATE LIMITING --
   # Production: Configure Upstash Redis for durable rate limiting across instances
   # Development: Leave empty to use in-memory rate limiting
   UPSTASH_REDIS_REST_URL=\"https://your-redis-instance.upstash.io\"
   UPSTASH_REDIS_REST_TOKEN=\"your-redis-token\"

   # Alternative: Vercel KV (if deploying to Vercel)
   # KV_REST_API_URL=\"https://your-kv.kv.vercel-storage.com\" 
   # KV_REST_API_TOKEN=\"your-kv-token\"" >> .env.example
   ```

4. **Set up production environment variables:**
   ```bash
   # In production deployment platform, set:
   # UPSTASH_REDIS_REST_URL=<your-actual-redis-url>
   # UPSTASH_REDIS_REST_TOKEN=<your-actual-redis-token>
   ```

**Files to Create/Modify:**
- `nextjs-app/package.json` (add @upstash/redis dependency)
- `nextjs-app/.env.example` (add Redis configuration)

**Validation:**
- [ ] @upstash/redis package installed successfully
- [ ] Environment variables added to .env.example
- [ ] Redis instance accessible via provided credentials
- [ ] Production environment configured with Redis credentials

**Dependencies:** Task 5.2 (Stats UI integration)

**Rollback:** Remove @upstash/redis package and environment variables

---

### Task 6.2: Implement Redis-Based Rate Limiter

**Implementation Steps:**

1. **Create Redis rate limiter module:**
   ```typescript
   // nextjs-app/lib/redis-rate-limit.ts
   import { Redis } from "@upstash/redis";

   const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
     ? new Redis({
         url: process.env.UPSTASH_REDIS_REST_URL,
         token: process.env.UPSTASH_REDIS_REST_TOKEN,
       })
     : null;

   export interface RateLimitResult {
     success: boolean;
     limit: number;
     remaining: number;
     reset: number;
   }

   export async function redisRateLimit(
     userId: string,
     namespace: string,
     limitPerMinute: number = 10
   ): Promise<RateLimitResult> {
     if (!redis) {
       throw new Error("Redis not configured for rate limiting");
     }

     const key = `rate_limit:${namespace}:${userId}`;
     const now = Date.now();
     const window = 60 * 1000; // 1 minute window
     const windowStart = now - window;

     try {
       // Use Redis pipeline for atomic operations
       const pipeline = redis.pipeline();
       
       // Remove expired entries
       pipeline.zremrangebyscore(key, 0, windowStart);
       
       // Count current requests in window
       pipeline.zcard(key);
       
       // Add current request
       pipeline.zadd(key, { score: now, member: `${now}-${Math.random()}` });
       
       // Set expiration
       pipeline.expire(key, Math.ceil(window / 1000));
       
       const results = await pipeline.exec();
       const currentCount = (results[1] as number) || 0;
       
       const success = currentCount < limitPerMinute;
       const remaining = Math.max(0, limitPerMinute - currentCount - 1);
       const reset = now + window;

       if (!success) {
         // Remove the request we just added since it exceeded the limit
         await redis.zrem(key, `${now}-${Math.random()}`);
       }

       return {
         success,
         limit: limitPerMinute,
         remaining,
         reset,
       };
     } catch (error) {
       console.error("Redis rate limit error:", error);
       // Fail open - allow request but log error
       return {
         success: true,
         limit: limitPerMinute,
         remaining: limitPerMinute - 1,
         reset: now + window,
       };
     }
   }
   ```

**Files to Create/Modify:**
- `nextjs-app/lib/redis-rate-limit.ts` (new file)

**Validation:**
- [ ] Redis client properly initialized with environment variables
- [ ] Sliding window algorithm implemented with pipeline operations
- [ ] Error handling includes fail-open behavior
- [ ] TypeScript types are correct

**Dependencies:** Task 6.1 (Redis infrastructure setup)

**Rollback:** Delete `redis-rate-limit.ts` file

---

### Task 6.3: Update Core Rate Limiting with Redis Support

**Implementation Steps:**

1. **Examine current rate limiter implementation:**
   ```bash
   cd nextjs-app
   cat lib/rate-limit.ts
   # Check current enforceRateLimit function signature
   ```

2. **Update to support Redis with fallback:**
   ```typescript
   // nextjs-app/lib/rate-limit.ts
   import { redisRateLimit } from "./redis-rate-limit";

   // In-memory fallback for development/local environments
   const memoryBuckets = new Map<string, { windowStart: number; count: number }>();

   async function memoryRateLimit(
     userId: string,
     namespace: string,
     limitPerMinute: number = 10
   ) {
     const key = `${namespace}:${userId}`;
     const now = Date.now();
     const windowMs = 60_000;
     const bucket = memoryBuckets.get(key);
     
     if (!bucket || now - bucket.windowStart >= windowMs) {
       memoryBuckets.set(key, { windowStart: now, count: 1 });
       return;
     }
     
     if (bucket.count >= limitPerMinute) {
       throw new Error("Rate limit exceeded. Please try again later.");
     }
     
     bucket.count += 1;
   }

   export async function enforceRateLimit(
     userId: string,
     namespace: string,
     limitPerMinute = 10
   ) {
     // Use Redis in production, memory in development
     const useRedis = process.env.NODE_ENV === "production" && 
                      process.env.UPSTASH_REDIS_REST_URL && 
                      process.env.UPSTASH_REDIS_REST_TOKEN;

     if (useRedis) {
       try {
         const result = await redisRateLimit(userId, namespace, limitPerMinute);
         if (!result.success) {
           throw new Error("Rate limit exceeded. Please try again later.");
         }
       } catch (error) {
         // If Redis fails, fall back to memory-based limiting
         console.warn("Redis rate limiting failed, falling back to memory:", error);
         await memoryRateLimit(userId, namespace, limitPerMinute);
       }
     } else {
       // Development mode or Redis not configured
       await memoryRateLimit(userId, namespace, limitPerMinute);
     }
   }
   ```

3. **Verify existing server actions still work:**
   ```bash
   cd nextjs-app
   rg "enforceRateLimit" --type ts -A 3 -B 3
   # Check all usages maintain the same function signature
   ```

**Files to Create/Modify:**
- `nextjs-app/lib/rate-limit.ts`

**Validation:**
- [ ] Function signature unchanged from existing implementation
- [ ] Redis used in production environment when configured
- [ ] Memory fallback works in development
- [ ] Graceful fallback when Redis fails
- [ ] Existing server actions continue to work

**Dependencies:** Task 6.2 (Redis rate limiter implementation)

**Rollback:** Restore original `rate-limit.ts` implementation

---

### Task 6.4: Add Comprehensive Rate Limiting Tests

**Implementation Steps:**

1. **Create test file for rate limiting:**
   ```typescript
   // nextjs-app/lib/rate-limit.test.ts
   import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
   import { enforceRateLimit } from "./rate-limit";
   import { redisRateLimit } from "./redis-rate-limit";

   // Mock Redis client
   vi.mock("@upstash/redis", () => ({
     Redis: vi.fn().mockImplementation(() => ({
       pipeline: vi.fn().mockReturnValue({
         zremrangebyscore: vi.fn().mockReturnThis(),
         zcard: vi.fn().mockReturnThis(),
         zadd: vi.fn().mockReturnThis(),
         expire: vi.fn().mockReturnThis(),
         exec: vi.fn().mockResolvedValue([null, 0, null, null]),
       }),
       zrem: vi.fn().mockResolvedValue(1),
     })),
   }));

   describe("Rate Limiting", () => {
     beforeEach(() => {
       vi.clearAllMocks();
       // Reset environment for each test
       delete process.env.NODE_ENV;
       delete process.env.UPSTASH_REDIS_REST_URL;
       delete process.env.UPSTASH_REDIS_REST_TOKEN;
     });

     afterEach(() => {
       vi.restoreAllMocks();
     });

     describe("Memory-based rate limiting (development)", () => {
       it("should allow requests within the limit", async () => {
         const userId = "user1";
         const namespace = "test";
         const limit = 3;

         // Should not throw for requests within limit
         await expect(enforceRateLimit(userId, namespace, limit)).resolves.not.toThrow();
         await expect(enforceRateLimit(userId, namespace, limit)).resolves.not.toThrow();
         await expect(enforceRateLimit(userId, namespace, limit)).resolves.not.toThrow();
       });

       it("should reject requests exceeding the limit", async () => {
         const userId = "user2";
         const namespace = "test";
         const limit = 2;

         // Fill up the bucket
         await enforceRateLimit(userId, namespace, limit);
         await enforceRateLimit(userId, namespace, limit);

         // Next request should fail
         await expect(enforceRateLimit(userId, namespace, limit)).rejects.toThrow(
           "Rate limit exceeded"
         );
       });

       it("should handle different users independently", async () => {
         const namespace = "test";
         const limit = 1;

         await enforceRateLimit("user4", namespace, limit);
         await enforceRateLimit("user5", namespace, limit);

         // Both users should have used their limit
         await expect(enforceRateLimit("user4", namespace, limit)).rejects.toThrow();
         await expect(enforceRateLimit("user5", namespace, limit)).rejects.toThrow();
       });
     });

     describe("Redis-based rate limiting (production)", () => {
       beforeEach(() => {
         // Set production environment
         process.env.NODE_ENV = "production";
         process.env.UPSTASH_REDIS_REST_URL = "https://test-redis.upstash.io";
         process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
       });

       it("should use Redis in production environment", async () => {
         const userId = "redis-user1";
         const namespace = "test";
         const limit = 5;

         // Mock successful Redis response
         const mockExec = vi.fn().mockResolvedValue([null, 2, null, null]);
         vi.mocked(require("@upstash/redis").Redis).mockImplementation(() => ({
           pipeline: () => ({
             zremrangebyscore: vi.fn().mockReturnThis(),
             zcard: vi.fn().mockReturnThis(),
             zadd: vi.fn().mockReturnThis(),
             expire: vi.fn().mockReturnThis(),
             exec: mockExec,
           }),
           zrem: vi.fn().mockResolvedValue(1),
         }));

         await expect(enforceRateLimit(userId, namespace, limit)).resolves.not.toThrow();
         expect(mockExec).toHaveBeenCalled();
       });

       it("should fall back to memory on Redis failure", async () => {
         const userId = "fallback-user1";
         const namespace = "test";
         const limit = 3;

         // Mock Redis failure
         vi.mocked(require("@upstash/redis").Redis).mockImplementation(() => ({
           pipeline: () => ({
             zremrangebyscore: vi.fn().mockReturnThis(),
             zcard: vi.fn().mockReturnThis(),
             zadd: vi.fn().mockReturnThis(),
             expire: vi.fn().mockReturnThis(),
             exec: vi.fn().mockRejectedValue(new Error("Redis connection failed")),
           }),
         }));

         // Should still work with memory fallback
         await expect(enforceRateLimit(userId, namespace, limit)).resolves.not.toThrow();
       });
     });
   });
   ```

2. **Run tests to verify implementation:**
   ```bash
   cd nextjs-app
   npm test lib/rate-limit.test.ts
   ```

**Files to Create/Modify:**
- `nextjs-app/lib/rate-limit.test.ts` (new file)

**Validation:**
- [ ] All memory-based rate limiting tests pass
- [ ] Redis-based rate limiting tests with mocking pass  
- [ ] Fallback behavior tests pass
- [ ] Environment-based backend selection works
- [ ] `npm test` command succeeds

**Dependencies:** Task 6.3 (Core rate limiting update)

**Rollback:** Delete `rate-limit.test.ts` file

---

### Task 6.5: Production Environment Setup and Documentation

**Implementation Steps:**

1. **Verify production environment variables:**
   ```bash
   # In production deployment platform, ensure these are set:
   # UPSTASH_REDIS_REST_URL=<actual-redis-url>
   # UPSTASH_REDIS_REST_TOKEN=<actual-redis-token>
   # NODE_ENV=production
   ```

2. **Test production configuration in staging:**
   ```bash
   cd nextjs-app
   # Set production env vars temporarily
   export NODE_ENV=production
   export UPSTASH_REDIS_REST_URL="your-actual-url"
   export UPSTASH_REDIS_REST_TOKEN="your-actual-token"
   
   # Test a server action that uses rate limiting
   npm run build
   npm start
   ```

3. **Add monitoring and observability:**
   ```typescript
   // In redis-rate-limit.ts, add monitoring
   export async function redisRateLimit(
     userId: string,
     namespace: string,
     limitPerMinute: number = 10
   ): Promise<RateLimitResult> {
     if (!redis) {
       throw new Error("Redis not configured for rate limiting");
     }

     const startTime = Date.now();
     
     try {
       // ... existing implementation ...
       
       // Log performance metrics
       const duration = Date.now() - startTime;
       if (duration > 100) {
         console.warn(`Slow Redis rate limit operation: ${duration}ms for ${namespace}:${userId}`);
       }
       
       return result;
     } catch (error) {
       console.error("Redis rate limit error:", {
         error: error.message,
         userId,
         namespace,
         duration: Date.now() - startTime
       });
       // ... existing error handling ...
     }
   }
   ```

**Files to Create/Modify:**
- `nextjs-app/lib/redis-rate-limit.ts` (add monitoring)

**Validation:**
- [ ] Production environment variables configured correctly
- [ ] Redis connection works in production environment
- [ ] Fallback to memory works when Redis unavailable
- [ ] Performance monitoring logs are present
- [ ] Rate limiting works across multiple application instances

**Dependencies:** Task 6.4 (Rate limiting tests)

**Rollback:** Remove monitoring code and revert to basic implementation

---

## Phase 7 — Security Headers & Markdown Sanitization

### Task 7.1: Install Markdown Sanitization Dependencies

**Implementation Steps:**

1. **Install rehype-sanitize for markdown XSS protection:**
   ```bash
   cd nextjs-app
   npm install rehype-sanitize@^6.0.0
   ```

2. **Verify installation:**
   ```bash
   npm ls rehype-sanitize
   # Should show rehype-sanitize@^6.0.0
   ```

**Files to Modify:**
- `nextjs-app/package.json` (updated by npm install)

**Validation:**
- [ ] `rehype-sanitize` appears in package.json dependencies
- [ ] `npm ls rehype-sanitize` shows successful installation
- [ ] No installation errors in terminal

**Dependencies:** Task 6.5 (Production environment setup complete)

**Rollback:** `npm uninstall rehype-sanitize`

---

### Task 7.2: Create Security Headers Configuration Module

**Implementation Steps:**

1. **Create security headers utility:**
   ```typescript
   // nextjs-app/src/lib/security-headers.ts
   import { NextResponse } from 'next/server';

   interface SecurityHeadersOptions {
     enableCSP?: boolean;
     cspDirectives?: Record<string, string | string[]>;
     additionalHeaders?: Record<string, string>;
   }

   const defaultCSPDirectives = {
     'default-src': "'self'",
     'script-src': [
       "'self'",
       "'unsafe-inline'",
       "'unsafe-eval'",
       "https://*.clerk.accounts.dev",
       "https://*.clerk.com",
       "https://challenges.cloudflare.com",
       "https://js.stripe.com",
     ].join(' '),
     'style-src': [
       "'self'",
       "'unsafe-inline'",
       "https://fonts.googleapis.com",
     ].join(' '),
     'img-src': [
       "'self'",
       "data:",
       "blob:",
       "https:",
       "https://*.clerk.com",
       "https://img.clerk.com",
     ].join(' '),
     'font-src': [
       "'self'",
       "https://fonts.gstatic.com",
     ].join(' '),
     'connect-src': [
       "'self'",
       "https://*.clerk.accounts.dev",
       "https://*.clerk.com",
       "https://api.stripe.com",
       process.env.NODE_ENV === 'development' ? 'ws://localhost:3000' : '',
     ].filter(Boolean).join(' '),
     'frame-src': [
       "'self'",
       "https://challenges.cloudflare.com",
       "https://js.stripe.com",
     ].join(' '),
     'frame-ancestors': "'none'",
     'object-src': "'none'",
     'base-uri': "'self'",
     'form-action': "'self'",
   };

   export function createSecurityHeaders(options: SecurityHeadersOptions = {}) {
     const {
       enableCSP = true,
       cspDirectives = {},
       additionalHeaders = {}
     } = options;

     const headers: Record<string, string> = {
       // Basic security headers
       'X-Frame-Options': 'DENY',
       'X-Content-Type-Options': 'nosniff',
       'Referrer-Policy': 'strict-origin-when-cross-origin',
       'X-XSS-Protection': '1; mode=block',
       'Permissions-Policy': [
         'camera=()',
         'microphone=()',
         'geolocation=()',
         'interest-cohort=()',
       ].join(', '),
       ...additionalHeaders,
     };

     if (enableCSP) {
       const mergedDirectives = { ...defaultCSPDirectives, ...cspDirectives };
       const cspString = Object.entries(mergedDirectives)
         .map(([directive, value]) => `${directive} ${value}`)
         .join('; ');
       
       headers['Content-Security-Policy'] = cspString;
     }

     return headers;
   }

   export function applySecurityHeaders(
     response: NextResponse,
     options?: SecurityHeadersOptions
   ): NextResponse {
     const headers = createSecurityHeaders(options);
     
     Object.entries(headers).forEach(([key, value]) => {
       response.headers.set(key, value);
     });

     return response;
   }

   // Routes that should skip security headers (e.g., webhooks, API endpoints that need flexibility)
   export const SECURITY_HEADER_SKIP_PATHS = [
     '/api/webhooks/',
     '/_next/',
     '/favicon.ico',
   ];

   export function shouldSkipSecurityHeaders(pathname: string): boolean {
     return SECURITY_HEADER_SKIP_PATHS.some(skipPath => pathname.startsWith(skipPath));
   }
   ```

**Files to Create:**
- `nextjs-app/src/lib/security-headers.ts`

**Validation:**
- [ ] File creates without TypeScript errors
- [ ] All imports resolve correctly
- [ ] CSP directives include necessary Clerk and Stripe domains
- [ ] Headers configuration is comprehensive

**Dependencies:** Task 7.1 (Dependencies installed)

**Rollback:** Delete `nextjs-app/src/lib/security-headers.ts`

---

### Task 7.3: Update Middleware with Security Headers

**Implementation Steps:**

1. **Backup current middleware:**
   ```bash
   cd nextjs-app
   cp middleware.ts middleware.ts.backup
   ```

2. **Update middleware to include security headers:**
   ```typescript
   // nextjs-app/middleware.ts
   import { authMiddleware } from "@clerk/nextjs";
   import { NextResponse } from "next/server";
   import { 
     applySecurityHeaders, 
     shouldSkipSecurityHeaders 
   } from "@/lib/security-headers";

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
     ignoredRoutes: [
       "/_next(.*)", 
       "/favicon.ico", 
       "/assets(.*)"
     ],
     afterAuth(auth, req) {
       // Let Clerk handle authentication first
       const response = NextResponse.next();

       // Apply security headers to appropriate routes
       if (!shouldSkipSecurityHeaders(req.nextUrl.pathname)) {
         return applySecurityHeaders(response);
       }

       return response;
     },
   });

   export const config = { 
     matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"] 
   };
   ```

**Files to Modify:**
- `nextjs-app/middleware.ts`

**Validation:**
- [ ] `npm run build` succeeds without middleware errors
- [ ] `npm run dev` starts without security header conflicts
- [ ] Authentication still works correctly
- [ ] Security headers appear in browser network tab (except for skipped paths)

**Dependencies:** Task 7.2 (Security headers module created)

**Rollback:** `cp middleware.ts.backup middleware.ts`

---

### Task 7.4: Implement Markdown Sanitization

**Implementation Steps:**

1. **Locate the markdown renderer:**
   ```bash
   cd nextjs-app
   find . -name "*markdown*" -type f | grep -v node_modules
   ```

2. **Update markdown renderer with sanitization:**
   ```tsx
   // nextjs-app/components/shared/markdown-renderer.tsx
   'use client';
   
   import ReactMarkdown from 'react-markdown';
   import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
   import type { ReactNode } from 'react';

   interface MarkdownRendererProps {
     content: string;
     className?: string;
     allowDangerousHtml?: boolean;
   }

   // Custom sanitization schema
   const customSanitizeSchema = {
     ...defaultSchema,
     attributes: {
       ...defaultSchema.attributes,
       // Allow className for styling
       '*': [...(defaultSchema.attributes?.['*'] || []), 'className'],
       // Enhanced link security
       a: [...(defaultSchema.attributes?.a || []), 'rel', 'target'],
     },
     // Remove potentially dangerous elements
     tagNames: defaultSchema.tagNames?.filter(
       tagName => !['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button'].includes(tagName)
     ),
     protocols: {
       ...defaultSchema.protocols,
       // Only allow safe protocols
       href: ['http', 'https', 'mailto'],
       src: ['http', 'https'],
     },
   };

   // Unsafe schema for trusted content (use with extreme caution)
   const trustedContentSchema = {
     ...defaultSchema,
     // Less restrictive for trusted admin content, but still blocks scripts
     tagNames: defaultSchema.tagNames?.filter(tagName => tagName !== 'script'),
   };

   export function MarkdownRenderer({ 
     content, 
     className = '',
     allowDangerousHtml = false 
   }: MarkdownRendererProps): ReactNode {
     if (!content) return null;

     const sanitizeOptions = allowDangerousHtml ? trustedContentSchema : customSanitizeSchema;

     return (
       <div className={`prose prose-sm max-w-none ${className}`}>
         <ReactMarkdown
           rehypePlugins={[[rehypeSanitize, sanitizeOptions]]}
           components={{
             // Enhance link security
             a: ({ href, children, ...props }) => (
               <a
                 href={href}
                 {...props}
                 rel="noopener noreferrer nofollow"
                 target={href?.startsWith('http') ? '_blank' : '_self'}
               >
                 {children}
               </a>
             ),
             // Prevent dangerous code execution
             code: ({ children, ...props }) => (
               <code {...props} className="bg-muted px-1 py-0.5 rounded">
                 {children}
               </code>
             ),
             pre: ({ children, ...props }) => (
               <pre {...props} className="bg-muted p-3 rounded overflow-x-auto">
                 {children}
               </pre>
             ),
           }}
         >
           {content}
         </ReactMarkdown>
       </div>
     );
   }

   export default MarkdownRenderer;
   ```

3. **Update any existing usage to remove unsafe patterns:**
   ```bash
   cd nextjs-app
   # Find any potentially unsafe markdown usage
   rg "dangerouslySetInnerHTML.*markdown" --type tsx
   rg "innerHTML.*markdown" --type tsx
   # Replace any found instances with MarkdownRenderer
   ```

**Files to Modify:**
- `nextjs-app/components/shared/markdown-renderer.tsx`
- Any components using unsafe markdown rendering

**Validation:**
- [ ] Component renders without TypeScript errors
- [ ] Malicious script tags are stripped from content
- [ ] Links automatically get security attributes
- [ ] Styling is preserved for safe elements
- [ ] `allowDangerousHtml` prop works for trusted content

**Dependencies:** Task 7.1 (rehype-sanitize installed)

**Rollback:** Restore original markdown renderer implementation

---

### Task 7.5: Create Security Testing Utilities

**Implementation Steps:**

1. **Create security testing utilities:**
   ```typescript
   // nextjs-app/src/lib/security-test-utils.ts
   export const XSS_TEST_PAYLOADS = [
     '<script>alert("XSS")</script>',
     '<img src="x" onerror="alert(\'XSS\')">',
     '<iframe src="javascript:alert(\'XSS\')"></iframe>',
     '<svg onload="alert(\'XSS\')">',
     '<div onclick="alert(\'XSS\')">Click me</div>',
     '<a href="javascript:alert(\'XSS\')">Link</a>',
     '<form><input type="text" value="<script>alert(\'XSS\')</script>"></form>',
   ];

   export const CLICKJACKING_TEST_HTML = `
     <html>
       <body>
         <iframe src="https://your-app.com" width="100%" height="600"></iframe>
       </body>
     </html>
   `;

   export function testMarkdownSanitization(content: string): boolean {
     // This would be used in tests to verify malicious content is sanitized
     const dangerousPatterns = [
       /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
       /javascript:/gi,
       /on\w+\s*=/gi, // Event handlers like onclick, onload, etc.
       /<iframe/gi,
       /<object/gi,
       /<embed/gi,
     ];

     return !dangerousPatterns.some(pattern => pattern.test(content));
   }

   export function validateSecurityHeaders(headers: Record<string, string>): {
     isValid: boolean;
     missing: string[];
     issues: string[];
   } {
     const requiredHeaders = [
       'X-Frame-Options',
       'X-Content-Type-Options',
       'Referrer-Policy',
       'Content-Security-Policy',
     ];

     const missing = requiredHeaders.filter(header => !headers[header]);
     const issues: string[] = [];

     // Validate specific header values
     if (headers['X-Frame-Options'] !== 'DENY') {
       issues.push('X-Frame-Options should be DENY for maximum protection');
     }

     if (headers['X-Content-Type-Options'] !== 'nosniff') {
       issues.push('X-Content-Type-Options should be nosniff');
     }

     if (headers['Content-Security-Policy'] && 
         !headers['Content-Security-Policy'].includes("frame-ancestors 'none'")) {
       issues.push('CSP should include frame-ancestors none for clickjacking protection');
     }

     return {
       isValid: missing.length === 0 && issues.length === 0,
       missing,
       issues,
     };
   }

   // Development-only testing interface
   export const SECURITY_TEST_ENDPOINTS = process.env.NODE_ENV === 'development' ? {
     '/dev/security-test': 'Security testing interface (dev only)',
   } : {};
   ```

2. **Create development security test page:**
   ```tsx
   // nextjs-app/src/app/dev/security-test/page.tsx
   'use client';

   import { useState } from 'react';
   import { MarkdownRenderer } from '@/components/shared/markdown-renderer';
   import { Button } from '@/components/ui/button';
   import { Textarea } from '@/components/ui/textarea';
   import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
   import { XSS_TEST_PAYLOADS } from '@/lib/security-test-utils';

   export default function SecurityTestPage() {
     const [testContent, setTestContent] = useState('');
     const [selectedPayload, setSelectedPayload] = useState('');

     if (process.env.NODE_ENV !== 'development') {
       return <div>This page is only available in development mode.</div>;
     }

     return (
       <div className="container mx-auto py-8 space-y-6">
         <h1 className="text-3xl font-bold">Security Testing Interface</h1>
         <p className="text-muted-foreground">
           This page is only available in development mode for testing security implementations.
         </p>

         <Card>
           <CardHeader>
             <CardTitle>Markdown Sanitization Test</CardTitle>
           </CardHeader>
           <CardContent className="space-y-4">
             <div>
               <label className="text-sm font-medium">Test Payloads:</label>
               <div className="grid grid-cols-1 gap-2 mt-2">
                 {XSS_TEST_PAYLOADS.map((payload, index) => (
                   <Button
                     key={index}
                     variant="outline"
                     size="sm"
                     onClick={() => {
                       setSelectedPayload(payload);
                       setTestContent(payload);
                     }}
                     className="justify-start text-left"
                   >
                     {payload.length > 50 ? payload.substring(0, 50) + '...' : payload}
                   </Button>
                 ))}
               </div>
             </div>

             <Textarea
               placeholder="Enter markdown content to test..."
               value={testContent}
               onChange={(e) => setTestContent(e.target.value)}
               rows={4}
             />

             <Button onClick={() => setTestContent('')}>
               Clear
             </Button>

             {testContent && (
               <div>
                 <h3 className="text-lg font-semibold mb-2">Rendered Output:</h3>
                 <div className="border p-4 rounded">
                   <MarkdownRenderer content={testContent} />
                 </div>
                 
                 <h3 className="text-lg font-semibold mb-2 mt-4">Raw HTML (for inspection):</h3>
                 <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                   {testContent}
                 </pre>
               </div>
             )}
           </CardContent>
         </Card>

         <Card>
           <CardHeader>
             <CardTitle>Security Headers Check</CardTitle>
           </CardHeader>
           <CardContent>
             <p className="text-sm text-muted-foreground mb-4">
               Open browser dev tools → Network tab → Reload page → Check headers
             </p>
             <Button 
               onClick={() => window.location.reload()}
               variant="outline"
             >
               Reload to Check Headers
             </Button>
           </CardContent>
         </Card>
       </div>
     );
   }
   ```

**Files to Create:**
- `nextjs-app/src/lib/security-test-utils.ts`
- `nextjs-app/src/app/dev/security-test/page.tsx`

**Validation:**
- [ ] Test utilities compile without errors
- [ ] XSS payloads are properly defined
- [ ] Development test page is accessible in dev mode only
- [ ] Security test functions work correctly

**Dependencies:** Task 7.4 (Markdown sanitization implemented)

**Rollback:** Delete test utility files

---

### Task 7.6: Comprehensive Testing and Validation

**Implementation Steps:**

1. **Test security headers in browser:**
   ```bash
   cd nextjs-app
   npm run dev
   # Navigate to http://localhost:3000
   # Open Developer Tools → Network → Reload
   # Check response headers for security headers
   ```

2. **Test markdown sanitization:**
   ```bash
   # Navigate to http://localhost:3000/dev/security-test (dev only)
   # Test each XSS payload from the test interface
   # Verify malicious scripts are stripped
   ```

3. **Test build production mode:**
   ```bash
   cd nextjs-app
   npm run build
   npm start
   # Verify security headers work in production build
   ```

4. **Verify Clerk integration still works:**
   ```bash
   # Test sign-in/sign-up flows
   # Verify no CSP violations in browser console
   # Check authentication state persistence
   ```

5. **Run comprehensive validation:**
   ```bash
   # Check for any TypeScript errors
   npm run build

   # Check for linting issues
   npm run lint

   # Verify all routes accessible
   curl -I http://localhost:3000
   curl -I http://localhost:3000/api/job-status/test
   ```

**Files to Verify:**
- All existing routes remain functional
- No new TypeScript or build errors
- Security headers present in appropriate responses

**Validation:**
- [ ] All security headers present on HTML pages
- [ ] Webhook routes skip security headers appropriately
- [ ] XSS payloads are sanitized in markdown
- [ ] Clerk authentication flows work without CSP violations
- [ ] Build process completes successfully
- [ ] No console errors related to security policies
- [ ] Links in markdown get proper security attributes

**Dependencies:** Task 7.5 (Testing utilities created)

**Rollback:** Revert all changes using git reset if critical issues found

---

### Task 7.7: Production Security Configuration

**Implementation Steps:**

1. **Create production security documentation:**
   ```bash
   cd nextjs-app
   cat > SECURITY.md << 'EOF'
   # Security Implementation

   ## Security Headers

   This application implements comprehensive security headers via middleware:

   - **Content Security Policy (CSP)**: Prevents XSS attacks
   - **X-Frame-Options**: Prevents clickjacking
   - **X-Content-Type-Options**: Prevents MIME sniffing
   - **Referrer-Policy**: Controls referrer information
   - **X-XSS-Protection**: Browser XSS protection for older browsers
   - **Permissions-Policy**: Restricts browser features

   ## Markdown Sanitization

   All user-generated markdown content is sanitized using rehype-sanitize to prevent:
   - Script injection
   - Event handler injection
   - Dangerous iframe/object embeds
   - Malicious link protocols

   ## Testing Security

   ### Development Testing
   - Visit `/dev/security-test` in development mode
   - Test XSS payloads against markdown renderer
   - Verify security headers in browser dev tools

   ### Manual Security Verification
   ```bash
   # Check security headers
   curl -I https://your-domain.com

   # Verify CSP
   # Load page and check browser console for violations
   ```

   ## Maintenance

   ### CSP Updates
   When adding new third-party services, update CSP directives in:
   - `src/lib/security-headers.ts`

   ### Sanitization Schema Updates
   When allowing new HTML elements, carefully review:
   - `components/shared/markdown-renderer.tsx`
   - Test thoroughly with malicious payloads

   ## Monitoring

   - Monitor browser console for CSP violations
   - Set up CSP reporting endpoint if needed
   - Regular security header audits using tools like Mozilla Observatory
   EOF
   ```

2. **Create validation checklist:**
   ```bash
   cat > ../docs/phase7_validation_checklist.md << 'EOF'
   # Phase 7 Security Implementation Validation

   ## Pre-deployment Checklist

   ### Security Headers
   - [ ] X-Frame-Options: DENY present
   - [ ] X-Content-Type-Options: nosniff present  
   - [ ] Referrer-Policy configured appropriately
   - [ ] Content-Security-Policy includes all necessary directives
   - [ ] CSP includes required domains for Clerk, Stripe, etc.
   - [ ] Permissions-Policy restricts dangerous features

   ### Markdown Sanitization
   - [ ] Script tags are stripped from markdown
   - [ ] Event handlers (onclick, onload) are removed
   - [ ] Dangerous protocols (javascript:) are blocked
   - [ ] Iframe/object/embed tags are removed
   - [ ] Links get proper security attributes (rel, target)
   - [ ] allowDangerousHtml prop works for trusted content

   ### Integration Testing
   - [ ] Clerk authentication works without CSP violations
   - [ ] No console errors on page loads
   - [ ] Webhook endpoints appropriately skip headers
   - [ ] All existing functionality preserved

   ### Performance
   - [ ] No noticeable performance impact from middleware
   - [ ] Build times not significantly increased
   - [ ] Page load times unaffected

   ## Post-deployment Verification

   ### Browser Testing
   - [ ] Test in Chrome, Firefox, Safari
   - [ ] Check for CSP violations in console
   - [ ] Verify frames cannot embed the application

   ### Security Scanning
   - [ ] Run Mozilla Observatory scan
   - [ ] Verify Security Headers with online tools
   - [ ] Test XSS payloads in production

   ## Rollback Criteria

   If any of these issues occur, consider rollback:
   - Authentication flows break
   - Critical third-party integrations fail
   - Significant performance degradation
   - Users cannot access core functionality
   EOF
   ```

3. **Environment-specific configuration:**
   ```bash
   # Add to .env.example if not already present
   echo "
   # Security Configuration
   # Set to 'true' to enable stricter CSP in production
   ENABLE_STRICT_CSP=false
   
   # Set to 'false' to disable security test endpoints in production
   ENABLE_SECURITY_TESTING=false" >> .env.example
   ```

**Files to Create:**
- `nextjs-app/SECURITY.md`
- `docs/phase7_validation_checklist.md`

**Files to Modify:**
- `nextjs-app/.env.example` (add security configuration options)

**Validation:**
- [ ] Security documentation is comprehensive
- [ ] Validation checklist covers all implemented features
- [ ] Environment configuration is documented
- [ ] Team can follow maintenance procedures

**Dependencies:** Task 7.6 (Testing completed successfully)

**Rollback:** Remove documentation files if implementation is rolled back

---

## Phase 8 — CI Hardening & Tests

### Task 8.1: Fix Forbidden Import Script

**Implementation Steps:**

1. **Examine current script issue:**
   ```bash
   cd nextjs-app
   # Current script has path issue - searches 'nextjs-app' from inside nextjs-app directory
   npm run verify:no-app-db-imports
   # This fails because we're already in nextjs-app and searching for 'nextjs-app' subdirectory
   ```

2. **Fix the path in package.json:**
   ```json
   // nextjs-app/package.json
   // Replace the verify:no-app-db-imports script:
   "verify:no-app-db-imports": "node -e \"const {spawnSync}=require('node:child_process'); const r=spawnSync('rg',['-n','@/app/db','.'],{stdio:'inherit'}); if(r.status===0){console.error('Error: Found forbidden @/app/db imports'); process.exit(1);} else { process.exit(0);} \""
   ```

3. **Test the fixed script:**
   ```bash
   cd nextjs-app
   npm run verify:no-app-db-imports
   # Should exit 0 (success) if no forbidden imports exist
   ```

4. **Create a test file to verify detection works:**
   ```bash
   cd nextjs-app
   # Create temporary file with forbidden import
   echo "import { db } from '@/app/db'" > test-forbidden.ts
   npm run verify:no-app-db-imports
   # Should fail and show the forbidden import
   rm test-forbidden.ts
   ```

5. **Update CI script to fail build properly:**
   ```json
   // nextjs-app/package.json
   // Ensure ci script includes the verification:
   "ci": "npm run lint && npm run test && npm run verify:no-app-db-imports"
   ```

**Files to Modify:**
- `nextjs-app/package.json`

**Validation:**
- [ ] `npm run verify:no-app-db-imports` succeeds when no forbidden imports exist
- [ ] Script correctly detects `@/app/db` imports when they exist
- [ ] CI script includes the verification step
- [ ] Build fails if forbidden imports are found

**Dependencies:** Phase 7 completion

**Rollback:** Revert package.json script to original (broken) version

---

### Task 8.2: Add Server Action Tests

**Implementation Steps:**

1. **Create test for recordStudyRatingAction (happy path):**
   ```typescript
   // nextjs-app/__tests__/actions/study.test.ts
   import { describe, it, expect, beforeEach, vi } from 'vitest';
   import { recordStudyRatingAction } from '@/actions/study';
   import { db } from '@/db';
   
   // Mock Clerk auth
   vi.mock('@clerk/nextjs', () => ({
     auth: vi.fn(() => ({ userId: 'test-user-123' })),
   }));
   
   // Mock database with in-memory implementation for testing
   vi.mock('@/db', () => ({
     db: {
       query: {
         flashcards: {
           findFirst: vi.fn(),
         },
         users: {
           findFirst: vi.fn(),
         },
       },
       transaction: vi.fn(),
     },
   }));
   
   describe('recordStudyRatingAction', () => {
     beforeEach(() => {
       vi.clearAllMocks();
     });
   
     it('should successfully record a Good rating', async () => {
       // Mock flashcard data
       const mockCard = {
         id: 'card-123',
         userId: 'test-user-123',
         srsInterval: 1,
         srsEaseFactor: '2.5',
         srsDueDate: new Date('2024-01-01'),
         srsLevel: 2,
       };
       
       // Mock user data
       const mockUser = {
         id: 'test-user-123',
         dailyStudyCount: 5,
         weeklyStudyCount: 20,
         totalReviews: 100,
         totalCorrectReviews: 80,
         consecutiveStudyDays: 3,
         lastStudiedAt: new Date('2024-01-01'),
       };
       
       // Setup mocks
       vi.mocked(db.query.flashcards.findFirst).mockResolvedValue(mockCard);
       vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser);
       vi.mocked(db.transaction).mockImplementation(async (callback) => {
         return await callback({
           update: vi.fn().mockReturnValue({
             set: vi.fn().mockReturnValue({
               where: vi.fn().mockResolvedValue(undefined),
             }),
           }),
         });
       });
       
       const result = await recordStudyRatingAction('card-123', 'Good');
       
       expect(result.isSuccess).toBe(true);
       expect(result.message).toBe('Study rating recorded successfully');
       expect(db.transaction).toHaveBeenCalled();
     });
   
     it('should handle unauthorized access', async () => {
       // Override auth mock to return no user
       vi.mocked(require('@clerk/nextjs').auth).mockReturnValue({ userId: null });
       
       const result = await recordStudyRatingAction('card-123', 'Good');
       
       expect(result.isSuccess).toBe(false);
       expect(result.message).toBe('You must be logged in to record study ratings');
     });
   
     it('should handle invalid rating', async () => {
       const result = await recordStudyRatingAction('card-123', 'Invalid' as any);
       
       expect(result.isSuccess).toBe(false);
       expect(result.message).toBe('Invalid rating');
       expect(result.error?.rating).toContain('Must be one of Again, Hard, Good, Easy');
     });
   
     it('should handle non-existent flashcard', async () => {
       vi.mocked(db.query.flashcards.findFirst).mockResolvedValue(null);
       
       const result = await recordStudyRatingAction('non-existent', 'Good');
       
       expect(result.isSuccess).toBe(false);
       expect(result.message).toBe('Flashcard not found');
     });
   
     it('should handle ownership validation', async () => {
       const mockCard = {
         id: 'card-123',
         userId: 'different-user',
         srsInterval: 1,
         srsEaseFactor: '2.5',
         srsDueDate: new Date('2024-01-01'),
         srsLevel: 2,
       };
       
       vi.mocked(db.query.flashcards.findFirst).mockResolvedValue(mockCard);
       
       const result = await recordStudyRatingAction('card-123', 'Good');
       
       expect(result.isSuccess).toBe(false);
       expect(result.message).toBe('Unauthorized - You do not own this flashcard');
     });
   
     it('should correctly update stats for consecutive days', async () => {
       // Test streak calculation logic
       const yesterday = new Date();
       yesterday.setDate(yesterday.getDate() - 1);
       
       const mockCard = {
         id: 'card-123',
         userId: 'test-user-123',
         srsInterval: 1,
         srsEaseFactor: '2.5',
         srsDueDate: new Date('2024-01-01'),
         srsLevel: 2,
       };
       
       const mockUser = {
         id: 'test-user-123',
         dailyStudyCount: 5,
         weeklyStudyCount: 20,
         totalReviews: 100,
         totalCorrectReviews: 80,
         consecutiveStudyDays: 3,
         lastStudiedAt: yesterday, // Yesterday
       };
       
       vi.mocked(db.query.flashcards.findFirst).mockResolvedValue(mockCard);
       vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser);
       
       let capturedUserUpdate: any = null;
       vi.mocked(db.transaction).mockImplementation(async (callback) => {
         return await callback({
           update: vi.fn().mockImplementation((table) => ({
             set: vi.fn().mockImplementation((data) => {
               if (table === require('@/db/schema').users) {
                 capturedUserUpdate = data;
               }
               return {
                 where: vi.fn().mockResolvedValue(undefined),
               };
             }),
           })),
         });
       });
       
       await recordStudyRatingAction('card-123', 'Good');
       
       // Should increment streak since last study was yesterday
       expect(capturedUserUpdate.consecutiveStudyDays).toBe(4);
       expect(capturedUserUpdate.dailyStudyCount).toBe(1); // Reset and incremented
     });
   });
   ```

2. **Create test directory structure:**
   ```bash
   cd nextjs-app
   mkdir -p __tests__/actions
   mkdir -p __tests__/api/webhooks
   ```

3. **Run the new tests:**
   ```bash
   cd nextjs-app
   npm test -- __tests__/actions/study.test.ts
   ```

**Files to Create:**
- `nextjs-app/__tests__/actions/study.test.ts`

**Validation:**
- [ ] All test cases pass
- [ ] Happy path test validates successful rating recording
- [ ] Edge cases (unauthorized, invalid rating, etc.) are covered
- [ ] Streak calculation logic is tested
- [ ] Mocking setup works correctly

**Dependencies:** Task 8.1 (CI script fixed)

**Rollback:** Delete test file and revert any package.json test script changes

---

### Task 8.3: Add Webhook Handler Tests

**Implementation Steps:**

1. **Create comprehensive webhook tests:**
   ```typescript
   // nextjs-app/__tests__/api/webhooks/ai-service-status.test.ts
   import { describe, it, expect, beforeEach, vi } from 'vitest';
   import { POST } from '@/app/api/webhooks/ai-service-status/route';
   import { NextRequest } from 'next/server';
   import crypto from 'crypto';
   
   // Mock database
   vi.mock('@/db', () => ({
     db: {
       transaction: vi.fn(),
       query: {
         processingJobs: {
           findFirst: vi.fn(),
         },
       },
     },
   }));
   
   // Mock job state functions
   vi.mock('@/lib/job-state', () => ({
     isLegalTransition: vi.fn(),
     isTerminal: vi.fn(),
   }));
   
   describe('AI Service Status Webhook', () => {
     beforeEach(() => {
       vi.clearAllMocks();
       // Set up environment variables
       process.env.INTERNAL_API_KEY = 'test-api-key';
       process.env.INTERNAL_WEBHOOK_HMAC_SECRET = 'test-hmac-secret';
     });
   
     const createValidPayload = () => ({
       jobId: '123e4567-e89b-12d3-a456-426614174000',
       status: 'completed' as const,
       resultPayload: { cards: [{ front: 'Test', back: 'Answer' }] },
     });
   
     const createRequest = (
       payload: any,
       headers: Record<string, string> = {},
       skipAuth = false
     ) => {
       const body = JSON.stringify(payload);
       const timestamp = Date.now().toString();
       
       const requestHeaders = {
         'content-type': 'application/json',
         ...(!skipAuth && { 'x-internal-api-key': 'test-api-key' }),
         ...headers,
       };
       
       // Add HMAC signature if secret is configured
       if (process.env.INTERNAL_WEBHOOK_HMAC_SECRET && !skipAuth) {
         const signature = 'sha256=' + crypto
           .createHmac('sha256', process.env.INTERNAL_WEBHOOK_HMAC_SECRET)
           .update(`${timestamp}.${body}`)
           .digest('hex');
         
         requestHeaders['x-webhook-timestamp'] = timestamp;
         requestHeaders['x-webhook-signature'] = signature;
       }
       
       return new NextRequest('http://localhost:3000/api/webhooks/ai-service-status', {
         method: 'POST',
         headers: requestHeaders,
         body,
       });
     };
   
     it('should successfully process valid webhook with correct signature', async () => {
       const payload = createValidPayload();
       const request = createRequest(payload);
       
       // Mock successful database operations
       const mockJob = { status: 'processing' };
       vi.mocked(require('@/db').db.query.processingJobs.findFirst).mockResolvedValue(mockJob);
       vi.mocked(require('@/lib/job-state').isTerminal).mockReturnValue(false);
       vi.mocked(require('@/lib/job-state').isLegalTransition).mockReturnValue(true);
       vi.mocked(require('@/db').db.transaction).mockImplementation(async (callback) => {
         return await callback({
           query: {
             processingJobs: {
               findFirst: vi.fn().mockResolvedValue(mockJob),
             },
           },
           update: vi.fn().mockReturnValue({
             set: vi.fn().mockReturnValue({
               where: vi.fn().mockReturnValue({
                 returning: vi.fn().mockResolvedValue([{ id: payload.jobId }]),
               }),
             }),
           }),
         });
       });
       
       const response = await POST(request);
       const result = await response.json();
       
       expect(response.status).toBe(200);
       expect(result.message).toBe('Status updated successfully');
     });
   
     it('should reject requests without API key', async () => {
       const payload = createValidPayload();
       const request = createRequest(payload, {}, true); // skipAuth = true
       
       const response = await POST(request);
       const result = await response.json();
       
       expect(response.status).toBe(401);
       expect(result.errorCode).toBe('INVALID_API_KEY');
     });
   
     it('should reject requests with invalid API key', async () => {
       const payload = createValidPayload();
       const request = createRequest(payload, { 'x-internal-api-key': 'wrong-key' });
       
       const response = await POST(request);
       const result = await response.json();
       
       expect(response.status).toBe(401);
       expect(result.errorCode).toBe('INVALID_API_KEY');
     });
   
     it('should reject requests with invalid HMAC signature', async () => {
       const payload = createValidPayload();
       const request = createRequest(payload, {
         'x-webhook-timestamp': Date.now().toString(),
         'x-webhook-signature': 'sha256=invalid-signature',
       });
       
       const response = await POST(request);
       const result = await response.json();
       
       expect(response.status).toBe(401);
       expect(result.errorCode).toBe('INVALID_SIGNATURE');
     });
   
     it('should reject requests with expired timestamp', async () => {
       const payload = createValidPayload();
       const oldTimestamp = (Date.now() - 10 * 60 * 1000).toString(); // 10 minutes ago
       const body = JSON.stringify(payload);
       const signature = 'sha256=' + crypto
         .createHmac('sha256', 'test-hmac-secret')
         .update(`${oldTimestamp}.${body}`)
         .digest('hex');
       
       const request = createRequest(payload, {
         'x-webhook-timestamp': oldTimestamp,
         'x-webhook-signature': signature,
       });
       
       const response = await POST(request);
       const result = await response.json();
       
       expect(response.status).toBe(401);
       expect(result.errorCode).toBe('TIMESTAMP_EXPIRED');
     });
   
     it('should handle invalid JSON payload', async () => {
       const request = new NextRequest('http://localhost:3000/api/webhooks/ai-service-status', {
         method: 'POST',
         headers: {
           'content-type': 'application/json',
           'x-internal-api-key': 'test-api-key',
         },
         body: 'invalid json',
       });
       
       const response = await POST(request);
       const result = await response.json();
       
       expect(response.status).toBe(500);
       expect(result.errorCode).toBe('INTERNAL_ERROR');
     });
   
     it('should handle invalid payload schema', async () => {
       const invalidPayload = {
         jobId: 'not-a-uuid',
         status: 'invalid-status',
       };
       const request = createRequest(invalidPayload);
       
       const response = await POST(request);
       const result = await response.json();
       
       expect(response.status).toBe(400);
       expect(result.errorCode).toBe('INVALID_PAYLOAD');
       expect(result.details).toBeDefined();
     });
   
     it('should handle job not found', async () => {
       const payload = createValidPayload();
       const request = createRequest(payload);
       
       vi.mocked(require('@/db').db.transaction).mockImplementation(async (callback) => {
         return await callback({
           query: {
             processingJobs: {
               findFirst: vi.fn().mockResolvedValue(null),
             },
           },
         });
       });
       
       const response = await POST(request);
       const result = await response.json();
       
       expect(response.status).toBe(404);
       expect(result.errorCode).toBe('JOB_NOT_FOUND');
     });
   
     it('should handle already completed jobs idempotently', async () => {
       const payload = createValidPayload();
       const request = createRequest(payload);
       
       const mockJob = { status: 'completed' };
       vi.mocked(require('@/lib/job-state').isTerminal).mockReturnValue(true);
       
       vi.mocked(require('@/db').db.transaction).mockImplementation(async (callback) => {
         return await callback({
           query: {
             processingJobs: {
               findFirst: vi.fn().mockResolvedValue(mockJob),
             },
           },
         });
       });
       
       const response = await POST(request);
       const result = await response.json();
       
       expect(response.status).toBe(200);
       expect(result.message).toBe('Already finalized');
       expect(result.status).toBe('completed');
     });
   
     it('should handle illegal state transitions', async () => {
       const payload = createValidPayload();
       const request = createRequest(payload);
       
       const mockJob = { status: 'completed' };
       vi.mocked(require('@/lib/job-state').isTerminal).mockReturnValue(false);
       vi.mocked(require('@/lib/job-state').isLegalTransition).mockReturnValue(false);
       
       vi.mocked(require('@/db').db.transaction).mockImplementation(async (callback) => {
         return await callback({
           query: {
             processingJobs: {
               findFirst: vi.fn().mockResolvedValue(mockJob),
             },
           },
         });
       });
       
       const response = await POST(request);
       const result = await response.json();
       
       expect(response.status).toBe(409);
       expect(result.errorCode).toBe('ILLEGAL_TRANSITION');
       expect(result.from).toBe('completed');
       expect(result.to).toBe('completed');
     });
   });
   ```

2. **Create tests for simulateWebhookAction:**
   ```typescript
   // nextjs-app/__tests__/actions/simulate-webhook.test.ts
   import { describe, it, expect, beforeEach, vi } from 'vitest';
   import { simulateWebhookAction } from '@/actions/ai/simulate-webhook';
   
   // Mock Clerk auth
   vi.mock('@clerk/nextjs', () => ({
     auth: vi.fn(() => ({ userId: 'test-user-123' })),
   }));
   
   // Mock fetch
   global.fetch = vi.fn();
   
   describe('simulateWebhookAction', () => {
     beforeEach(() => {
       vi.clearAllMocks();
       process.env.NODE_ENV = 'development';
       process.env.INTERNAL_API_KEY = 'test-api-key';
       process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
       delete process.env.INTERNAL_WEBHOOK_HMAC_SECRET;
     });
   
     it('should successfully simulate webhook in development', async () => {
       vi.mocked(fetch).mockResolvedValue(
         new Response(JSON.stringify({ message: 'OK' }), { status: 200 })
       );
       
       const result = await simulateWebhookAction('test-job-id');
       
       expect(result.ok).toBe(true);
       expect(result.message).toBe('OK');
       expect(fetch).toHaveBeenCalledWith(
         'http://localhost:3000/api/webhooks/ai-service-status',
         expect.objectContaining({
           method: 'POST',
           headers: expect.objectContaining({
             'Content-Type': 'application/json',
             'x-internal-api-key': 'test-api-key',
           }),
         })
       );
     });
   
     it('should include HMAC signature when secret is configured', async () => {
       process.env.INTERNAL_WEBHOOK_HMAC_SECRET = 'test-secret';
       
       vi.mocked(fetch).mockResolvedValue(
         new Response(JSON.stringify({ message: 'OK' }), { status: 200 })
       );
       
       await simulateWebhookAction('test-job-id');
       
       const fetchCall = vi.mocked(fetch).mock.calls[0];
       const headers = fetchCall[1]?.headers as Record<string, string>;
       
       expect(headers['x-webhook-timestamp']).toBeDefined();
       expect(headers['x-webhook-signature']).toMatch(/^sha256=/);
     });
   
     it('should be disabled in production', async () => {
       process.env.NODE_ENV = 'production';
       
       const result = await simulateWebhookAction('test-job-id');
       
       expect(result.ok).toBe(false);
       expect(result.message).toBe('Disabled in production');
       expect(fetch).not.toHaveBeenCalled();
     });
   
     it('should handle unauthorized users', async () => {
       vi.mocked(require('@clerk/nextjs').auth).mockReturnValue({ userId: null });
       
       const result = await simulateWebhookAction('test-job-id');
       
       expect(result.ok).toBe(false);
       expect(result.message).toBe('Unauthorized');
     });
   
     it('should handle missing API key', async () => {
       delete process.env.INTERNAL_API_KEY;
       
       const result = await simulateWebhookAction('test-job-id');
       
       expect(result.ok).toBe(false);
       expect(result.message).toBe('Missing INTERNAL_API_KEY');
     });
   
     it('should handle webhook failures', async () => {
       vi.mocked(fetch).mockResolvedValue(
         new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 })
       );
       
       const result = await simulateWebhookAction('test-job-id');
       
       expect(result.ok).toBe(false);
       expect(result.message).toMatch(/Webhook failed: 400/);
     });
   });
   ```

3. **Run webhook tests:**
   ```bash
   cd nextjs-app
   npm test -- __tests__/api/webhooks/ai-service-status.test.ts
   npm test -- __tests__/actions/simulate-webhook.test.ts
   ```

**Files to Create:**
- `nextjs-app/__tests__/api/webhooks/ai-service-status.test.ts`
- `nextjs-app/__tests__/actions/simulate-webhook.test.ts`

**Validation:**
- [ ] Valid webhook requests are processed successfully
- [ ] Invalid signatures are rejected
- [ ] Expired timestamps are rejected
- [ ] Invalid API keys are rejected
- [ ] Malformed payloads are handled properly
- [ ] Job state transitions are validated
- [ ] simulateWebhookAction works in development and is disabled in production

**Dependencies:** Task 8.2 (Server action tests)

**Rollback:** Delete webhook test files

---

### Task 8.4: Install and Configure Playwright for E2E Tests

**Implementation Steps:**

1. **Install Playwright:**
   ```bash
   cd nextjs-app
   npm install --save-dev @playwright/test
   npx playwright install
   ```

2. **Create Playwright configuration:**
   ```typescript
   // nextjs-app/playwright.config.ts
   import { defineConfig, devices } from '@playwright/test';
   
   /**
    * @see https://playwright.dev/docs/test-configuration.
    */
   export default defineConfig({
     testDir: './e2e',
     /* Run tests in files in parallel */
     fullyParallel: true,
     /* Fail the build on CI if you accidentally left test.only in the source code. */
     forbidOnly: !!process.env.CI,
     /* Retry on CI only */
     retries: process.env.CI ? 2 : 0,
     /* Opt out of parallel tests on CI. */
     workers: process.env.CI ? 1 : undefined,
     /* Reporter to use. See https://playwright.dev/docs/test-reporters */
     reporter: 'html',
     /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
     use: {
       /* Base URL to use in actions like `await page.goto('/')`. */
       baseURL: 'http://localhost:3000',
       /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
       trace: 'on-first-retry',
     },
   
     /* Configure projects for major browsers */
     projects: [
       {
         name: 'chromium',
         use: { ...devices['Desktop Chrome'] },
       },
   
       {
         name: 'firefox',
         use: { ...devices['Desktop Firefox'] },
       },
   
       {
         name: 'webkit',
         use: { ...devices['Desktop Safari'] },
       },
     ],
   
     /* Run your local dev server before starting the tests */
     webServer: {
       command: 'npm run dev',
       port: 3000,
       reuseExistingServer: !process.env.CI,
     },
   });
   ```

3. **Add Playwright scripts to package.json:**
   ```json
   {
     "scripts": {
       "test:e2e": "playwright test",
       "test:e2e:headed": "playwright test --headed",
       "test:e2e:ui": "playwright test --ui"
     }
   }
   ```

4. **Create E2E test directory:**
   ```bash
   cd nextjs-app
   mkdir -p e2e
   ```

**Files to Create/Modify:**
- `nextjs-app/playwright.config.ts`
- `nextjs-app/package.json` (add scripts)
- `nextjs-app/e2e/` directory

**Validation:**
- [ ] Playwright installed successfully
- [ ] Configuration file created
- [ ] Test scripts added to package.json
- [ ] E2E directory structure created

**Dependencies:** Task 8.3 (Webhook tests)

**Rollback:** `npm uninstall @playwright/test && rm playwright.config.ts`

---

### Task 8.5: Implement E2E Tests for Core User Flows

**Implementation Steps:**

1. **Create sign-in flow test (with dev stub):**
   ```typescript
   // nextjs-app/e2e/auth.spec.ts
   import { test, expect } from '@playwright/test';
   
   test.describe('Authentication Flow', () => {
     test('should handle sign-in flow', async ({ page }) => {
       await page.goto('/');
       
       // Check if user is already signed in (development scenario)
       const isSignedIn = await page.locator('[data-testid="user-menu"]').isVisible().catch(() => false);
       
       if (!isSignedIn) {
         // Look for sign-in button/link
         const signInButton = page.locator('text=Sign In').or(page.locator('text=Sign in')).first();
         await signInButton.click();
         
         // In development, we might redirect to Clerk or have a dev stub
         // Wait for either Clerk sign-in form or development stub
         await page.waitForLoadState('networkidle');
         
         // Check for Clerk sign-in form or dev stub
         const hasClerkForm = await page.locator('#clerk-sign-in').isVisible().catch(() => false);
         const hasDevStub = await page.locator('[data-testid="dev-auth-stub"]').isVisible().catch(() => false);
         
         if (hasDevStub) {
           // Development stub - click sign in
           await page.locator('[data-testid="dev-sign-in"]').click();
         } else if (hasClerkForm) {
           // This is a real Clerk form - skip in E2E tests or use test credentials
           console.log('Clerk form detected - skipping real auth in E2E test');
           return;
         } else {
           // Look for any form with email/password fields
           const emailField = await page.locator('input[type="email"]').or(page.locator('input[name="email"]')).first();
           const passwordField = await page.locator('input[type="password"]').or(page.locator('input[name="password"]')).first();
           
           if (await emailField.isVisible() && await passwordField.isVisible()) {
             // Fill test credentials if we have test environment
             if (process.env.TEST_USER_EMAIL && process.env.TEST_USER_PASSWORD) {
               await emailField.fill(process.env.TEST_USER_EMAIL);
               await passwordField.fill(process.env.TEST_USER_PASSWORD);
               await page.locator('button[type="submit"]').or(page.locator('text=Sign in')).first().click();
             }
           }
         }
         
         // Wait for successful sign-in
         await expect(page.locator('[data-testid="user-menu"]')).toBeVisible({ timeout: 10000 });
       }
       
       // Verify signed-in state
       expect(await page.locator('[data-testid="user-menu"]').isVisible()).toBe(true);
     });
   });
   ```

2. **Create flashcard creation and webhook test:**
   ```typescript
   // nextjs-app/e2e/flashcard-creation.spec.ts
   import { test, expect } from '@playwright/test';
   
   test.describe('Flashcard Creation Flow', () => {
     test.beforeEach(async ({ page }) => {
       // Ensure user is signed in (reuse auth logic or assume signed in)
       await page.goto('/');
       // Add authentication check here if needed
     });
   
     test('should create flashcards from text and receive webhook', async ({ page }) => {
       // Navigate to create page
       await page.goto('/create');
       
       // Fill in text content for AI processing
       const textInput = page.locator('textarea[name="content"]').or(page.locator('[data-testid="content-input"]'));
       await expect(textInput).toBeVisible();
       
       const testContent = `
         Artificial Intelligence (AI) is the simulation of human intelligence in machines.
         Machine Learning is a subset of AI that enables computers to learn without explicit programming.
         Deep Learning uses neural networks with multiple layers to model complex patterns.
       `;
       
       await textInput.fill(testContent);
       
       // Submit for AI processing
       const submitButton = page.locator('button[type="submit"]').or(page.locator('text=Generate Cards')).first();
       await submitButton.click();
       
       // Should be redirected to job status page
       await expect(page).toHaveURL(/\/create\/[a-f0-9-]+/);
       
       // Wait for processing status
       await expect(page.locator('text=Processing')).toBeVisible({ timeout: 5000 });
       
       // Simulate webhook delivery (development only)
       if (process.env.NODE_ENV !== 'production') {
         // Extract job ID from URL
         const url = page.url();
         const jobIdMatch = url.match(/\/create\/([a-f0-9-]+)/);
         expect(jobIdMatch).toBeTruthy();
         const jobId = jobIdMatch![1];
         
         // Call simulate webhook action via direct page interaction
         // This assumes there's a "Simulate Webhook" button in development
         const simulateButton = await page.locator('[data-testid="simulate-webhook"]').isVisible().catch(() => false);
         
         if (simulateButton) {
           await page.locator('[data-testid="simulate-webhook"]').click();
         } else {
           // Alternative: Make direct API call to simulate webhook
           await page.evaluate(async (jobId) => {
             const response = await fetch('/api/dev/simulate-webhook', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ jobId }),
             });
             return response.ok;
           }, jobId);
         }
         
         // Wait for completion status
         await expect(page.locator('text=Completed')).toBeVisible({ timeout: 10000 });
         
         // Should see generated flashcards
         await expect(page.locator('[data-testid="generated-cards"]')).toBeVisible();
         const cardElements = await page.locator('[data-testid="flashcard-preview"]').count();
         expect(cardElements).toBeGreaterThan(0);
       }
     });
   });
   ```

3. **Create approve and save flow test:**
   ```typescript
   // nextjs-app/e2e/approve-and-save.spec.ts
   import { test, expect } from '@playwright/test';
   
   test.describe('Approve and Save Flow', () => {
     test.beforeEach(async ({ page }) => {
       await page.goto('/');
       // Ensure user is authenticated
     });
   
     test('should approve and save flashcards without N+1 queries', async ({ page }) => {
       // Start from a job status page with completed flashcards
       // This test assumes we have a way to create test data or use existing completed job
       
       // Navigate to create page and create test flashcards
       await page.goto('/create');
       
       // Fill minimal content
       const textInput = page.locator('textarea[name="content"]').or(page.locator('[data-testid="content-input"]'));
       await textInput.fill('Test content for flashcard generation.');
       
       const submitButton = page.locator('button[type="submit"]').first();
       await submitButton.click();
       
       // Wait for job page
       await page.waitForURL(/\/create\/[a-f0-9-]+/);
       
       // Simulate completion (development)
       if (process.env.NODE_ENV !== 'production') {
         const simulateButton = page.locator('[data-testid="simulate-webhook"]');
         if (await simulateButton.isVisible().catch(() => false)) {
           await simulateButton.click();
         }
         
         await expect(page.locator('text=Completed')).toBeVisible({ timeout: 10000 });
       }
       
       // Approve and save cards
       const approveAllButton = page.locator('text=Approve All').or(page.locator('[data-testid="approve-all"]'));
       if (await approveAllButton.isVisible()) {
         await approveAllButton.click();
       } else {
         // Select individual cards
         const checkboxes = page.locator('[data-testid="card-checkbox"]');
         const count = await checkboxes.count();
         for (let i = 0; i < count; i++) {
           await checkboxes.nth(i).check();
         }
       }
       
       const saveToDeckButton = page.locator('text=Save to Deck').or(page.locator('[data-testid="save-to-deck"]'));
       
       // Monitor network requests to detect N+1 queries
       const requests: string[] = [];
       page.on('request', (request) => {
         if (request.url().includes('/api/')) {
           requests.push(request.url());
         }
       });
       
       await saveToDeckButton.click();
       
       // Should redirect to decks page
       await expect(page).toHaveURL('/decks');
       
       // Verify the deck was created/updated
       await expect(page.locator('[data-testid="deck-card"]')).toBeVisible();
       
       // Check that we didn't make excessive API calls (no N+1)
       const apiCalls = requests.filter(url => !url.includes('_next') && !url.includes('static'));
       console.log('API calls made:', apiCalls);
       expect(apiCalls.length).toBeLessThan(5); // Reasonable limit for bulk operations
     });
   });
   ```

4. **Create study flow test:**
   ```typescript
   // nextjs-app/e2e/study-flow.spec.ts
   import { test, expect } from '@playwright/test';
   
   test.describe('Study Flow', () => {
     test.beforeEach(async ({ page }) => {
       await page.goto('/');
       // Ensure authentication
     });
   
     test('should study cards and update stats', async ({ page }) => {
       // Navigate to decks page
       await page.goto('/decks');
       
       // Find a deck to study (or create one if needed)
       const deckCard = page.locator('[data-testid="deck-card"]').first();
       
       if (!(await deckCard.isVisible())) {
         // No decks available - skip test or create test data
         console.log('No decks available for study test - skipping');
         return;
       }
       
       // Get initial stats
       await page.goto('/dashboard'); // Or wherever stats are shown
       const initialStats = await page.evaluate(() => {
         const dailyElement = document.querySelector('[data-testid="daily-count"]');
         const accuracyElement = document.querySelector('[data-testid="accuracy"]');
         const streakElement = document.querySelector('[data-testid="streak"]');
         
         return {
           daily: dailyElement?.textContent || '0',
           accuracy: accuracyElement?.textContent || '0%',
           streak: streakElement?.textContent || '0',
         };
       });
       
       // Go back to decks and start studying
       await page.goto('/decks');
       await deckCard.click();
       
       // Should be on study page
       await expect(page).toHaveURL(/\/study\/[a-f0-9-]+/);
       
       // Study at least one card
       const flashcardElement = page.locator('[data-testid="flashcard"]');
       await expect(flashcardElement).toBeVisible();
       
       // Show answer
       const showAnswerButton = page.locator('text=Show Answer').or(page.locator('[data-testid="show-answer"]'));
       await showAnswerButton.click();
       
       // Rate the card as "Good"
       const goodButton = page.locator('text=Good').or(page.locator('[data-testid="rating-good"]'));
       await expect(goodButton).toBeVisible();
       await goodButton.click();
       
       // Should proceed to next card or show completion
       // Wait for either next card or completion message
       await Promise.race([
         expect(page.locator('text=Study session complete')).toBeVisible({ timeout: 5000 }),
         expect(flashcardElement).toBeVisible({ timeout: 5000 })
       ]);
       
       // Go back to dashboard to check updated stats
       await page.goto('/dashboard');
       
       const updatedStats = await page.evaluate(() => {
         const dailyElement = document.querySelector('[data-testid="daily-count"]');
         const accuracyElement = document.querySelector('[data-testid="accuracy"]');
         
         return {
           daily: dailyElement?.textContent || '0',
           accuracy: accuracyElement?.textContent || '0%',
         };
       });
       
       // Verify stats were updated
       expect(parseInt(updatedStats.daily)).toBeGreaterThanOrEqual(parseInt(initialStats.daily));
       
       // If this was the first correct answer, accuracy should be > 0
       if (initialStats.accuracy === '0%') {
         expect(updatedStats.accuracy).not.toBe('0%');
       }
     });
   
     test('should support keyboard shortcuts during study', async ({ page }) => {
       await page.goto('/decks');
       
       const deckCard = page.locator('[data-testid="deck-card"]').first();
       if (!(await deckCard.isVisible())) {
         console.log('No decks available for keyboard test - skipping');
         return;
       }
       
       await deckCard.click();
       await expect(page).toHaveURL(/\/study\/[a-f0-9-]+/);
       
       const flashcardElement = page.locator('[data-testid="flashcard"]');
       await expect(flashcardElement).toBeVisible();
       
       // Test spacebar to show answer
       await page.keyboard.press('Space');
       await expect(page.locator('[data-testid="rating-buttons"]')).toBeVisible();
       
       // Test number keys for rating
       await page.keyboard.press('3'); // Good rating
       
       // Should proceed to next card or completion
       await page.waitForTimeout(1000); // Brief wait for transition
     });
   });
   ```

5. **Add test data setup utilities:**
   ```typescript
   // nextjs-app/e2e/test-utils.ts
   export async function ensureAuthenticated(page: any) {
     const isSignedIn = await page.locator('[data-testid="user-menu"]').isVisible().catch(() => false);
     
     if (!isSignedIn) {
       // Try to sign in or create dev session
       await page.goto('/');
       
       const devSignIn = page.locator('[data-testid="dev-sign-in"]');
       if (await devSignIn.isVisible()) {
         await devSignIn.click();
         await page.waitForLoadState('networkidle');
       }
     }
   }
   
   export async function createTestDeck(page: any, deckName = 'Test Deck') {
     await page.goto('/create');
     
     const textInput = page.locator('textarea[name="content"]');
     await textInput.fill(`Create flashcards for ${deckName}: Test question? Test answer.`);
     
     const submitButton = page.locator('button[type="submit"]').first();
     await submitButton.click();
     
     await page.waitForURL(/\/create\/[a-f0-9-]+/);
     
     // Simulate webhook if available
     const simulateButton = page.locator('[data-testid="simulate-webhook"]');
     if (await simulateButton.isVisible()) {
       await simulateButton.click();
       await expect(page.locator('text=Completed')).toBeVisible({ timeout: 10000 });
       
       // Approve and save
       const approveButton = page.locator('text=Approve All');
       if (await approveButton.isVisible()) {
         await approveButton.click();
       }
       
       const saveButton = page.locator('text=Save to Deck');
       await saveButton.click();
     }
   }
   ```

6. **Add E2E scripts to package.json:**
   ```json
   {
     "scripts": {
       "test:e2e": "playwright test",
       "test:e2e:headed": "playwright test --headed",
       "test:e2e:debug": "playwright test --debug",
       "test:all": "npm run test && npm run test:e2e"
     }
   }
   ```

7. **Run E2E tests:**
   ```bash
   cd nextjs-app
   npm run test:e2e
   ```

**Files to Create:**
- `nextjs-app/e2e/auth.spec.ts`
- `nextjs-app/e2e/flashcard-creation.spec.ts`
- `nextjs-app/e2e/approve-and-save.spec.ts`
- `nextjs-app/e2e/study-flow.spec.ts`
- `nextjs-app/e2e/test-utils.ts`

**Validation:**
- [ ] Authentication flow test passes (with dev stub handling)
- [ ] Flashcard creation and webhook test passes
- [ ] Approve and save flow completes without N+1 queries
- [ ] Study flow updates statistics correctly
- [ ] Keyboard shortcuts work during study session
- [ ] All tests run in CI environment

**Dependencies:** Task 8.4 (Playwright configuration)

**Rollback:** Delete `e2e/` directory and remove scripts from package.json

---

### Task 8.6: Enhanced CI Script Integration

**Implementation Steps:**

1. **Update package.json with comprehensive CI:**
   ```json
   {
     "scripts": {
       "ci": "npm run lint && npm run test && npm run verify:no-app-db-imports && npm run build",
       "ci:full": "npm run ci && npm run test:e2e",
       "test:coverage": "vitest run --coverage",
       "test:watch": "vitest",
       "test:unit": "vitest run --reporter=verbose",
       "test:integration": "vitest run --config vitest.integration.config.ts",
       "prebuild": "npm run verify:no-app-db-imports"
     }
   }
   ```

2. **Create separate integration test config:**
   ```typescript
   // nextjs-app/vitest.integration.config.ts
   import { defineConfig } from 'vitest/config';
   import { resolve } from 'path';
   
   export default defineConfig({
     test: {
       environment: 'node',
       include: ['__tests__/**/*.integration.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
       testTimeout: 30000, // Longer timeout for integration tests
       setupFiles: ['__tests__/setup/integration-setup.ts'],
     },
     resolve: {
       alias: {
         '@': resolve(__dirname, './'),
       },
     },
   });
   ```

3. **Create integration test setup:**
   ```typescript
   // nextjs-app/__tests__/setup/integration-setup.ts
   import { beforeAll, afterAll } from 'vitest';
   
   // Global setup for integration tests
   beforeAll(async () => {
     // Set test environment variables
     process.env.NODE_ENV = 'test';
     process.env.INTERNAL_API_KEY = 'test-api-key';
     process.env.INTERNAL_WEBHOOK_HMAC_SECRET = 'test-hmac-secret';
   });
   
   afterAll(async () => {
     // Cleanup after all tests
   });
   ```

4. **Enhance the forbidden import script with more patterns:**
   ```json
   {
     "scripts": {
       "verify:no-app-db-imports": "node scripts/check-forbidden-imports.js"
     }
   }
   ```

5. **Create dedicated script file:**
   ```javascript
   // nextjs-app/scripts/check-forbidden-imports.js
   const { spawnSync } = require('node:child_process');
   const path = require('node:path');
   
   // Forbidden import patterns
   const FORBIDDEN_PATTERNS = [
     '@/app/db',           // Direct app/db imports
     '../app/db',          // Relative app/db imports
     './app/db',           // Relative app/db imports from root
   ];
   
   // File extensions to check
   const EXTENSIONS = ['ts', 'tsx', 'js', 'jsx'];
   
   function checkPattern(pattern) {
     console.log(`Checking for forbidden pattern: ${pattern}`);
     
     const result = spawnSync('rg', [
       '-n',                    // Show line numbers
       '--type-add', `src:*.{${EXTENSIONS.join(',')}}`,
       '--type', 'src',
       pattern,
       '.',
       '--exclude-dir', 'node_modules',
       '--exclude-dir', '.next',
       '--exclude-dir', 'dist',
     ], {
       stdio: 'pipe',
       encoding: 'utf8'
     });
     
     if (result.status === 0) {
       console.error(`Error: Found forbidden import pattern "${pattern}":`);
       console.error(result.stdout);
       return false;
     } else if (result.status === 1) {
       // No matches found - this is good
       console.log(`✓ No forbidden imports found for pattern: ${pattern}`);
       return true;
     } else {
       // ripgrep error
       console.error(`Error running ripgrep for pattern "${pattern}":`, result.stderr);
       return false;
     }
   }
   
   function main() {
     console.log('Checking for forbidden import patterns...\n');
     
     let allPassed = true;
     
     for (const pattern of FORBIDDEN_PATTERNS) {
       if (!checkPattern(pattern)) {
         allPassed = false;
       }
     }
     
     console.log('\n' + '='.repeat(50));
     
     if (allPassed) {
       console.log('✅ All import pattern checks passed!');
       process.exit(0);
     } else {
       console.error('❌ Found forbidden import patterns. Please fix the issues above.');
       console.error('\nForbidden patterns:');
       FORBIDDEN_PATTERNS.forEach(pattern => {
         console.error(`  - ${pattern}`);
       });
       console.error('\nUse "@/db" instead of "@/app/db" for database imports.');
       process.exit(1);
     }
   }
   
   main();
   ```

6. **Test the enhanced CI:**
   ```bash
   cd nextjs-app
   npm run ci
   ```

7. **Create CI documentation:**
   ```markdown
   <!-- nextjs-app/docs/ci-setup.md -->
   # CI Setup and Testing
   
   ## Available Scripts
   
   - `npm run ci` - Basic CI checks (lint, test, forbidden imports, build)
   - `npm run ci:full` - Full CI including E2E tests
   - `npm run test:unit` - Unit tests only
   - `npm run test:e2e` - E2E tests only
   - `npm run verify:no-app-db-imports` - Check for forbidden imports
   
   ## Forbidden Import Patterns
   
   The following import patterns are forbidden and will cause CI to fail:
   
   - `@/app/db` - Use `@/db` instead
   - `../app/db` - Use `@/db` instead
   - `./app/db` - Use `@/db` instead
   
   ## Test Structure
   
   - `__tests__/actions/` - Server action tests
   - `__tests__/api/` - API route tests
   - `__tests__/setup/` - Test configuration
   - `e2e/` - End-to-end tests with Playwright
   
   ## Running Tests in Development
   
   ```bash
   # Watch mode for unit tests
   npm run test:watch
   
   # Run E2E tests with browser UI
   npm run test:e2e:headed
   
   # Debug specific E2E test
   npx playwright test --debug e2e/auth.spec.ts
   ```
   
   ## CI Pipeline Stages
   
   1. **Lint** - ESLint checks
   2. **Unit Tests** - Vitest unit tests
   3. **Import Validation** - Check for forbidden patterns
   4. **Build** - Next.js build verification
   5. **E2E Tests** - Full user flow testing (optional in CI)
   ```

**Files to Create/Modify:**
- `nextjs-app/scripts/check-forbidden-imports.js`
- `nextjs-app/vitest.integration.config.ts`
- `nextjs-app/__tests__/setup/integration-setup.ts`
- `nextjs-app/docs/ci-setup.md`
- `nextjs-app/package.json` (update scripts)

**Validation:**
- [ ] Enhanced forbidden import script catches all patterns
- [ ] CI script runs all checks in correct order
- [ ] Build fails if any check fails
- [ ] Integration test setup works correctly
- [ ] Documentation covers all CI aspects

**Dependencies:** Task 8.5 (E2E tests implemented)

**Rollback:** Revert package.json changes and remove script files

---

### Task 8.7: Production CI Pipeline Configuration

**Implementation Steps:**

1. **Create GitHub Actions workflow (if using GitHub):**
   ```yaml
   # .github/workflows/ci.yml
   name: CI
   
   on:
     push:
       branches: [ main, develop ]
       paths:
         - 'nextjs-app/**'
     pull_request:
       branches: [ main, develop ]
       paths:
         - 'nextjs-app/**'
   
   jobs:
     test:
       runs-on: ubuntu-latest
       
       defaults:
         run:
           working-directory: nextjs-app
       
       services:
         postgres:
           image: postgres:15
           env:
             POSTGRES_PASSWORD: postgres
             POSTGRES_USER: postgres
             POSTGRES_DB: memoria_test
           options: >-
             --health-cmd pg_isready
             --health-interval 10s
             --health-timeout 5s
             --health-retries 5
           ports:
             - 5432:5432
       
       steps:
       - uses: actions/checkout@v4
       
       - name: Setup Node.js
         uses: actions/setup-node@v4
         with:
           node-version: '18'
           cache: 'npm'
           cache-dependency-path: 'nextjs-app/package-lock.json'
       
       - name: Install dependencies
         run: npm ci
       
       - name: Setup environment
         run: |
           cp .env.example .env.local
           echo "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/memoria_test" >> .env.local
           echo "INTERNAL_API_KEY=test-api-key" >> .env.local
           echo "INTERNAL_WEBHOOK_HMAC_SECRET=test-hmac-secret" >> .env.local
       
       - name: Run database migrations
         run: npm run db:migrate
       
       - name: Run CI checks
         run: npm run ci
         env:
           NODE_ENV: test
       
       - name: Upload test results
         uses: actions/upload-artifact@v4
         if: failure()
         with:
           name: test-results
           path: nextjs-app/test-results/
   
     e2e:
       runs-on: ubuntu-latest
       needs: test
       
       defaults:
         run:
           working-directory: nextjs-app
       
       services:
         postgres:
           image: postgres:15
           env:
             POSTGRES_PASSWORD: postgres
             POSTGRES_USER: postgres
             POSTGRES_DB: memoria_test
           options: >-
             --health-cmd pg_isready
             --health-interval 10s
             --health-timeout 5s
             --health-retries 5
           ports:
             - 5432:5432
       
       steps:
       - uses: actions/checkout@v4
       
       - name: Setup Node.js
         uses: actions/setup-node@v4
         with:
           node-version: '18'
           cache: 'npm'
           cache-dependency-path: 'nextjs-app/package-lock.json'
       
       - name: Install dependencies
         run: npm ci
       
       - name: Install Playwright Browsers
         run: npx playwright install --with-deps
       
       - name: Setup environment
         run: |
           cp .env.example .env.local
           echo "DATABASE_URL=postgresql://postgres:postgres@localhost:5432/memoria_test" >> .env.local
           echo "INTERNAL_API_KEY=test-api-key" >> .env.local
           echo "INTERNAL_WEBHOOK_HMAC_SECRET=test-hmac-secret" >> .env.local
           echo "NODE_ENV=test" >> .env.local
       
       - name: Run database migrations
         run: npm run db:migrate
       
       - name: Run Playwright tests
         run: npm run test:e2e
       
       - name: Upload Playwright Report
         uses: actions/upload-artifact@v4
         if: always()
         with:
           name: playwright-report
           path: nextjs-app/playwright-report/
           retention-days: 30
   ```

2. **Create production validation checklist:**
   ```markdown
   <!-- docs/phase8_validation_checklist.md -->
   # Phase 8 Validation Checklist - CI Hardening & Tests
   
   ## Forbidden Import Script
   - [ ] Script correctly searches current directory (`.`) instead of `nextjs-app`
   - [ ] Detects `@/app/db` imports when they exist
   - [ ] Returns exit code 0 when no forbidden imports found
   - [ ] Returns exit code 1 when forbidden imports found
   - [ ] CI fails build when forbidden imports are present
   - [ ] Script checks all relevant file extensions (ts, tsx, js, jsx)
   
   ## Server Action Tests
   - [ ] `recordStudyRatingAction` happy path test passes
   - [ ] Tests cover all rating types (Again, Hard, Good, Easy)
   - [ ] Unauthorized access is properly handled
   - [ ] Invalid ratings are rejected with proper error messages
   - [ ] Non-existent flashcards return appropriate errors
   - [ ] Ownership validation prevents accessing other users' cards
   - [ ] Streak calculation logic is tested with edge cases
   - [ ] User stats updates are validated
   - [ ] Database transaction mocking works correctly
   
   ## Webhook Handler Tests
   - [ ] Valid webhook requests with correct signatures are processed
   - [ ] Invalid API keys are rejected (401)
   - [ ] Invalid HMAC signatures are rejected (401)
   - [ ] Expired timestamps are rejected (401)
   - [ ] Malformed JSON payloads return 400 errors
   - [ ] Invalid payload schemas return 400 with validation details
   - [ ] Non-existent jobs return 404 errors
   - [ ] Already completed jobs are handled idempotently
   - [ ] Illegal state transitions return 409 errors
   - [ ] `simulateWebhookAction` works in development mode
   - [ ] `simulateWebhookAction` is disabled in production
   - [ ] HMAC signatures are included when secret is configured
   
   ## E2E Tests
   - [ ] Playwright is configured and installed
   - [ ] Authentication flow test passes (with dev stub support)
   - [ ] Flashcard creation and webhook delivery test passes
   - [ ] Approve and save flow completes successfully
   - [ ] No N+1 database queries detected during bulk operations
   - [ ] Study flow updates user statistics correctly
   - [ ] Keyboard shortcuts work during study sessions
   - [ ] Tests run successfully in CI environment
   - [ ] Tests handle both development and production scenarios
   
   ## CI Pipeline Integration
   - [ ] All CI scripts execute in correct order
   - [ ] Lint errors fail the build
   - [ ] Unit test failures fail the build
   - [ ] Forbidden import detection fails the build
   - [ ] Build compilation errors fail the pipeline
   - [ ] E2E test failures are properly reported
   - [ ] Test artifacts are uploaded on failure
   - [ ] Environment setup works correctly in CI
   
   ## Performance & Quality
   - [ ] CI pipeline completes within reasonable time (< 10 minutes)
   - [ ] Test coverage is maintained or improved
   - [ ] No flaky tests that fail intermittently
   - [ ] All tests clean up properly (no resource leaks)
   - [ ] Error messages are clear and actionable
   
   ## Documentation
   - [ ] CI setup documentation is complete
   - [ ] All available test scripts are documented
   - [ ] Forbidden import patterns are clearly explained
   - [ ] Test structure and organization is documented
   - [ ] Development workflow includes testing guidance
   
   ## Rollback Criteria
   If any of these issues occur, consider rollback:
   - CI pipeline consistently fails or hangs
   - Tests are too flaky to provide value
   - E2E tests significantly slow development workflow
   - False positives in forbidden import detection
   - Database setup issues in CI environment
   ```

3. **Create environment-specific test configuration:**
   ```typescript
   // nextjs-app/__tests__/setup/test-env.ts
   import { beforeAll, afterAll } from 'vitest';
   
   // Set up test environment variables
   beforeAll(() => {
     // Ensure we're in test mode
     process.env.NODE_ENV = 'test';
     
     // Set test-specific API keys
     process.env.INTERNAL_API_KEY = 'test-api-key';
     process.env.INTERNAL_WEBHOOK_HMAC_SECRET = 'test-hmac-secret';
     
     // Mock external services
     process.env.CLERK_SECRET_KEY = 'test-clerk-key';
     
     // Database connection for tests
     if (!process.env.DATABASE_URL) {
       process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/memoria_test';
     }
   });
   
   afterAll(() => {
     // Clean up test environment
   });
   ```

4. **Update vitest config to use setup file:**
   ```typescript
   // nextjs-app/vitest.config.ts (update)
   import { defineConfig } from 'vitest/config';
   import { resolve } from 'path';
   
   export default defineConfig({
     test: {
       environment: 'node',
       setupFiles: ['__tests__/setup/test-env.ts'],
       testTimeout: 10000,
       include: ['__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
       exclude: ['__tests__/**/*.integration.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
     },
     resolve: {
       alias: {
         '@': resolve(__dirname, './'),
       },
     },
   });
   ```

**Files to Create/Modify:**
- `.github/workflows/ci.yml` (if using GitHub)
- `docs/phase8_validation_checklist.md`
- `nextjs-app/__tests__/setup/test-env.ts`
- `nextjs-app/vitest.config.ts` (update)

**Validation:**
- [ ] CI pipeline runs successfully on push/PR
- [ ] All test suites execute in CI environment
- [ ] Database migrations work in CI
- [ ] Environment variables are properly set
- [ ] Artifacts are uploaded on test failures
- [ ] Pipeline fails appropriately when tests fail

**Dependencies:** Task 8.6 (CI script integration)

**Rollback:** Remove CI configuration files and revert test setup changes

---

This completes the detailed Phase 8 implementation plan with the same level of specificity and actionable steps as Phases 0-7. Each task includes:

- **Specific commands to run**
- **Exact code to implement**
- **Files to create/modify with full paths**
- **Clear validation criteria**
- **Dependencies on previous tasks**
- **Rollback instructions**

The implementation systematically addresses all three components mentioned in the action plan:
1. Fixed forbidden import script with proper path resolution
2. Comprehensive tests for server actions and webhook handlers
3. Basic E2E tests covering core user flows with proper CI integration

---

## Implementation Status Update

This detailed implementation plan now provides specific, actionable steps for **Phases 0-8**. Each phase follows the same comprehensive format with:

- **Specific file paths** to modify
- **Exact code changes** to implement  
- **Validation criteria** to verify completion
- **Clear dependencies** between tasks
- **Rollback instructions** for safe recovery

### Completed Phases (0-8):
- **Phase 0**: Project Prep & Baselines
- **Phase 1**: Data Correctness & Type Unification
- **Phase 2**: Performance: Server-Render Decks & Remove N+1
- **Phase 3**: Real-Time Job Updates (Replace Polling)
- **Phase 4**: Study UX + SRS Level & Streak Robustness
- **Phase 5**: Real Progress Stats
- **Phase 6**: Durable Rate Limiting with Redis/KV
- **Phase 7**: Security Headers & Markdown Sanitization
- **Phase 8**: CI Hardening & Tests ✨ **(Newly Added)**

### Remaining Phases:
- **Phase 10**: Documentation and operational readiness

---

## Phase 9 — Cleanup & Routing

### Task 9.1: Remove Duplicate Landing Page

**Implementation Steps:**

1. **Compare existing landing pages:**
   ```bash
   cd nextjs-app
   # Check if both pages exist
   ls -la app/page.tsx app/landing/page.tsx
   
   # Compare content to confirm duplication
   diff app/page.tsx app/landing/page.tsx || echo "Files differ or one doesn't exist"
   ```

2. **Backup the landing page if it exists:**
   ```bash
   cd nextjs-app
   if [ -f "app/landing/page.tsx" ]; then
     cp app/landing/page.tsx app/landing/page.tsx.backup
     echo "Landing page backed up"
   else
     echo "No landing page found to backup"
   fi
   ```

3. **Create redirect in next.config.js:**
   ```javascript
   // nextjs-app/next.config.js
   /** @type {import('next').NextConfig} */
   const nextConfig = {
     // ... existing config
     
     async redirects() {
       return [
         {
           source: '/landing',
           destination: '/',
           permanent: true,
         },
         {
           source: '/landing/:path*',
           destination: '/:path*',
           permanent: true,
         },
       ];
     },
   };

   module.exports = nextConfig;
   ```

4. **Test the redirect configuration:**
   ```bash
   cd nextjs-app
   npm run build
   # Check for any configuration errors in build output
   ```

5. **Remove the duplicate landing directory:**
   ```bash
   cd nextjs-app
   # Only remove if it exists and redirect is working
   if [ -d "app/landing" ]; then
     rm -rf app/landing
     echo "Landing directory removed"
   fi
   ```

6. **Update middleware to remove landing route:**
   ```bash
   cd nextjs-app
   # Edit middleware.ts to remove "/landing" from publicRoutes
   sed -i.bak 's|"/landing",||g' middleware.ts
   # Remove backup file created by sed
   rm middleware.ts.bak
   ```

7. **Verify redirect works in development:**
   ```bash
   cd nextjs-app
   npm run dev
   # Test redirect: curl -I http://localhost:3000/landing should return 301
   ```

**Files to Modify:**
- `nextjs-app/next.config.js`
- `nextjs-app/middleware.ts`
- Remove `nextjs-app/app/landing/` directory

**Validation:**
- [ ] `/landing` redirects to `/` with 301 status
- [ ] `/landing/any-path` redirects to `/any-path` with 301 status
- [ ] `npm run build` succeeds without errors
- [ ] No landing page directory exists in app folder
- [ ] Middleware no longer references "/landing" route

**Dependencies:** None

**Rollback:** 
```bash
# Restore landing page from backup
cd nextjs-app
if [ -f "app/landing/page.tsx.backup" ]; then
  mkdir -p app/landing
  cp app/landing/page.tsx.backup app/landing/page.tsx
fi
# Restore middleware
git checkout middleware.ts
# Remove redirects from next.config.js
```

---

### Task 9.2: Remove Unused Imports & Dead Code

**Implementation Steps:**

1. **Find and remove unused count import from API routes:**
   ```bash
   cd nextjs-app
   # Search for the unused count import
   rg -n "import.*count.*from" app/api/decks/[deckId]/cards/route.ts
   
   # If found, examine the file to confirm it's unused
   cat app/api/decks/[deckId]/cards/route.ts | grep -n "count"
   ```

2. **Remove the unused count import:**
   ```typescript
   // nextjs-app/app/api/decks/[deckId]/cards/route.ts
   // Remove this line if it exists:
   // import { count } from "drizzle-orm";
   
   // Keep only the imports that are actually used:
   import { auth } from "@clerk/nextjs";
   import { NextRequest, NextResponse } from "next/server";
   import { eq } from "drizzle-orm";
   import { db } from "@/db";
   import { flashcards } from "@/db/schema";
   ```

3. **Find all relative type imports to standardize:**
   ```bash
   cd nextjs-app
   # Search for relative imports to types
   rg "from [\"']\.\./.*types[\"']" --type ts --type tsx
   rg "from [\"']\.\.\/.*types[\"']" --type ts --type tsx
   rg "from [\"']\.\.\/\.\.\/.*types[\"']" --type ts --type tsx
   ```

4. **Replace relative type imports with @/types:**
   ```bash
   cd nextjs-app
   # Use sed to replace relative imports with absolute imports
   find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | xargs sed -i.bak 's|from ["'"'"']\.\./types["'"'"']|from "@/types"|g'
   find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | xargs sed -i.bak 's|from ["'"'"']\.\.\/\.\.\/types["'"'"']|from "@/types"|g'
   find . -name "*.ts" -o -name "*.tsx" | grep -v node_modules | xargs sed -i.bak 's|from ["'"'"']\.\.\/\.\.\/\.\.\/types["'"'"']|from "@/types"|g'
   
   # Clean up backup files
   find . -name "*.bak" -delete
   ```

5. **Run ESLint to find and fix other unused imports:**
   ```bash
   cd nextjs-app
   # Check for unused variables and imports
   npm run lint
   
   # Auto-fix what can be automatically fixed
   npm run lint -- --fix
   ```

6. **Remove any other dead code found during the sweep:**
   ```bash
   cd nextjs-app
   # Check for unused variables that weren't auto-fixed
   rg "is assigned a value but never used" . || echo "No unused variables found"
   
   # Look for any TODO comments marking dead code
   rg -i "TODO.*remove|FIXME.*unused|dead code" --type ts --type tsx
   ```

7. **Verify all files still compile:**
   ```bash
   cd nextjs-app
   npm run build
   # Should complete without TypeScript errors
   ```

**Files to Modify:**
- `nextjs-app/app/api/decks/[deckId]/cards/route.ts`
- Any files with relative type imports (to be found during implementation)
- Any files with unused imports identified by ESLint

**Validation:**
- [ ] `npm run lint` passes without unused import warnings
- [ ] All type imports use `@/types` pattern
- [ ] No `count` import in cards route file if it was unused
- [ ] `npm run build` compiles successfully
- [ ] No TypeScript errors about missing imports

**Dependencies:** Task 9.1 (Landing page cleanup)

**Rollback:** 
```bash
# Restore specific files from git if issues occur
cd nextjs-app
git checkout app/api/decks/[deckId]/cards/route.ts
# Or restore all changes
git checkout .
```

---

### Task 9.3: Middleware Config Simplification

**Implementation Steps:**

1. **Backup current middleware:**
   ```bash
   cd nextjs-app
   cp middleware.ts middleware.ts.phase9.backup
   ```

2. **Review current middleware configuration:**
   ```bash
   cd nextjs-app
   cat middleware.ts | grep -A 10 -B 5 "publicRoutes\|ignoredRoutes"
   ```

3. **Update authMiddleware with explicit route patterns:**
   ```typescript
   // nextjs-app/middleware.ts
   import { authMiddleware } from "@clerk/nextjs";
   import { NextResponse } from "next/server";
   import { 
     applySecurityHeaders, 
     shouldSkipSecurityHeaders 
   } from "@/lib/security-headers";

   export default authMiddleware({
     publicRoutes: [
       "/",
       "/sign-in(.*)", // Explicit regex pattern for sign-in and all sub-paths
       "/sign-up(.*)", // Explicit regex pattern for sign-up and all sub-paths  
       "/articles(.*)", // Explicit regex pattern for articles and all sub-paths
       "/api/webhooks/clerk",
       "/api/webhooks/ai-service-status",
       "/api/auth/ensure-user"
     ],
     ignoredRoutes: [
       "/_next(.*)", // Explicit regex for Next.js static files
       "/favicon.ico", 
       "/assets(.*)", // Explicit regex for asset files
       "/api/webhooks/(.*)" // Explicit regex for all webhook routes
     ],
     afterAuth(auth, req) {
       // Let Clerk handle authentication first
       const response = NextResponse.next();

       // Apply security headers to appropriate routes
       if (!shouldSkipSecurityHeaders(req.nextUrl.pathname)) {
         return applySecurityHeaders(response);
       }

       return response;
     },
   });

   export const config = { 
     matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"] 
   };
   ```

4. **Test authentication flow with explicit patterns:**
   ```bash
   cd nextjs-app
   npm run dev
   
   # Test public routes (should be accessible without auth)
   curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/sign-in
   curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/sign-up  
   curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/articles
   ```

5. **Test protected routes redirect properly:**
   ```bash
   cd nextjs-app
   # These should redirect to sign-in for unauthenticated users
   curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/dashboard
   curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/decks
   curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/create
   ```

6. **Verify ignored routes are not processed by auth:**
   ```bash
   cd nextjs-app
   # These should return quickly without auth processing
   curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/_next/static/css/app.css
   curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/favicon.ico
   ```

7. **Run build to ensure no configuration errors:**
   ```bash
   cd nextjs-app
   npm run build
   # Should complete successfully
   ```

**Files to Modify:**
- `nextjs-app/middleware.ts`

**Validation:**
- [ ] `/sign-in`, `/sign-up`, `/articles` routes accessible without authentication
- [ ] `/sign-in/oauth/callback` type routes work (sub-paths)
- [ ] `/articles/how-to-study` type routes work (sub-paths)
- [ ] Protected routes redirect to sign-in when unauthenticated
- [ ] `/_next/*` files are not processed by authentication
- [ ] `/api/webhooks/*` routes are properly ignored
- [ ] `npm run build` succeeds without middleware errors
- [ ] Development server starts without authentication warnings

**Dependencies:** Task 9.2 (Dead code removal)

**Rollback:** `cp middleware.ts.phase9.backup middleware.ts`

---

### Task 9.4: Final Validation & Cleanup Documentation

**Implementation Steps:**

1. **Run comprehensive validation:**
   ```bash
   cd nextjs-app
   # Check all linting and formatting
   npm run ci
   
   # Verify build still works after all changes
   npm run build
   ```

2. **Test full application flow:**
   ```bash
   cd nextjs-app
   npm run dev
   # Manual verification checklist:
   # - Navigate to / (should work)
   # - Try /landing (should redirect to /)
   # - Try /sign-in (should work)
   # - Try /dashboard (should redirect to sign-in if not authenticated)
   ```

3. **Clean up any remaining backup files:**
   ```bash
   cd nextjs-app
   # Remove backup files created during this phase
   find . -name "*.phase9.backup" -delete
   find . -name "*.backup" -type f -exec rm {} \;
   ```

4. **Update import verification script results:**
   ```bash
   cd nextjs-app
   # Run the corrected forbidden imports check
   npm run verify:no-app-db-imports
   # Should exit with code 0 (success)
   ```

5. **Document the cleanup changes:**
   ```markdown
   # Phase 9 Cleanup Summary
   
   ## Changes Made:
   - Removed duplicate /landing page, added redirects
   - Cleaned unused imports (count from API routes)
   - Standardized all type imports to use @/types
   - Updated middleware with explicit regex patterns
   
   ## Routes After Changes:
   - / - Main landing page
   - /sign-in(...) - Authentication (public)
   - /sign-up(...) - Registration (public)  
   - /articles(...) - Content (public)
   - /dashboard, /decks, /create - App functionality (protected)
   
   ## Import Standards:
   - All type imports use @/types
   - No unused imports remain
   - ESLint rules enforced
   ```

6. **Commit all changes:**
   ```bash
   cd nextjs-app
   git add .
   git status
   # Review changes before committing
   git commit -m "Phase 9: Cleanup & routing improvements
   
   - Remove duplicate landing page, add redirects
   - Clean unused imports and standardize type imports  
   - Update middleware with explicit route patterns
   - Remove dead code and backup files"
   ```

**Files to Create/Modify:**
- Clean up temporary and backup files
- All previous changes from Tasks 9.1-9.3

**Validation:**
- [ ] No duplicate pages exist
- [ ] Clean imports with no unused variables
- [ ] Predictable auth guard behavior
- [ ] `/landing` redirects to `/` properly
- [ ] All type imports use `@/types` pattern
- [ ] `npm run ci` passes completely
- [ ] Application functionality preserved
- [ ] Git commit includes all cleanup changes

**Dependencies:** Tasks 9.1, 9.2, 9.3

**Rollback:** 
```bash
# Complete rollback to before Phase 9
cd nextjs-app
git log --oneline -5  # Find commit before Phase 9
git reset --hard <commit-before-phase-9>
```

Each phase builds systematically on previous work to ensure safe, incremental progress toward the production-ready application described in the expert review.

---

## Phase 10 — Documentation, Ops & Rollout

### Task 10.1: Update Documentation (README & Action Plan)

**Implementation Steps:**

1. **Update root README.md with new environment variables:**
   ```bash
   cd /Users/aeziz-local/Side\ Projects/memoria-ai-flashcard-spaced-repetition-web-app
   
   # First, backup the current README
   cp README.md README.md.backup
   ```

2. **Add comprehensive environment variables section to README.md:**
   ```markdown
   # Add after "## Getting Started" section, before "### Running the Next.js Application"
   
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
   ```

3. **Update root README.md commands section:**
   ```bash
   # Replace the existing "Getting Started" section with comprehensive commands
   ```

4. **Move action plan to docs/ directory and update root README:**
   ```bash
   cd /Users/aeziz-local/Side\ Projects/memoria-ai-flashcard-spaced-repetition-web-app
   
   # Create a link to the detailed action plan in root README
   # Add after the "Development" section:
   echo "
   ## Documentation
   
   - [Detailed Implementation Plan](./docs/nextjs_detailed_implementation_plan.md) - Step-by-step implementation guide
   - [Action Plan](./docs/nextjs_action_plan_v1.md) - High-level roadmap and phases
   - [Expert Review](./docs/nextjs_review_v1.md) - Architecture analysis and recommendations
   " >> README.md
   ```

**Files to Create/Modify:**
- `README.md` (root)
- No new files created, only documentation updates

**Validation:**
- [ ] README.md includes all environment variables with descriptions
- [ ] Security headers strategy documented
- [ ] Cache tags strategy explained
- [ ] Links to detailed documentation work correctly
- [ ] All commands in README are accurate and tested
- [ ] Environment variable examples are realistic but not real secrets

**Dependencies:** None (documentation only)

**Rollback:** 
```bash
cd /Users/aeziz-local/Side\ Projects/memoria-ai-flashcard-spaced-repetition-web-app
cp README.md.backup README.md
```

---

### Task 10.2: Create Operational Runbooks

**Implementation Steps:**

1. **Create webhook HMAC rotation runbook:**
   ```bash
   cd /Users/aeziz-local/Side\ Projects/memoria-ai-flashcard-spaced-repetition-web-app
   mkdir -p docs/operations
   ```

2. **Create webhook operations runbook:**
   ```markdown
   # Create docs/operations/webhook-management.md
   
   # Webhook HMAC Secret Management
   
   ## HMAC Secret Rotation Procedure
   
   ### Prerequisites
   - Access to production environment variables
   - Access to AI service configuration
   - Deployment access (Vercel dashboard or equivalent)
   
   ### Steps for Secret Rotation
   
   1. **Generate new HMAC secret:**
      ```bash
      # Generate cryptographically secure secret (32+ characters)
      openssl rand -hex 32
      # Or use: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
      ```
   
   2. **Update AI service first:**
      ```bash
      # Update ai-service/.env.local with new secret
      INTERNAL_WEBHOOK_HMAC_SECRET="new-secret-here"
      
      # Restart AI service
      # For local: Ctrl+C and restart with uvicorn
      # For production: Deploy updated environment configuration
      ```
   
   3. **Update Next.js app:**
      ```bash
      # Update nextjs-app/.env.local
      INTERNAL_WEBHOOK_HMAC_SECRET="new-secret-here"
      
      # For Vercel production:
      # 1. Go to Vercel dashboard > Project Settings > Environment Variables
      # 2. Update INTERNAL_WEBHOOK_HMAC_SECRET with new value
      # 3. Redeploy application
      ```
   
   4. **Verify rotation worked:**
      ```bash
      # Test webhook endpoint with new secret
      curl -X POST https://your-app.vercel.app/api/webhooks/ai-service-status \
        -H "Content-Type: application/json" \
        -H "x-internal-api-key: your-api-key" \
        -H "x-webhook-timestamp: $(date +%s)000" \
        -H "x-webhook-signature: sha256=$(echo -n "$(date +%s)000.{test payload}" | openssl dgst -sha256 -hmac 'your-new-secret' -binary | xxd -p)" \
        -d '{"jobId": "test-job-id", "status": "completed"}'
      
      # Should return 404 (job not found) rather than 401 (invalid signature)
      ```
   
   ## Webhook Troubleshooting Guide
   
   ### Common Issues
   
   #### 1. Invalid Signature (401 Error)
   **Symptoms:** Webhook returns `{"error": "Invalid signature", "errorCode": "INVALID_SIGNATURE"}`
   
   **Diagnosis:**
   ```bash
   # Check if HMAC secrets match between services
   # AI service logs should show the signature it's generating
   # Next.js logs should show the expected vs received signature
   ```
   
   **Solutions:**
   - Verify HMAC secrets match exactly between AI service and Next.js
   - Check timestamp is within 5-minute window
   - Ensure signature format is `sha256=<hex-digest>`
   
   #### 2. Timestamp Expired (401 Error)
   **Symptoms:** `{"error": "Signature timestamp expired", "errorCode": "TIMESTAMP_EXPIRED"}`
   
   **Solutions:**
   - Check system clocks are synchronized between services
   - Reduce delay between AI service completing and sending webhook
   - Consider increasing timestamp tolerance if needed (currently 5 minutes)
   
   #### 3. Missing Signature Headers (401 Error)
   **Symptoms:** `{"error": "Missing signature headers", "errorCode": "MISSING_SIGNATURE"}`
   
   **Solutions:**
   - Ensure AI service includes both `x-webhook-timestamp` and `x-webhook-signature` headers
   - Verify header names are exact (case-sensitive)
   
   #### 4. Job State Conflicts (409 Error)
   **Symptoms:** `{"error": "Illegal transition", "errorCode": "ILLEGAL_TRANSITION"}`
   
   **Solutions:**
   - Check job isn't already in terminal state (completed/failed)
   - Verify state transition is legal per job state machine
   - Consider if duplicate webhooks are being sent
   
   ### Emergency Procedures
   
   #### Disable HMAC Verification Temporarily
   ```bash
   # In production emergency only:
   # Remove or comment out INTERNAL_WEBHOOK_HMAC_SECRET
   # Webhook will fall back to API key only
   # IMPORTANT: Re-enable HMAC as soon as issue is resolved
   ```
   
   #### Webhook Debugging
   ```bash
   # Enable verbose logging to see signature calculations
   # Check both AI service logs and Next.js function logs
   # Look for exact signature strings and timestamp values
   ```
   ```

3. **Create rate limiting operations runbook:**
   ```markdown
   # Create docs/operations/rate-limiting.md
   
   # Rate Limiting Operations
   
   ## Rate Limit Override Procedure
   
   ### Emergency Override (Redis-based)
   
   When legitimate users are being rate-limited inappropriately:
   
   1. **Identify the rate limit key:**
      ```bash
      # Rate limit keys follow pattern: "rate_limit:{identifier}:{window}"
      # Examples:
      # rate_limit:user:clm123:3600 (user-based, 1 hour window)
      # rate_limit:ip:192.168.1.100:3600 (IP-based, 1 hour window)
      ```
   
   2. **Clear specific rate limit:**
      ```bash
      # Using Redis CLI (if direct access available)
      redis-cli DEL "rate_limit:user:clm123:3600"
      
      # Or via Upstash REST API
      curl -X POST https://your-redis.upstash.io/del/rate_limit:user:clm123:3600 \
        -H "Authorization: Bearer your-token"
      ```
   
   3. **Temporary rate limit increase:**
      ```bash
      # Set higher limit temporarily (e.g., 1000 instead of 100)
      redis-cli SET "rate_limit:user:clm123:3600" 50 EX 3600
      # This gives user 950 more requests (1000 - 50 used) for next hour
      ```
   
   ### Monitoring Rate Limits
   
   ```bash
   # Check current rate limit status for user
   redis-cli GET "rate_limit:user:clm123:3600"
   
   # List all active rate limits
   redis-cli KEYS "rate_limit:*" | head -20
   
   # Get rate limit statistics
   redis-cli SCAN 0 MATCH "rate_limit:*" COUNT 100
   ```
   
   ### Rate Limit Configuration Changes
   
   Production rate limits are defined in:
   - `nextjs-app/middleware.ts` - Route-specific limits
   - `nextjs-app/lib/rate-limit.ts` - Limit values and windows
   
   **To update rate limits:**
   1. Modify rate limit constants in code
   2. Deploy changes
   3. Clear existing rate limit keys to apply new limits immediately:
      ```bash
      redis-cli --scan --pattern "rate_limit:*" | xargs redis-cli DEL
      ```
   
   ### Performance Monitoring
   
   **Key metrics to monitor:**
   - Rate limit hit rate (should be <5% for legitimate traffic)
   - Redis response times (should be <10ms)
   - Rate limit bypass attempts
   
   **Dashboard queries (if using monitoring tools):**
   ```sql
   -- Rate limit hit percentage
   SELECT 
     COUNT(CASE WHEN status = 429 THEN 1 END) * 100.0 / COUNT(*) as rate_limit_hit_rate
   FROM request_logs 
   WHERE timestamp > NOW() - INTERVAL 1 HOUR;
   
   -- Top rate-limited endpoints
   SELECT path, COUNT(*) as rate_limit_hits
   FROM request_logs 
   WHERE status = 429 AND timestamp > NOW() - INTERVAL 1 DAY
   GROUP BY path
   ORDER BY rate_limit_hits DESC;
   ```
   ```

4. **Create database migration operations runbook:**
   ```markdown
   # Create docs/operations/database-migrations.md
   
   # Database Migration Checklist
   
   ## Pre-Migration Checklist
   
   ### 1. Backup Procedures
   ```bash
   # Create full database backup
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
   
   # Verify backup integrity
   pg_restore --list backup_*.sql | head -10
   
   # Store backup securely (production)
   aws s3 cp backup_*.sql s3://your-backup-bucket/db-backups/
   ```
   
   ### 2. Migration Validation
   ```bash
   cd nextjs-app
   
   # Generate migration and review SQL
   npm run db:generate
   
   # Review generated SQL in drizzle/ directory
   cat drizzle/0000_*.sql
   
   # Check migration is reversible (document rollback steps)
   ```
   
   ### 3. Environment Preparation
   ```bash
   # Ensure database is accessible
   psql $DATABASE_URL -c "SELECT version();"
   
   # Check current schema version
   npm run db:studio
   # Look for __drizzle_migrations table
   
   # Verify no other migrations running
   # Check for locks: SELECT * FROM pg_locks WHERE locktype = 'advisory';
   ```
   
   ## Migration Execution
   
   ### 1. Apply Migration
   ```bash
   cd nextjs-app
   
   # Apply migration
   npm run db:migrate
   
   # Verify migration applied successfully
   # Check __drizzle_migrations table for new entry
   ```
   
   ### 2. Post-Migration Smoke Tests
   ```bash
   # Test critical application functions
   
   # 1. User authentication
   curl -X GET https://your-app.com/api/user/profile \
     -H "Authorization: Bearer test-token"
   
   # 2. Database reads
   curl -X GET https://your-app.com/api/decks
   
   # 3. Database writes  
   curl -X POST https://your-app.com/api/decks \
     -H "Content-Type: application/json" \
     -d '{"title": "Migration Test Deck"}'
   
   # 4. AI service integration
   curl -X POST https://your-app.com/api/ai/generate \
     -H "Content-Type: application/json" \
     -d '{"content": "Test content", "type": "basic"}'
   ```
   
   ### 3. Performance Validation
   ```bash
   # Check query performance didn't degrade
   # Run EXPLAIN ANALYZE on critical queries
   
   psql $DATABASE_URL << EOF
   EXPLAIN ANALYZE 
   SELECT * FROM flashcards 
   WHERE user_id = 'test-user' AND due_date <= NOW()
   ORDER BY due_date ASC;
   EOF
   
   # Monitor application metrics
   # - Response times should be similar to pre-migration
   # - Error rates should not increase
   # - Database connection pool should be stable
   ```
   
   ## Rollback Procedures
   
   ### Automatic Rollback (if migration fails)
   ```bash
   # Drizzle doesn't auto-rollback, manual steps required
   
   # 1. Restore from backup
   dropdb memoria_db_temp  # if exists
   pg_restore -C -d postgres backup_*.sql
   
   # 2. Update application to point to restored database
   # 3. Verify application functionality
   ```
   
   ### Manual Rollback (if issues discovered after migration)
   ```bash
   # 1. Document current state
   pg_dump $DATABASE_URL > post_migration_backup.sql
   
   # 2. Identify problematic changes
   # Compare pre/post migration schemas
   
   # 3. Create reverse migration
   # Write SQL to undo the changes
   
   # 4. Test reverse migration on backup first
   # 5. Apply to production during maintenance window
   ```
   
   ## Emergency Procedures
   
   ### Database Connection Issues
   ```bash
   # Check connection limits
   psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"
   
   # Kill long-running queries if needed
   psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query_start < NOW() - INTERVAL '5 minutes';"
   ```
   
   ### Application Downtime Minimization
   ```bash
   # For zero-downtime migrations:
   # 1. Ensure migration is backward-compatible
   # 2. Deploy code that works with both old and new schema
   # 3. Run migration
   # 4. Deploy code that uses new schema features
   ```
   ```

**Files to Create/Modify:**
- `docs/operations/webhook-management.md` (new file)
- `docs/operations/rate-limiting.md` (new file)
- `docs/operations/database-migrations.md` (new file)

**Validation:**
- [ ] All three runbooks created with comprehensive procedures
- [ ] HMAC rotation steps are clear and tested
- [ ] Rate limiting procedures include emergency overrides
- [ ] Database migration checklist covers backup, validation, and rollback
- [ ] All code examples are syntactically correct
- [ ] Emergency procedures are clearly documented

**Dependencies:** Task 10.1 (documentation structure)

**Rollback:** 
```bash
rm -rf docs/operations/
```

---

### Task 10.3: Enhance Monitoring & Logging

**Implementation Steps:**

1. **Verify JSON logging is properly configured:**
   ```bash
   cd /Users/aeziz-local/Side\ Projects/memoria-ai-flashcard-spaced-repetition-web-app/nextjs-app
   
   # Check current log.ts implementation
   cat lib/log.ts
   
   # Verify it's being used in webhook handler
   grep -r "from.*lib/log" app/api/webhooks/
   ```

2. **Enhance webhook logging with categorized errors:**
   ```typescript
   // nextjs-app/app/api/webhooks/ai-service-status/route.ts
   // Replace the basic console.error with structured logging
   
   import { log } from "@/lib/log";
   
   // Replace line 149: console.error("Error processing AI service status update:", error);
   // With structured logging:
   
   if (error instanceof z.ZodError) {
     log.error("Webhook validation failed", {
       component: "webhook",
       operation: "validate_payload", 
       errorCategory: "invalid_payload",
       errorCode: "INVALID_PAYLOAD",
       validationErrors: error.errors,
       payloadLength: raw.length,
       headers: {
         apiKey: request.headers.get("x-internal-api-key") ? "present" : "missing",
         hmacSignature: request.headers.get("x-webhook-signature") ? "present" : "missing",
         timestamp: request.headers.get("x-webhook-timestamp")
       }
     });
     return NextResponse.json(
       {
         error: "Invalid payload",
         errorCode: "INVALID_PAYLOAD", 
         details: error.errors,
       },
       { status: 400 }
     );
   }

   log.error("Webhook processing failed", {
     component: "webhook",
     operation: "process_status_update",
     errorCategory: "internal_error", 
     errorCode: "INTERNAL_ERROR",
     errorMessage: error instanceof Error ? error.message : "Unknown error",
     errorStack: error instanceof Error ? error.stack : undefined,
     payloadLength: raw.length
   });
   ```

3. **Add success logging for webhook operations:**
   ```typescript
   // Add success logging after line 144 in webhook route
   log.info("Webhook processed successfully", {
     component: "webhook",
     operation: "process_status_update", 
     jobId: validatedPayload.jobId,
     status: validatedPayload.status,
     hasResultPayload: !!validatedPayload.resultPayload,
     hasErrorDetail: !!validatedPayload.errorDetail,
     processingTimeMs: Date.now() - startTime
   });
   ```

4. **Enhance job processing logging:**
   ```bash
   # Find files that handle AI job processing
   cd nextjs-app
   find . -name "*.ts" -o -name "*.tsx" | xargs grep -l "processingJobs\|AI.*process" | grep -v node_modules
   ```

5. **Add comprehensive logging to AI service actions:**
   ```typescript
   // nextjs-app/actions/ai/index.ts
   // Add structured logging for AI processing requests
   
   import { log } from "@/lib/log";
   
   // Add at start of submitProcessingRequest function
   const startTime = Date.now();
   
   log.info("AI processing request initiated", {
     component: "ai_service",
     operation: "submit_request",
     userId: user.id,
     contentLength: content.length,
     cardType: cardType,
     cardCount: cardCount,
     targetModel: "gpt-4" // or whatever model is being used
   });
   
   // Add before webhook call
   log.info("Sending webhook to AI service", {
     component: "ai_service", 
     operation: "send_webhook",
     jobId: job.id,
     aiServiceUrl: aiServiceUrl,
     requestPayload: {
       contentLength: content.length,
       cardType: cardType,
       cardCount: cardCount
     }
   });
   ```

6. **Create log aggregation documentation:**
   ```markdown
   # Create docs/operations/logging-monitoring.md
   
   # Logging & Monitoring Guide
   
   ## Log Structure
   
   All logs follow structured JSON format:
   ```json
   {
     "ts": "2025-01-15T10:30:00.000Z",
     "level": "info|warn|error|debug",
     "message": "Human-readable message",
     "component": "webhook|ai_service|auth|database",
     "operation": "process_status_update|submit_request|authenticate",
     "errorCategory": "invalid_input|token_limit|auth_error|rate_limit|ai_model_error|parse_error|network_error|webhook_error|internal_error|unknown_error",
     "errorCode": "SPECIFIC_ERROR_CODE",
     "additional": "context-specific fields"
   }
   ```
   
   ## Key Log Categories
   
   ### Webhook Logs
   - **Success**: `component: "webhook", operation: "process_status_update"`
   - **Authentication Failures**: `errorCategory: "auth_error"`
   - **Validation Failures**: `errorCategory: "invalid_payload"`
   - **HMAC Failures**: `errorCode: "INVALID_SIGNATURE"`
   
   ### AI Service Integration
   - **Request Initiation**: `component: "ai_service", operation: "submit_request"`
   - **Service Communication**: `component: "ai_service", operation: "send_webhook"`
   - **Processing Status**: `operation: "process_status_update"`
   
   ### Error Categories
   | Category | Description | Action Required |
   |----------|-------------|-----------------|
   | `invalid_input` | User provided invalid content | User notification |
   | `token_limit` | Content too large for AI model | Chunking or user guidance |
   | `auth_error` | Authentication/authorization failed | Check API keys |
   | `rate_limit` | Rate limit exceeded | Implement backoff |
   | `ai_model_error` | AI service returned error | Check AI service status |
   | `parse_error` | Failed to parse AI response | AI prompt engineering |
   | `network_error` | Network connectivity issue | Retry mechanism |
   | `webhook_error` | Webhook delivery failed | Check webhook config |
   | `internal_error` | Application logic error | Code fix required |
   
   ## Platform-Specific Monitoring
   
   ### Vercel (Production)
   ```bash
   # View function logs
   vercel logs --app=memoria-app
   
   # Filter specific errors
   vercel logs --app=memoria-app | grep '"level":"error"'
   
   # Monitor webhook failures
   vercel logs --app=memoria-app | grep 'webhook.*error'
   ```
   
   ### Local Development
   ```bash
   # All logs go to stdout in JSON format
   cd nextjs-app && npm run dev | jq '.'
   
   # Filter for errors only
   cd nextjs-app && npm run dev | grep '"level":"error"' | jq '.'
   ```
   
   ### CloudWatch (if using AWS)
   ```sql
   -- Sample CloudWatch Insights queries
   
   -- Error rate by component
   fields @timestamp, component, errorCategory
   | filter level = "error"
   | stats count() by component
   | sort count() desc
   
   -- Webhook authentication failures
   fields @timestamp, message, errorCode, headers
   | filter component = "webhook" and errorCategory = "auth_error"
   | sort @timestamp desc
   
   -- AI processing performance
   fields @timestamp, operation, processingTimeMs
   | filter component = "ai_service" and operation = "process_status_update"
   | stats avg(processingTimeMs) by bin(5m)
   ```
   
   ## Alert Configuration
   
   ### Critical Alerts (Immediate Response)
   - Error rate > 5% over 5 minutes
   - Webhook authentication failures > 10/minute
   - Database connection failures
   - AI service unavailable (100% failure rate)
   
   ### Warning Alerts (Monitor)
   - Error rate > 1% over 15 minutes  
   - Rate limiting triggered frequently
   - Slow response times (> 5s for AI requests)
   - High memory/CPU usage
   
   ### Example Alert Queries
   ```bash
   # Error rate alert
   vercel logs --since=5m | grep '"level":"error"' | wc -l
   # Alert if > 50 errors in 5 minutes
   
   # Webhook auth failures
   vercel logs --since=1m | grep '"errorCode":"INVALID_SIGNATURE"' | wc -l
   # Alert if > 10 failures in 1 minute
   ```
   ```

**Files to Create/Modify:**
- `nextjs-app/app/api/webhooks/ai-service-status/route.ts` (enhance logging)
- `nextjs-app/actions/ai/index.ts` (add structured logging)
- `docs/operations/logging-monitoring.md` (new file)

**Validation:**
- [ ] Webhook failures logged with payload category and error code
- [ ] Success operations logged with performance metrics
- [ ] AI service interactions have full request/response logging
- [ ] JSON log format verified in development
- [ ] Log aggregation guide covers all major platforms
- [ ] Error categories align with actual errorDetail schema
- [ ] Alert thresholds are realistic for application scale

**Dependencies:** Tasks 10.1, 10.2 (documentation structure)

**Rollback:**
```bash
# Restore original webhook route
cd nextjs-app
git checkout app/api/webhooks/ai-service-status/route.ts actions/ai/index.ts
rm docs/operations/logging-monitoring.md
```

---

### Task 10.4: Final Documentation Review & Links

**Implementation Steps:**

1. **Create comprehensive docs index:**
   ```bash
   cd /Users/aeziz-local/Side\ Projects/memoria-ai-flashcard-spaced-repetition-web-app/docs
   
   # Create master documentation index
   cat > README.md << 'EOF'
   # Memoria Documentation
   
   This directory contains comprehensive documentation for the Memoria AI flashcard application.
   
   ## Implementation Documentation
   
   - [Next.js Detailed Implementation Plan](./nextjs_detailed_implementation_plan.md) - Complete step-by-step implementation guide
   - [Next.js Action Plan v1](./nextjs_action_plan_v1.md) - High-level roadmap and phase breakdown
   - [Next.js Expert Review](./nextjs_review_v1.md) - Architecture analysis and recommendations
   - [AI Service Implementation Plan](./ai_service_detailed_implementation_plan.md) - AI service implementation guide
   - [AI Service Action Plan](./ai_service_action_plan_v1.md) - AI service roadmap
   
   ## Operations Documentation
   
   - [Webhook Management](./operations/webhook-management.md) - HMAC rotation and troubleshooting
   - [Rate Limiting Operations](./operations/rate-limiting.md) - Rate limit management and monitoring
   - [Database Migration Procedures](./operations/database-migrations.md) - Safe migration practices
   - [Logging & Monitoring Guide](./operations/logging-monitoring.md) - Log structure and monitoring setup
   
   ## Architecture
   
   ### System Overview
   - **Frontend**: Next.js 14 with App Router, React, TypeScript
   - **Authentication**: Clerk with webhook integration
   - **Database**: PostgreSQL with Drizzle ORM, optimized queries
   - **AI Processing**: Python FastAPI service with OpenAI/Anthropic integration
   - **Caching**: Next.js cache tags with Redis rate limiting
   - **Security**: Comprehensive headers, HMAC webhook signing, CSRF protection
   
   ### Key Features Implemented
   - Spaced Repetition System (SRS) with Anki SM-2 algorithm
   - AI-powered flashcard generation with error categorization
   - Real-time processing status with webhooks
   - Comprehensive rate limiting and security measures
   - Structured JSON logging for observability
   - Type-safe API integration between services
   
   ## Development Workflow
   
   1. Review [Implementation Plan](./nextjs_detailed_implementation_plan.md) for detailed steps
   2. Follow [Operations Runbooks](./operations/) for deployment procedures  
   3. Use structured logging for debugging and monitoring
   4. Test webhook integrations thoroughly before deployment
   5. Follow database migration checklist for schema changes
   
   ## Getting Help
   
   - Check [Troubleshooting sections](./operations/webhook-management.md#webhook-troubleshooting-guide) in operations docs
   - Review [Error Categories](./operations/logging-monitoring.md#error-categories) for debugging
   - Consult [Expert Review](./nextjs_review_v1.md) for architectural decisions
   EOF
   ```

2. **Update root README with final documentation links:**
   ```bash
   cd /Users/aeziz-local/Side\ Projects/memoria-ai-flashcard-spaced-repetition-web-app
   
   # Add comprehensive documentation section
   ```

3. **Validate all internal links work:**
   ```bash
   cd /Users/aeziz-local/Side\ Projects/memoria-ai-flashcard-spaced-repetition-web-app
   
   # Check all markdown files exist that are referenced
   find . -name "*.md" -exec grep -l "\[.*\](.*\.md)" {} \; | while read file; do
     echo "Checking links in: $file"
     grep -o "\[.*\](.*\.md)" "$file" | sed 's/.*](\(.*\))/\1/' | while read link; do
       if [[ $link == ./* ]]; then
         # Relative link - check from file's directory
         dir=$(dirname "$file")
         if [ ! -f "$dir/$link" ]; then
           echo "BROKEN LINK: $file -> $link"
         fi
       fi
     done
   done
   ```

4. **Create deployment readiness checklist:**
   ```markdown
   # Create docs/operations/deployment-checklist.md
   
   # Production Deployment Readiness Checklist
   
   ## Environment Configuration
   - [ ] All environment variables configured in production
   - [ ] HMAC secrets generated and synchronized between services
   - [ ] Database connection string points to production database
   - [ ] Redis/Upstash configuration for rate limiting
   - [ ] Clerk production keys configured
   - [ ] AI service production deployment accessible
   
   ## Security Verification
   - [ ] HTTPS enforced in production
   - [ ] Security headers configured correctly
   - [ ] CSP policy allows necessary domains only
   - [ ] CSRF protection enabled
   - [ ] Rate limiting configured and tested
   - [ ] Webhook HMAC verification working
   
   ## Database Readiness  
   - [ ] Production database created and accessible
   - [ ] All migrations applied successfully
   - [ ] Database backups configured
   - [ ] Database connection pooling optimized
   - [ ] Critical queries performance tested
   
   ## Monitoring Setup
   - [ ] Structured JSON logging verified in production
   - [ ] Error tracking configured (Sentry, Bugsnag, etc.)
   - [ ] Performance monitoring enabled
   - [ ] Uptime monitoring configured
   - [ ] Alert thresholds configured
   - [ ] Dashboard access configured for team
   
   ## AI Service Integration
   - [ ] AI service production deployment healthy  
   - [ ] Webhook endpoint accessible from AI service
   - [ ] API keys synchronized between services
   - [ ] Request/response flow tested end-to-end
   - [ ] Error handling tested with invalid inputs
   
   ## Performance Validation
   - [ ] Load testing completed on critical paths
   - [ ] Database query performance acceptable
   - [ ] AI processing request times within limits
   - [ ] Cache hit rates optimized
   - [ ] Bundle size optimized for fast loading
   
   ## Rollback Procedures
   - [ ] Database rollback procedure documented and tested
   - [ ] Application rollback procedure ready
   - [ ] Emergency contact list updated
   - [ ] Rollback automation configured (if applicable)
   
   ## Documentation Complete
   - [ ] All runbooks created and validated
   - [ ] Architecture documentation up to date
   - [ ] API documentation current
   - [ ] Environment setup guide accurate
   - [ ] Team has access to all documentation
   
   ## Final Smoke Tests
   - [ ] User registration and authentication works
   - [ ] Flashcard creation flow complete
   - [ ] AI processing generates cards successfully
   - [ ] Spaced repetition studying functional
   - [ ] All critical user journeys tested
   - [ ] Error scenarios handled gracefully
   
   ## Go-Live Approval
   - [ ] Technical lead approval
   - [ ] Security review completed
   - [ ] Performance benchmarks met
   - [ ] Monitoring and alerting verified
   - [ ] Support team briefed on new features
   - [ ] Communication plan for launch ready
   ```

5. **Final commit with comprehensive documentation:**
   ```bash
   cd /Users/aeziz-local/Side\ Projects/memoria-ai-flashcard-spaced-repetition-web-app
   
   git add -A
   git status
   # Review all changes
   
   git commit -m "Phase 10: Complete documentation, ops & rollout preparation

   Documentation Updates:
   - Enhanced README with comprehensive environment variables
   - Added security headers and cache tags documentation
   - Created links to all implementation documentation

   Operational Runbooks:
   - Webhook HMAC rotation and troubleshooting procedures
   - Rate limiting management and emergency overrides
   - Database migration checklist with rollback procedures
   
   Monitoring & Logging:
   - Enhanced webhook logging with structured error categories
   - Added performance metrics to AI service integration
   - Created comprehensive logging and monitoring guide
   - Platform-specific monitoring instructions

   Deployment Readiness:
   - Complete deployment checklist for production
   - Documentation index with architecture overview
   - Link validation and documentation completeness verified
   
   This completes Phase 10 and prepares the application for production deployment
   with comprehensive documentation, operational procedures, and monitoring."
   ```

**Files to Create/Modify:**
- `docs/README.md` (new file)
- `README.md` (root) - enhanced documentation section
- `docs/operations/deployment-checklist.md` (new file)
- All operational runbooks validated and linked

**Validation:**
- [ ] All documentation links work correctly
- [ ] Root README comprehensively covers environment setup
- [ ] Operations runbooks cover all critical procedures
- [ ] Documentation index provides clear navigation
- [ ] Deployment checklist is comprehensive and actionable
- [ ] Git commit includes all Phase 10 changes
- [ ] All markdown files are properly formatted

**Dependencies:** Tasks 10.1, 10.2, 10.3

**Rollback:**
```bash
# Complete Phase 10 rollback
cd /Users/aeziz-local/Side\ Projects/memoria-ai-flashcard-spaced-repetition-web-app
git log --oneline -5  # Find commit before Phase 10
git reset --hard <commit-before-phase-10>
```

---

## Phase 10 Summary

Phase 10 completes the transformation of Memoria from a development application to a production-ready system with comprehensive documentation and operational procedures.

### Key Deliverables

1. **Enhanced Documentation**
   - Comprehensive environment variable documentation
   - Security headers and cache strategy explanations
   - Clear setup and deployment instructions

2. **Operational Runbooks**
   - HMAC secret rotation procedures with emergency protocols
   - Rate limiting management and override procedures
   - Database migration checklist with backup and rollback steps

3. **Production Monitoring**
   - Structured JSON logging with error categorization
   - Platform-specific monitoring instructions
   - Alert configuration and troubleshooting guides

4. **Deployment Readiness**
   - Complete deployment checklist covering security, performance, and monitoring
   - Documentation index with clear navigation
   - Link validation ensuring documentation integrity

### Production Readiness Achieved

The application now includes:
- **Comprehensive Documentation**: All setup, operation, and troubleshooting procedures documented
- **Operational Excellence**: Runbooks for common operations and emergency procedures  
- **Observability**: Structured logging with error categorization and monitoring guides
- **Deployment Safety**: Checklists and procedures to ensure safe production deployment

This phase ensures the application can be operated, maintained, and scaled effectively in production with full observability and documented procedures for all operational scenarios.