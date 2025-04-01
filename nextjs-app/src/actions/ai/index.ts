/**
 * @file index.ts
 * @description
 *  This file contains AI-related server actions for Memoria's Next.js app, including:
 *  - submitAiJobAction: Orchestrates creation of a processing job and triggers the AI service
 *  - getJobStatusAction: Retrieves the current status/results of a processing job
 *  - listPendingJobsAction: Debug utility to list all pending jobs for the logged-in user
 * 
 * @dependencies
 *  - Drizzle ORM (db, processingJobs schema, users schema)
 *  - Clerk auth()
 *  - ActionState type from our shared types
 *  - Our AI service client (triggerCardGeneration)
 * 
 * @notes
 *  - We removed repeated user creation logic that used to check if a user existed in DB and create them if not.
 *    Now we rely solely on the Clerk webhook or other mechanisms to ensure the DB has a record for each user.
 *  - Always ensure user is authenticated (userId must exist). Return an error if not.
 *  - This file includes multiple server actions, all of which must return a Promise<ActionState<T>>.
 */

"use server";

import { auth } from "@clerk/nextjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { processingJobs, users } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { ActionState } from "@/types";
import { triggerCardGeneration } from "@/lib/ai-client";

/**
 * Input validation schema for job submission.
 *  - jobType: 'summarize' or 'generate-prompts' (Legacy placeholders)
 *  - inputPayload: includes text content
 */
const submitJobSchema = z.object({
  jobType: z.enum(["summarize", "generate-prompts"]),
  inputPayload: z.object({
    text: z.string().min(1, "Text is required"),
  }),
  documentId: z.string().optional(),
});

/**
 * Creates a new AI job in the database and triggers the Python AI service (async).
 * 
 * @param input - jobType, inputPayload, optional documentId
 * @returns ActionState with { jobId, inputText } if success
 */
export async function submitAiJobAction(
  input: z.infer<typeof submitJobSchema>
): Promise<ActionState<{ jobId: string; inputText: string }>> {
  try {
    // Authentication check
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

    // Extract text to store
    const userInputText = validatedInput.data.inputPayload.text;

    // 1) Create the job record in processingJobs
    let jobRecord;
    try {
      const [job] = await db.insert(processingJobs).values({
        userId,
        jobType: "generate-cards", // We unify around 'generate-cards'
        status: "pending",
        inputPayload: {
          text: userInputText,
          type: validatedInput.data.jobType,
        },
      })
      .returning({
        id: processingJobs.id,
      });
      jobRecord = job;
    } catch (error) {
      console.error("Error creating job record:", error);
      return {
        isSuccess: false,
        message: "Failed to create job record",
      };
    }

    // 2) Call the AI service
    try {
      // We can pick a provider or model based on jobType, but for now let's pick defaults:
      const provider = validatedInput.data.jobType === "summarize" ? "openai" : "anthropic";
      const model = provider === "openai" ? "gpt-4o-mini" : "claude-haiku-3-5-latest";
      
      await triggerCardGeneration({
        jobId: jobRecord.id,
        text: userInputText,
        model,
        cardType: "qa",
        numCards: 5,
      });

      return {
        isSuccess: true,
        data: {
          jobId: jobRecord.id,
          inputText: userInputText,
        },
      };
    } catch (aiError) {
      console.error("AI service request failed:", aiError);

      // Update job status to failed
      await db.update(processingJobs)
        .set({
          status: "failed",
          errorMessage: `Failed to submit to AI service: ${
            aiError instanceof Error ? aiError.message : String(aiError)
          }`,
          completedAt: new Date(),
        })
        .where(eq(processingJobs.id, jobRecord.id));

      return {
        isSuccess: false,
        message: "Failed to process with AI service",
      };
    }
  } catch (error) {
    console.error("Error submitting AI job:", error);
    return {
      isSuccess: false,
      message: "Failed to submit job",
    };
  }
}

/**
 * Retrieves the status of a job from the DB, verifying user ownership.
 * 
 * @param jobId string - the job's UUID
 * @returns ActionState with { status: string; result?: any; error?: string }
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

    // Basic format check
    if (!jobId) {
      return {
        isSuccess: false,
        message: "Invalid job ID",
      };
    }

    // Fetch the job from DB
    const job = await db.query.processingJobs.findFirst({
      where: and(eq(processingJobs.id, jobId), eq(processingJobs.userId, userId)),
    });
    if (!job) {
      return {
        isSuccess: false,
        message: "Job not found or unauthorized",
      };
    }

    return {
      isSuccess: true,
      data: {
        status: job.status,
        result: job.resultPayload ?? undefined,
        error: job.errorMessage ?? undefined,
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
 * Debug function: Lists all 'pending' jobs for the authenticated user.
 * 
 * @returns ActionState with an array of pending jobs
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

    // Fetch all pending jobs for the user
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
