"use server";

import { auth } from "@clerk/nextjs";
import { db } from "@/db";
import { decks } from "@/db/schema";
import { eq, count } from "drizzle-orm";

// Add imports for flashcards
import { flashcards, processingJobs } from "@/db/schema";
import { z } from "zod";

export async function getDecksAction() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return {
        isSuccess: false,
        message: "Not authenticated",
        error: { auth: ["You must be signed in to view decks"] }
      };
    }

    const userDecks = await db.query.decks.findMany({
      where: eq(decks.userId, userId),
      orderBy: (decks, { desc }) => [desc(decks.updatedAt)]
    });

    return {
      isSuccess: true,
      data: userDecks
    };
  } catch (error) {
    console.error("Error fetching decks:", error);
    return {
      isSuccess: false,
      message: "Failed to fetch decks",
      error: { server: ["An unexpected error occurred"] }
    };
  }
}

// Get decks with card counts
export async function getDecksWithCardCountsAction() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return {
        isSuccess: false,
        message: "Not authenticated",
        error: { auth: ["You must be signed in to view decks"] }
      };
    }

    // Query decks with card counts
    const userDecks = await db
      .select({
        id: decks.id,
        name: decks.name,
        userId: decks.userId,
        createdAt: decks.createdAt,
        updatedAt: decks.updatedAt,
        cardCount: count(flashcards.id)
      })
      .from(decks)
      .leftJoin(flashcards, eq(flashcards.deckId, decks.id))
      .where(eq(decks.userId, userId))
      .groupBy(decks.id)
      .orderBy(decks.updatedAt);

    return {
      isSuccess: true,
      data: userDecks
    };
  } catch (error) {
    console.error("Error fetching decks with card counts:", error);
    return {
      isSuccess: false,
      message: "Failed to fetch decks",
      error: { server: ["An unexpected error occurred"] }
    };
  }
}

// Zod schema for creating a deck
const createDeckSchema = z.object({
  name: z.string().min(1, "Deck name is required"),
  cards: z.array(z.object({
    front: z.string().min(1, "Front of card is required"),
    back: z.string().min(1, "Back of card is required"),
    cardType: z.enum(["qa", "cloze"]).default("qa")
  })).min(1, "At least one flashcard is required")
});

export async function createDeckWithFlashcardsAction(input: z.infer<typeof createDeckSchema>) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return {
        isSuccess: false,
        message: "Not authenticated",
        error: { auth: ["You must be signed in to create a deck"] }
      };
    }

    // Validate input
    const validatedInput = createDeckSchema.safeParse(input);
    if (!validatedInput.success) {
      return {
        isSuccess: false,
        message: "Invalid input",
        error: validatedInput.error.flatten().fieldErrors
      };
    }

    // Use a transaction to create the deck and add flashcards
    return await db.transaction(async (tx) => {
      // Create deck
      const [newDeck] = await tx.insert(decks).values({
        userId,
        name: validatedInput.data.name
      }).returning();

      // Add flashcards to the deck
      if (newDeck && validatedInput.data.cards.length > 0) {
        await tx.insert(flashcards).values(
          validatedInput.data.cards.map(card => ({
            deckId: newDeck.id,
            userId,
            front: card.front,
            back: card.back,
            cardType: card.cardType
          }))
        );
      }

      return {
        isSuccess: true,
        message: "Deck created successfully",
        data: newDeck
      };
    });
  } catch (error) {
    console.error("Error creating deck with flashcards:", error);
    return {
      isSuccess: false,
      message: "Failed to create deck",
      error: { server: ["An unexpected error occurred"] }
    };
  }
}

// Function to save flashcards from a completed job
export async function saveJobFlashcardsAction(jobId: string, deckNameOrId: string, isExistingDeck: boolean = false) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return {
        isSuccess: false,
        message: "Not authenticated",
        error: { auth: ["You must be signed in to save flashcards"] }
      };
    }

    // Get the processing job result
    const job = await db.query.processingJobs.findFirst({
      where: eq(processingJobs.id, jobId)
    });

    if (!job) {
      return {
        isSuccess: false,
        message: "Job not found",
        error: { job: ["The processing job could not be found"] }
      };
    }

    // Verify job belongs to the current user
    if (job.userId !== userId) {
      return {
        isSuccess: false,
        message: "Unauthorized",
        error: { auth: ["You do not have permission to access this job"] }
      };
    }

    // Check if job was completed successfully
    if (job.status !== "completed" || !job.resultPayload) {
      return {
        isSuccess: false,
        message: "Job not completed",
        error: { job: ["The processing job did not complete successfully"] }
      };
    }

    // Extract cards from result payload
    // Using type assertion to handle the resultPayload which is stored as a JSON object
    const resultPayload = job.resultPayload as { cards?: Array<{ front: string; back: string; type?: string }> };
    const cards = resultPayload.cards;
    
    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return {
        isSuccess: false,
        message: "No flashcards found",
        error: { cards: ["No flashcards were found in the job result"] }
      };
    }

    // Handle adding to existing deck vs creating new deck
    if (isExistingDeck) {
      // Verify the deck exists and belongs to the user
      const existingDeck = await db.query.decks.findFirst({
        where: eq(decks.id, deckNameOrId)
      });

      if (!existingDeck) {
        return {
          isSuccess: false,
          message: "Deck not found",
          error: { deck: ["The selected deck could not be found"] }
        };
      }

      if (existingDeck.userId !== userId) {
        return {
          isSuccess: false,
          message: "Unauthorized",
          error: { auth: ["You do not have permission to access this deck"] }
        };
      }

      // Add cards to existing deck
      await db.insert(flashcards).values(
        cards.map(card => ({
          deckId: existingDeck.id,
          userId,
          front: card.front,
          back: card.back,
          cardType: (card.type === "cloze" ? "cloze" : "qa") as "qa" | "cloze"
        }))
      );

      // Update job to record that cards were saved
      await db.update(processingJobs)
        .set({
          updatedAt: new Date()
        })
        .where(eq(processingJobs.id, jobId));

      return {
        isSuccess: true,
        message: "Flashcards added to existing deck successfully",
        data: existingDeck
      };
    } else {
      // Create a new deck with the cards
      return await createDeckWithFlashcardsAction({
        name: deckNameOrId || "Untitled Deck",
        cards: cards.map(card => ({
          front: card.front,
          back: card.back,
          cardType: (card.type === "cloze" ? "cloze" : "qa") as "qa" | "cloze"
        }))
      });
    }
  } catch (error) {
    console.error("Error saving job flashcards to deck:", error);
    return {
      isSuccess: false,
      message: "Failed to save flashcards",
      error: { server: ["An unexpected error occurred"] }
    };
  }
} 