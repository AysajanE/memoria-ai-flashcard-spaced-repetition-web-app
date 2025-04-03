/**
 * @file submit-text.ts
 * @description
 *  This server action accepts form data (text, model, cardType, numCards),
 *  creates a new processing job with status "pending," then calls the AI service.
 *  It is an alternative or simpler version of job submission.
 *
 * Key Responsibilities:
 *  - Validate input from FormData
 *  - Create a new job record in processingJobs
 *  - Trigger the AI microservice asynchronously
 *  - Return the jobId to the caller
 *
 * @dependencies
 *  - Clerk auth() to ensure user is logged in
 *  - Drizzle (db, processingJobs)
 *  - zod for input validation
 *  - triggerCardGeneration from "@/lib/ai-client"
 *
 * @notes
 *  - This file does not contain any leftover placeholder logic to remove.
 *  - Everything here references real AI service calls via `triggerCardGeneration`.
 */

"use server";

import { auth } from "@clerk/nextjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { processingJobs } from "@/db/schema";
import { triggerCardGeneration, FormInputSchema } from "@/lib/ai-client";

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

    const validatedData = FormInputSchema.parse({
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
        jobType: "generate-cards",
        inputPayload: validatedData,
      })
      .returning();

    // Trigger AI service
    const response = await triggerCardGeneration({
      jobId: job.id,
      text: validatedData.text,
      model: validatedData.model,
      cardType: validatedData.cardType,
      numCards: validatedData.numCards,
    });

    // Mark job as "processing"
    await db
      .update(processingJobs)
      .set({
        status: "processing",
        // We could store external job ID from AI service if needed
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
