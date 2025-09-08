/**
 * @file submit-text.ts
 * @description
 * This server action accepts form data (text, model, cardType, numCards),
 * creates a new processing job with status "pending," then calls the AI service.
 * It is an alternative or simpler version of job submission.
 * 
 * Key Responsibilities:
 * - Validate input from FormData
 * - Create a new job record in processingJobs
 * - Trigger the AI microservice asynchronously
 * - Return the jobId to the caller
 * 
 * @dependencies
 * - Clerk auth() to ensure user is logged in
 * - Drizzle (db, processingJobs, eq)
 * - zod for input validation
 * - triggerCardGeneration from "@/lib/ai-client"
 * 
 * @notes
 * - This file does not contain any leftover placeholder logic to remove.
 * - Everything here references real AI service calls via `triggerCardGeneration`.
 */

"use server";

import { auth } from "@clerk/nextjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { processingJobs } from "@/db/schema";
import { triggerCardGeneration, FormInputSchema } from "@/lib/ai-client";

// Define ActionState locally or import from '@/types' if defined there
// Ensure its 'error' type is: error?: Record<string, string[]> | null;
export type ActionState<TData = any> = {
  isSuccess: boolean;
  message?: string;
  data?: TData;
  error?: Record<string, string[]> | null; // Ensure this definition matches
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
    const numCardsRaw = formData.get("numCards");
    const numCards = numCardsRaw ? parseInt(numCardsRaw as string, 10) : 10;

    const validatedData = FormInputSchema.safeParse({
      text,
      model: model || undefined,
      cardType: cardType || undefined,
      numCards: isNaN(numCards) ? undefined : numCards,
    });

    if (!validatedData.success) {
      // **FIX:** Clean the fieldErrors using Object.entries instead of Object.keys
      const fieldErrors = validatedData.error.flatten().fieldErrors;
      const cleanFieldErrors: Record<string, string[]> = {};

      for (const [key, value] of Object.entries(fieldErrors)) {
        if (value !== undefined) {
          cleanFieldErrors[key] = value as string[];
        }
      }

      return {
        isSuccess: false,
        message: "Invalid input data",
        error: cleanFieldErrors, // Assign the cleaned object
      };
    }

    // Create processing job record
    const [job] = await db
      .insert(processingJobs)
      .values({
        userId,
        status: "pending",
        jobType: "generate-cards",
        inputPayload: validatedData.data,
      })
      .returning();

    if (!job || !job.id) {
      throw new Error("Failed to create processing job record in database.");
    }

    // Trigger AI service
    await triggerCardGeneration({
      jobId: job.id,
      text: validatedData.data.text,
      model: validatedData.data.model,
      cardType: validatedData.data.cardType,
      numCards: validatedData.data.numCards,
    });

    revalidatePath("/create");
    revalidatePath(`/create/${job.id}`);

    return {
      isSuccess: true,
      message: "Card generation started successfully",
      data: { jobId: job.id },
    };
  } catch (error) {
    console.error("Error submitting text for cards:", error);

    if (error instanceof z.ZodError) {
      // **FIX (Consistent Application):** Clean fieldErrors using Object.entries
      const fieldErrors = error.flatten().fieldErrors;
      const cleanFieldErrors: Record<string, string[]> = {};
      for (const [key, value] of Object.entries(fieldErrors)) {
        if (value !== undefined) {
          cleanFieldErrors[key] = value as string[];
        }
      }
      return {
        isSuccess: false,
        message: "Invalid input data",
        error: cleanFieldErrors, // Assign cleaned object
      };
    }

    // Handle generic errors
    return {
      isSuccess: false,
      message: error instanceof Error ? error.message : "Failed to submit text for cards",
      error: { submit: ["An unexpected error occurred"] },
    };
  }
}
