"use server";

import { auth } from "@clerk/nextjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { processingJobs } from "@/db/schema";
import { triggerCardGeneration } from "@/lib/ai-client";
import { GenerateCardsRequestSchema } from "@/lib/ai-client";

export type ActionState<TData = any> = {
  isSuccess: boolean;
  message?: string;
  data?: TData;
  error?: Record<string, string[]>;
};

export async function submitTextForCardsAction(
  formData: FormData
): Promise<ActionState<{ jobId: string }>> {
  try {
    const { userId } = auth();
    if (!userId) {
      return {
        isSuccess: false,
        message: "You must be logged in to generate cards",
        error: { auth: ["Authentication required"] },
      };
    }

    // Parse and validate input
    const text = formData.get("text") as string;
    const model = formData.get("model") as string;
    const cardType = formData.get("cardType") as string;
    const numCards = parseInt(formData.get("numCards") as string);

    const validatedData = GenerateCardsRequestSchema.parse({
      text,
      model,
      cardType,
      numCards,
    });

    // Create processing job record
    const [job] = await db
      .insert(processingJobs)
      .values({
        userId,
        status: "pending",
        jobType: "generate_cards",
        inputPayload: validatedData,
      })
      .returning();

    // Trigger AI service
    const response = await triggerCardGeneration(validatedData);

    // Update job with response
    await db
      .update(processingJobs)
      .set({
        status: "processing",
        externalJobId: response.jobId,
      })
      .where({ id: job.id });

    revalidatePath("/create");
    return {
      isSuccess: true,
      message: "Card generation started successfully",
      data: { jobId: job.id },
    };
  } catch (error) {
    console.error("Error submitting text for cards:", error);
    
    if (error instanceof z.ZodError) {
      return {
        isSuccess: false,
        message: "Invalid input data",
        error: error.formErrors.fieldErrors,
      };
    }

    return {
      isSuccess: false,
      message: error instanceof Error ? error.message : "Failed to submit text for cards",
      error: { submit: ["An unexpected error occurred"] },
    };
  }
} 