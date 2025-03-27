"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { processingJobs } from "@/db/schema";
import { triggerCardGeneration } from "@/lib/ai-client";
import { redirect } from "next/navigation";
import { ActionState } from "@/types";

export async function submitTextForCardsAction(
  text: string
): Promise<ActionState<{ jobId: string }>> {
  // Authentication check
  const { userId } = auth();
  if (!userId) {
    return {
      isSuccess: false,
      message: "Authentication required.",
    };
  }

  // Input validation
  if (!text.trim()) {
    return {
      isSuccess: false,
      message: "Please enter some text to generate cards from.",
      error: {
        text: ["Text is required"],
      },
    };
  }

  // TODO: Add credit check logic here in Phase 3

  let jobId: string;

  // DB Insert
  try {
    const [job] = await db
      .insert(processingJobs)
      .values({
        userId,
        status: "pending",
        jobType: "generate-cards",
        inputPayload: { inputText: text },
      })
      .returning({ id: processingJobs.id });

    jobId = job.id;
  } catch (error) {
    console.error("Failed to create processing job:", error);
    return {
      isSuccess: false,
      message: "Failed to initiate job. Please try again.",
    };
  }

  // Call AI Service
  try {
    await triggerCardGeneration({ jobId, text });
  } catch (error) {
    console.error("Failed to trigger AI processing:", error);
    // Update job status to failed
    await db
      .update(processingJobs)
      .set({
        status: "failed",
        errorMessage: "Failed to trigger AI processing",
      })
      .where({ id: jobId });

    return {
      isSuccess: false,
      message: "Failed to trigger AI processing. Please try again.",
    };
  }

  // Redirect to job status page
  redirect(`/create/${jobId}`);
} 