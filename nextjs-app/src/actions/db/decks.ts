/**
 * @file decks.ts
 * @description
 *  Provides server actions related to Deck management in Memoria. 
 *  This includes fetching the user’s decks, creating new decks, and 
 *  the critical "reviewCardsAction" that saves AI-generated flashcards 
 *  to the selected deck after the user approves them.
 *
 * @dependencies
 *  - Drizzle ORM for database interaction
 *  - Clerk for user authentication (auth())
 *  - Zod for input validation
 *
 * @notes
 *  - We renamed "saveJobFlashcardsAction" to "reviewCardsAction" to match 
 *    the plan's wording. This function is responsible for the final step 
 *    of assigning approved flashcards to a deck once the user confirms 
 *    or creates a new deck in the ApproveDialog.
 */

"use server";

import { auth } from "@clerk/nextjs";
import { db } from "@/db";
import { decks, flashcards, processingJobs, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ActionState } from "@/types";
import { Deck } from "@/types";
import { z } from "zod";

// -------------- GET DECKS ACTION --------------
/**
 * @function getDecksAction
 * @async
 * @description
 *  Fetches all decks belonging to the current user.
 *
 * @returns {Promise<ActionState<Deck[]>>}
 *  isSuccess: Whether the operation succeeded.
 *  data: Array of Deck objects if successful.
 *  message: Error message if any issue arises.
 */
export async function getDecksAction(): Promise<ActionState<Deck[]>> {
  try {
    const { userId } = auth();
    if (!userId) {
      return {
        isSuccess: false,
        message: "Unauthorized",
      };
    }

    const userDecks = await db
      .select()
      .from(decks)
      .where(eq(decks.userId, userId));

    return {
      isSuccess: true,
      data: userDecks,
    };
  } catch (error) {
    console.error("Error fetching decks:", error);
    return {
      isSuccess: false,
      message: "Failed to fetch decks",
    };
  }
}

// -------------- CREATE DECK ACTION --------------
/**
 * Zod schema for creating a deck. 
 * We limit name length to 100 as a basic constraint.
 */
const CreateDeckSchema = z.object({
  name: z
    .string()
    .min(1, "Deck name is required")
    .max(100, "Deck name is too long"),
});

/**
 * @function createDeckAction
 * @async
 * @description
 *  Creates a new deck for the current user, assigning userId from Clerk’s auth().
 *
 * @param name The user-provided deck name (validated by Zod).
 * @returns {Promise<ActionState<{ deckId: string }>>}
 *  isSuccess: Whether the creation succeeded.
 *  data.deckId: The new deck’s ID if created successfully.
 *  message: Optional status or error info.
 */
export async function createDeckAction(
  name: string
): Promise<ActionState<{ deckId: string }>> {
  try {
    const { userId } = auth();
    if (!userId) {
      return {
        isSuccess: false,
        message: "Unauthorized",
      };
    }

    // Validate input
    const validatedData = CreateDeckSchema.parse({ name });

    // Create new deck
    const [newDeck] = await db
      .insert(decks)
      .values({
        name: validatedData.name,
        userId,
      })
      .returning({ id: decks.id });

    return {
      isSuccess: true,
      message: "Deck created successfully",
      data: { deckId: newDeck.id },
    };
  } catch (error) {
    console.error("Error creating deck:", error);

    if (error instanceof z.ZodError) {
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
      message: error instanceof Error ? error.message : "Failed to create deck",
    };
  }
}

// -------------- REVIEW CARDS ACTION (Renamed) --------------
/**
 * @function reviewCardsAction
 * @async
 * @description
 *  Called after the user clicks "Approve & Assign" in the flashcard generation 
 *  flow. Retrieves the completed AI job from the DB (must be status='completed'), 
 *  extracts the cards, and saves them into a user-chosen or newly created deck.
 *
 * @param jobId The ID of the AI processing job
 * @param deckNameOrId Either an existing deckId or a string representing a new deck name
 * @param isExistingDeck If true, we interpret deckNameOrId as an existing deck's ID. Otherwise, it's a new deck name.
 * @returns {Promise<ActionState<{ deckId: string }>>}
 *  isSuccess: true if the flashcards were saved successfully.
 *  data.deckId: the deck to which the flashcards were assigned.
 */
