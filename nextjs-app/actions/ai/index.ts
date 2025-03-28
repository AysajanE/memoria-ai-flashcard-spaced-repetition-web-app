"use server";

import { auth } from "@clerk/nextjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Types for the action functions
export type ActionState<T> = {
  isSuccess: boolean;
  message?: string;
  data?: T;
  error?: Record<string, string[]>;
};

// Input validation schemas
const submitJobSchema = z.object({
  jobType: z.enum(["summarize", "generate-prompts"]),
  inputPayload: z.object({
    text: z.string().min(1, "Text is required"),
  }),
  documentId: z.string().optional(),
});

// Placeholder for an actual DB call
async function createJobRecord(userId: string, jobType: string, inputPayload: any) {
  // In a real implementation, this would create a record in the database
  console.log(`Creating job record for user ${userId}`);
  
  // For demo purposes, we'll just generate a random ID
  return {
    id: `job_${Math.random().toString(36).substring(2, 9)}`,
    userId,
    jobType,
    status: "pending",
    createdAt: new Date(),
  };
}

// Submit a job to the AI service
export async function submitAiJobAction(
  input: z.infer<typeof submitJobSchema>
): Promise<ActionState<{ jobId: string }>> {
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

    // Create job record in database
    const jobRecord = await createJobRecord(
      userId,
      validatedInput.data.jobType,
      validatedInput.data.inputPayload
    );

    // In a real implementation, this would make an API call to the AI service
    // For demo purposes, we'll just return the job ID
    
    return {
      isSuccess: true,
      data: { jobId: jobRecord.id },
    };
  } catch (error) {
    console.error("Error submitting AI job:", error);
    return {
      isSuccess: false,
      message: "Failed to submit job",
    };
  }
}

// Get the status of a job
export async function getJobStatusAction(
  jobId: string
): Promise<ActionState<{ status: string; result?: any; error?: string }>> {
  try {
    // Authentication check
    const { userId } = auth();
    if (!userId) {
      return {
        isSuccess: false,
        message: "You must be logged in to perform this action",
      };
    }

    // In a real implementation, this would fetch the job status from the database
    // For demo purposes, we'll just return a mock status
    
    // Simulate a job that completes after a few seconds
    // In a real app, this would query the database for actual status
    const mockStatuses = ["pending", "processing", "completed", "failed"];
    const randomStatus = mockStatuses[Math.floor(Math.random() * mockStatuses.length)];
    
    let result = null;
    let error = null;
    
    if (randomStatus === "completed") {
      result = {
        flashcards: [
          { 
            front: "What is spaced repetition?", 
            back: "A learning technique that involves increasing intervals of time between reviews of previously learned material."
          },
          {
            front: "Who developed the spaced repetition concept?",
            back: "The concept was developed by various researchers including Hermann Ebbinghaus and later refined by Sebastian Leitner."
          }
        ]
      };
    } else if (randomStatus === "failed") {
      error = "An error occurred during processing";
    }
    
    return {
      isSuccess: true,
      data: {
        status: randomStatus,
        result,
        error
      },
    };
  } catch (error) {
    console.error("Error getting job status:", error);
    return {
      isSuccess: false,
      message: "Failed to get job status",
    };
  }
} 