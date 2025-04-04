/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file index.ts
 * @description
 * This file contains server actions related to AI job submission and retrieval in the Next.js app.
 * Notably, it defines `submitAiJobAction` which orchestrates job creation and notifies
 * the Python AI service to start the asynchronous flashcard-generation process.
 * - submitAiJobAction: Orchestrates creation of a processing job and triggers the AI service
 * - getJobStatusAction: Retrieves the current status/results of a processing job
 * - listPendingJobsAction: Debug utility to list all pending jobs for the logged-in user
 *
 * Key Responsibilities:
 * - Submit new AI job requests (create DB record, call AI service)
 * - Provide job status endpoints (via other server actions or routes)
 *
 * Important Considerations:
 * - We do NOT update job status to "processing" or "completed" here.
 * The Python AI service calls our webhook when it actually starts/finishes the job.
 * - We catch any immediate errors (network or validation) in calling the AI service
 * and mark the job as "failed" so the user sees an error right away.
 * - We rely on Clerk for user authentication: must call auth() to check userId.
 *
 * @dependencies
 * - Drizzle ORM (db, processingJobs schema, users schema)
 * - Clerk auth()
 * - ActionState type from our shared types
 * - Our AI service client (triggerCardGeneration)
 *
 * @notes
 * - We removed repeated user creation logic that used to check if a user existed in DB and create them if not.
 * Now we rely solely on the Clerk webhook or other mechanisms to ensure the DB has a record for each user.
 * - Always ensure user is authenticated (userId must exist). Return an error if not.
 * - This file includes multiple server actions, all of which must return a Promise<ActionState<T>>.
 * - The job is created with `status = 'pending'`.
 * - We call the AI service but do not set `status = 'processing'`.
 * - If the AI service call fails (can't connect, etc.), we set `status = 'failed'`.
 * - Otherwise, the job stays "pending" until the AI service updates it via our webhook.
 */

"use server";

import { auth } from "@clerk/nextjs";
import { db } from "@/db";
import { ActionState } from "@/types"; // Ensure ActionState type definition includes 'error?: Record<string, string[]> | null'
import { processingJobs } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { triggerCardGeneration } from "@/lib/ai-client";

/**
 * Input validation schema for the user request data to this server action.
 * - jobType: e.g., "generate-cards" (we can expand if we have different job types in the future)
 * - inputPayload: The text or config needed by the AI to do the generation
 * - documentId: (optional) if referencing an uploaded document
 */
const SubmitJobSchema = z.object({
  jobType: z.enum(["summarize", "generate-prompts", "generate-cards"]).optional(), // Updated to include generate-cards
  inputPayload: z.object({
    text: z.string().min(1, "Text is required"),
  }),
  documentId: z.string().optional(),
});

/**
 * @function submitAiJobAction
 * @async
 * @description
 * Creates a new AI job record in the `processingJobs` table with status "pending"
 * and triggers the Python AI service via an HTTP POST, returning immediately.
 * If the AI service call fails (e.g., network error), we mark the job as "failed" right away.
 *
 * @param input Partial user input for job submission, validated by zod
 * @returns {Promise<ActionState<{ jobId: string; inputText: string }>>}
 * - isSuccess: whether the job was successfully created and the request to AI was started
 * - data: includes the created `jobId` and the `inputText`
 * - message: success/error message
 * - error: any field validation errors
 */
export async function submitAiJobAction(
  input: unknown
): Promise<ActionState<{ jobId: string; inputText: string }>> {
  try {
    // Validate user auth (Clerk)
    const { userId } = auth();
    if (!userId) {
      return {
        isSuccess: false,
        message: "You must be logged in to perform this action",
      };
    }

    // Validate input data
    const parsed = SubmitJobSchema.safeParse(input);
    if (!parsed.success) {
      return {
        isSuccess: false,
        message: "Invalid input",
        error: parsed.error.flatten().fieldErrors,
      };
    }

    // Extract validated fields
    // Default to 'generate-cards' if jobType is not provided or invalid
    const { jobType = "generate-cards", inputPayload, documentId } = parsed.data;
    const userInputText = inputPayload.text;

    // 1) Create a job record in DB with status = 'pending'
    let createdJob;
    try {
      const [job] = await db
        .insert(processingJobs)
        .values({
          userId: userId,
          jobType: jobType, // Use validated or default job type
          status: "pending",
          inputPayload: {
            text: userInputText,
            requestedJobType: jobType, // Store the requested job type if needed
            documentId,
          },
        })
        .returning({ id: processingJobs.id });
      createdJob = job;
    } catch (dbError) {
      console.error("Error creating processingJobs record:", dbError);
      return {
        isSuccess: false,
        message: "Failed to create job record",
      };
    }

    // 2) Call the AI service asynchronously
    try {
      await triggerCardGeneration({
        jobId: createdJob.id, // We pass the newly created job's ID
        text: userInputText,
        cardType: jobType === "generate-cards" ? "qa" : undefined, // Pass cardType only if relevant
        // Model, etc. can be expanded based on jobType or other logic
      });

      // We do NOT mark job as "processing" here. The AI service will do that
      // via our webhook once it starts or completes the background work.

      return {
        isSuccess: true,
        data: {
          jobId: createdJob.id,
          inputText: userInputText,
        },
        message: "Job creation succeeded. AI service triggered.",
      };
    } catch (aiError) {
      console.error("Failed to contact AI service:", aiError);

      // If we cannot even initiate the job with the AI service, mark job "failed" immediately.
      await db
        .update(processingJobs)
        .set({
          status: "failed",
          errorMessage:
            aiError instanceof Error
              ? aiError.message
              : "Unknown error contacting AI service",
          completedAt: new Date(),
        })
        .where(eq(processingJobs.id, createdJob.id));

      return {
        isSuccess: false,
        message: "Failed to process with AI service",
        // You could optionally add an error field here too, e.g., error: { api: ["AI service unreachable"] }
      };
    }
  } catch (error) {
    console.error("Error in submitAiJobAction:", error);
    return {
      isSuccess: false,
      message:
        error instanceof Error ? error.message : "Error submitting AI job",
      // General error: error: { server: ["Unexpected error submitting job"] }
    };
  }
}

/**
 * @function listPendingJobsAction
 * @async
 * @description
 * Utility action that lists all pending jobs for the current user.
 * Useful for debugging or listing queued tasks in a dashboard.
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
      where: eq(processingJobs.userId, userId),
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

/**
 * @function getJobStatusAction
 * @async
 * @description
 * Retrieves the current status/results of a processing job.
 *
 * @param jobId The ID of the job to retrieve status for
 * @returns Promise<ActionState<{ status: string; results: any }>>
 * - isSuccess: whether the job status was successfully retrieved
 * - data: includes the job status and results payload (as 'results')
 * - message: success/error message
 * - error: any field validation errors
 */
export async function getJobStatusAction(
  jobId: string
): Promise<ActionState<{ status: string; results: any }>> {
  try {
    const { userId } = auth();
    if (!userId) {
      return {
        isSuccess: false,
        message: "You must be logged in to perform this action",
      };
    }

    // Validate job ID - Check if it's a non-empty string
    const parsed = z.string().min(1, "Job ID cannot be empty").safeParse(jobId);
    if (!parsed.success) {
      return {
        isSuccess: false,
        message: "Invalid job ID",
        error: { jobId: parsed.error.flatten().formErrors },
      };
    }

    // Retrieve job status from DB, ensuring user ownership
    const job = await db.query.processingJobs.findFirst({
      where: and(eq(processingJobs.id, parsed.data), eq(processingJobs.userId, userId)),
      columns: {
        status: true,
        resultPayload: true, // **FIX:** Changed 'results' to 'resultPayload'
        errorMessage: true,
        errorDetail: true,
        jobType: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!job) {
      return {
        isSuccess: false,
        message: "Job not found or unauthorized",
        error: { auth: ["Permission denied or job does not exist"] },
      };
    }


    // Return data with the correct structure expected by ActionState<...>
    return {
      isSuccess: true,
      data: {
        status: job.status,
        results: job.resultPayload, // **FIX:** Assign resultPayload to the 'results' key for the return type
      },
      message: "Job status retrieved successfully",
    };
  } catch (error) {
    console.error("Error fetching job status:", error);
    return {
      isSuccess: false,
      message: "Failed to retrieve job status",
      error: { server: ["An unexpected error occurred"] },
    };
  }
}