export async function reviewCardsAction(
  jobId: string,
  deckNameOrId: string,
  isExistingDeck: boolean = false
): Promise<ActionState<{ deckId: string }>> {
  try {
    const { userId } = auth();

    if (!userId) {
      return {
        isSuccess: false,
        message: "Not authenticated",
        error: { auth: ["You must be signed in to save flashcards"] },
      };
    }

    // Get the processing job result
    const job = await db.query.processingJobs.findFirst({
      where: eq(processingJobs.id, jobId),
    });

    if (!job) {
      return {
        isSuccess: false,
        message: "Job not found",
        error: { job: ["The processing job could not be found"] },
      };
    }

    // Verify job belongs to the current user
    if (job.userId !== userId) {
      return {
        isSuccess: false,
        message: "Unauthorized",
        error: { auth: ["You do not have permission to access this job"] },
      };
    }

    // Check if job was completed successfully
    if (job.status !== "completed" || !job.resultPayload) {
      return {
        isSuccess: false,
        message: "Job not completed",
        error: { job: ["The processing job did not complete successfully"] },
      };
    }

    // Expect the AI result payload to contain "cards" 
    // which is an array of { front, back, type }
    type GeneratedCard = {
      front: string;
      back: string;
      type?: string;
    };

    const resultPayload = job.resultPayload as { cards?: GeneratedCard[] };
    const cards = resultPayload.cards;

    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return {
        isSuccess: false,
        message: "No flashcards found",
        error: { cards: ["No flashcards were found in the job result"] },
      };
    }

    // If the user wants to use an existing deck
    if (isExistingDeck) {
      // Verify the deck exists and belongs to the user
      const existingDeck = await db.query.decks.findFirst({
        where: eq(decks.id, deckNameOrId),
      });

      if (!existingDeck) {
        return {
          isSuccess: false,
          message: "Deck not found",
          error: { deck: ["The selected deck could not be found"] },
        };
      }

      if (existingDeck.userId !== userId) {
        return {
          isSuccess: false,
          message: "Unauthorized",
          error: { auth: ["You do not have permission to access this deck"] },
        };
      }

      // Add cards to existing deck
      await db.insert(flashcards).values(
        cards.map((card) => ({
          deckId: existingDeck.id,
          userId,
          front: card.front,
          back: card.back,
          cardType: card.type === "cloze" ? "cloze" : "qa",
        }))
      );

      // Update job to reflect a changed updatedAt (job remains "completed")
      // so we track that the user assigned the cards
      await db.update(processingJobs).set({
        updatedAt: new Date(),
      }).where(eq(processingJobs.id, jobId));

      return {
        isSuccess: true,
        message: "Flashcards added to existing deck successfully",
        data: { deckId: existingDeck.id },
      };
    }

    // Otherwise, create a new deck and add the cards
    // We'll do a transaction so the deck and flashcards are created atomically
    const createdDeck = await db.transaction(async (tx) => {
      const [newDeck] = await tx.insert(decks).values({
        userId,
        name: deckNameOrId || "Untitled Deck",
      }).returning();

      await tx.insert(flashcards).values(
        cards.map((card) => ({
          deckId: newDeck.id,
          userId,
          front: card.front,
          back: card.back,
          cardType: card.type === "cloze" ? "cloze" : "qa",
        }))
      );

      return newDeck;
    });

    // Also update the job's updatedAt
    await db
      .update(processingJobs)
      .set({ updatedAt: new Date() })
      .where(eq(processingJobs.id, jobId));

    return {
      isSuccess: true,
      message: "New deck created and flashcards saved",
      data: { deckId: createdDeck.id },
    };
  } catch (error) {
    console.error("Error saving job flashcards to deck:", error);
    return {
      isSuccess: false,
      message: "Failed to save flashcards",
      error: { server: ["An unexpected error occurred"] },
    };
  }
}
