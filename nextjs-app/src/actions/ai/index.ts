"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { processingJobs, decks, flashcards } from "@/db/schema";
import { triggerCardGeneration } from "@/lib/ai-client";
import { redirect } from "next/navigation";
import { ActionState } from "@/types";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { FlashcardData } from "@/types";

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
      .where(eq(processingJobs.id, jobId));

    return {
      isSuccess: false,
      message: "Failed to trigger AI processing. Please try again.",
    };
  }

  // Redirect to job status page
  redirect(`/create/${jobId}`);
}

const ReviewCardsSchema = z.object({
  jobId: z.string().uuid(),
  reviewedCardsData: z
    .array(
      z.object({
        front: z
          .string()
          .min(1, "Front text is required")
          .max(1000, "Front text is too long"),
        back: z
          .string()
          .min(1, "Back text is required")
          .max(1000, "Back text is too long"),
        type: z.enum(["qa", "cloze"]).default("qa"),
      })
    )
    .min(1, "At least one card is required")
    .max(100, "Too many cards"),
  targetDeck: z
    .object({
      id: z.string().uuid().optional(),
      name: z
        .string()
        .min(1, "Deck name is required")
        .max(100, "Deck name is too long")
        .optional(),
    })
    .refine((data) => data.id || data.name, {
      message: "Either deck ID or name must be provided",
    }),
});

export async function reviewCardsAction(
  jobId: string,
  reviewedCardsData: FlashcardData[],
  targetDeck: { id?: string; name?: string }
): Promise<ActionState<{ deckId: string }>> {
  try {
    // Authentication check
    const { userId } = auth();
    if (!userId) {
      return {
        isSuccess: false,
        message: "Authentication required.",
      };
    }

    // Validate input
    const validatedData = ReviewCardsSchema.parse({
      jobId,
      reviewedCardsData,
      targetDeck,
    });

    // Verify job exists and belongs to user
    const job = await db.query.processingJobs.findFirst({
      where: and(
        eq(processingJobs.id, validatedData.jobId),
        eq(processingJobs.userId, userId)
      ),
    });

    if (!job) {
      return {
        isSuccess: false,
        message: "Job not found or unauthorized.",
      };
    }

    if (job.status !== "completed") {
      return {
        isSuccess: false,
        message: "Job must be completed before reviewing cards.",
      };
    }

    // Use a transaction to ensure data consistency
    const result = await db.transaction(async (tx) => {
      let finalDeckId: string;

      // Find or create deck
      if (validatedData.targetDeck.id) {
        // Verify deck exists and belongs to user
        const existingDeck = await tx.query.decks.findFirst({
          where: and(
            eq(decks.id, validatedData.targetDeck.id),
            eq(decks.userId, userId)
          ),
        });

        if (!existingDeck) {
          throw new Error("Deck not found or unauthorized");
        }

        finalDeckId = validatedData.targetDeck.id;
      } else {
        // Create new deck
        const [newDeck] = await tx
          .insert(decks)
          .values({
            name: validatedData.targetDeck.name!,
            userId,
          })
          .returning({ id: decks.id });

        finalDeckId = newDeck.id;
      }

      // Prepare flashcard data
      const preparedFlashcards = validatedData.reviewedCardsData.map(
        (card) => ({
          deckId: finalDeckId,
          userId,
          front: card.front,
          back: card.back,
          cardType: card.type || "qa",
          srsLevel: 0,
          srsInterval: 0,
          srsEaseFactor: "2.50",
          srsDueDate: new Date(),
        })
      );

      // Insert flashcards
      await tx.insert(flashcards).values(preparedFlashcards);

      // Update job status to note that the cards have been saved to a deck
      await tx
        .update(processingJobs)
        .set({
          updatedAt: new Date(),
          status: "completed",
          resultMetadata: { 
            ...job.resultMetadata,
            savedToDeck: finalDeckId,
            savedAt: new Date().toISOString()
          },
        })
        .where(eq(processingJobs.id, validatedData.jobId));

      return finalDeckId;
    });

    return {
      isSuccess: true,
      message: "Cards saved successfully",
      data: { deckId: result },
    };
  } catch (error) {
    console.error("Error in reviewCardsAction:", error);

    if (error instanceof z.ZodError) {
      // Create a clean object without undefined values
      const cleanFieldErrors: Record<string, string[]> = {};
      
      Object.entries(error.formErrors.fieldErrors).forEach(([key, value]) => {
        if (value !== undefined) {
          cleanFieldErrors[key] = value;
        }
      });
      
      return {
        isSuccess: false,
        message: "Invalid input data",
        error: cleanFieldErrors,
      };
    }

    return {
      isSuccess: false,
      message: error instanceof Error ? error.message : "Failed to save cards",
    };
  }
}
