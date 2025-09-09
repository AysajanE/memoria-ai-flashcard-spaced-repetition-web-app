/**
 * @file page.tsx (JobStatusPage)
 * @description
 *  Server Component page that displays the AI processing job status.
 *  Uses initial server-rendered data with cache tags for real-time updates
 *  via webhook revalidation, with fallback client-side polling.
 *
 * @dependencies
 *  - Next.js Server Components
 *  - Server actions for data fetching with cache tags
 *  - Client component for interactive portions
 *
 * @notes
 *  - Server Component fetches initial data with cache tags matching webhook revalidation
 *  - Client component handles interactions and fallback polling (30s intervals)
 *  - Real-time updates triggered by webhook revalidateTag calls
 */

import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs";
import { PageHeader } from "@/components/shared/page-header";
import { Loader2 } from "lucide-react";
import { getJobStatusWithCache } from "@/actions/ai";
import { JobStatusClient } from "./job-status-client";
import { JobData } from "@/types/job";

/**
 * Loading component for Suspense boundary
 */
function LoadingJobStatus() {
  return (
    <div className="container py-6 space-y-6">
      <PageHeader
        heading="Flashcard Generation"
        description="Your content is being processed into flashcards"
      />
      <div className="p-6 bg-muted rounded-lg">
        <div className="flex flex-col items-center justify-center space-y-4 py-8">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Loading job status...</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Server Component for job status page
 */
export default async function JobStatusPage({ params }: { params: { jobId: string } }) {
  const { userId } = auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const { jobId } = params;
  
  // Fetch initial data server-side with cache tags
  const initialJobData = await getJobStatusWithCache(jobId);
  
  // Handle case where job not found or unauthorized
  if (!initialJobData) {
    notFound();
  }

  return (
    <div className="container py-6 space-y-6">
      <PageHeader
        heading="Flashcard Generation"
        description="Your content is being processed into flashcards"
      />

      <div className="p-6 bg-muted rounded-lg">
        <h2 className="text-lg font-semibold mb-4">
          Job Status: {initialJobData.status}
        </h2>
        
        <Suspense fallback={<LoadingJobStatus />}>
          <JobStatusClient initialData={initialJobData} jobId={jobId} />
        </Suspense>
      </div>
    </div>
  );
}
