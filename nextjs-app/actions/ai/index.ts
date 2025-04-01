/**
 * @file index.ts
 * @description
 *  This file contains server actions related to AI job submission and retrieval in the Next.js app.
 *  We recently removed leftover placeholder AI logic (like "analyzeTopic", "processTextWithAI"),
 *  because that belongs in the Python microservice. The code now relies exclusively on the
 *  Python AI Service (triggerCardGeneration) for actual text/flashcard processing.
 *
 * Key Functions:
 *  - submitAiJobAction: Orchestrates creation of a processing job, calls the AI service asynchronously.
 *  - getJobStatusAction: Fetches current job status/results from the database.
 *  - listPendingJobsAction: Debug utility to list all pending jobs for the logged-in user.
 *
 * @dependencies
 *  - Drizzle ORM (db, processingJobs schema, users schema)
 *  - Clerk auth()
 *  - AI service client (triggerCardGeneration from "@/lib/ai-client")
 *
 * @notes
 *  - All placeholder logic referencing "analyzeTopic", "generateFlashcardsForTopic", or "processTextWithAI"
 *    has been removed, as real AI logic is now in the Python microservice.
 *  - This file returns Promise<ActionState<TData>> from each server action, including error handling.
 */

"use server";

import { auth } from "@clerk/nextjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { processingJobs, users } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { triggerCardGeneration } from "@/lib/ai-client";
import type { ActionState } from "@/types";

/**
 * The input validation schema for job submission.
 * - jobType: might be "summarize" or "generate-prompts" in some usage
 * - inputPayload: the user-submitted text or config
 * - documentId: optional reference for a stored file
 */
const submitJobSchema = z.object({
  jobType: z.enum(["summarize", "generate-prompts"]).optional(),
  inputPayload: z.object({
    text: z.string().min(1, "Text is required"),
  }),
  documentId: z.string().optional(),
});

/**
 * @function submitAiJobAction
 * @async
 * @description
 *  Creates a new AI job record in `processingJobs` with status='pending'.
 *  Calls the Python AI service asynchronously to handle the text.
 *
 * @param input Partial user input validated by zod.
 * @returns Promise<ActionState<{ jobId: string; inputText: string }>>
 */
export async function submitAiJobAction(
  input: unknown
): Promise<ActionState<{ jobId: string; inputText: string }>> {
  try {
    const { userId } = auth();
    if (!userId) {
      return {
        isSuccess: false,
        message: "You must be logged in to perform this action",
      };
    }

    // Validate input
    const validatedInput = submitJobSchema.safeParse(input);
    if (!validatedInput.success) {
      return {
        isSuccess: false,
        message: "Invalid input",
        error: validatedInput.error.flatten().fieldErrors,
      };
    }

    const { jobType = "summarize", inputPayload, documentId } = validatedInput.data;
    const userInputText = inputPayload.text;

    // Create a processing job record in DB
    let jobRecord;
    try {
      const [job] = await db
        .insert(processingJobs)
        .values({
          userId,
          jobType: "generate-cards", // Hardcode or set dynamically if needed
          status: "pending",
          inputPayload: {
            text: userInputText,
            requestedJobType: jobType,
            documentId,
          },
        })
        .returning({ id: processingJobs.id });
      jobRecord = job;
    } catch (dbError) {
      console.error("Error creating job record:", dbError);
      return {
        isSuccess: false,
        message: "Failed to create job record",
      };
    }

    // Call the AI service asynchronously
    try {
      await triggerCardGeneration({
        jobId: jobRecord.id,
        text: userInputText,
        // Additional model or cardType fields can be added if needed
      });

      return {
        isSuccess: true,
        data: { 
          jobId: jobRecord.id,
          inputText: userInputText
        },
        message: "Job creation succeeded. AI service triggered.",
      };
    } catch (aiError) {
      console.error("Failed to contact AI service:", aiError);
      // Mark job as failed if AI service request couldn't even start
      await db
        .update(processingJobs)
        .set({
          status: "failed",
          errorMessage:
            aiError instanceof Error
              ? aiError.message
              : "Unknown AI service error",
          completedAt: new Date(),
        })
        .where(eq(processingJobs.id, jobRecord.id));

      return {
        isSuccess: false,
        message: "Failed to process with AI service",
      };
    }
  } catch (error) {
    console.error("Error in submitAiJobAction:", error);
    return {
      isSuccess: false,
      message:
        error instanceof Error ? error.message : "Error submitting AI job",
    };
  }
}

/**
 * @function getJobStatusAction
 * @async
 * @description
 *  Retrieves status/data for a single job, verifying ownership.
 *
 * @param jobId The ID of the job to retrieve.
 * @returns Promise<ActionState<{ status: string; result?: any; error?: string }>>
 */
export async function getJobStatusAction(
  jobId: string
): Promise<ActionState<{ status: string; result?: any; error?: string }>> {
  try {
    const { userId } = auth();
    if (!userId) {
      return {
        isSuccess: false,
        message: "You must be logged in to perform this action",
      };
    }

    // Check the job
    const job = await db.query.processingJobs.findFirst({
      where: eq(processingJobs.id, jobId),
    });

    if (!job) {
      return {
        isSuccess: false,
        message: "Job not found",
      };
    }

    if (job.userId !== userId) {
      return {
        isSuccess: false,
        message: "You don't have permission to view this job",
      };
    }

    return {
      isSuccess: true,
      data: {
        status: job.status,
        result: job.resultPayload,
        error: job.errorMessage || undefined,
      },
    };
  } catch (error) {
    console.error("Error fetching job status:", error);
    return {
      isSuccess: false,
      message: "Failed to fetch job status",
    };
  }
}

/**
 * @function listPendingJobsAction
 * @async
 * @description
 *  Utility action that lists all pending jobs for the current user.
 *  Useful for debugging or listing queued tasks in a dashboard.
 *
 * @returns Promise<ActionState<Array<{id: string, status: string, createdAt: Date}>>>
 */
export async function listPendingJobsAction(): Promise<
  ActionState<Array<{ id: string; status: string; createdAt: Date }>>
> {
  try {
    const { userId } = auth();
    if (!userId) {
      return {
        isSuccess: false,
        message: "You must be logged in to perform this action",
      };
    }

    // List jobs that are still pending
    const pendingJobs = await db.query.processingJobs.findMany({
      where: and(eq(processingJobs.userId, userId), eq(processingJobs.status, "pending")),
      orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
      columns: {
        id: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      isSuccess: true,
      data: pendingJobs,
    };
  } catch (error) {
    console.error("Error fetching pending jobs:", error);
    return {
      isSuccess: false,
      message: "Failed to fetch pending jobs",
    };
  }
}
