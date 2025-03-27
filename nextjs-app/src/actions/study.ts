"use server";

import { auth } from "@clerk/nextjs";
import { db } from "@/db";
import { flashcards, decks } from "@/db/schema";
import { ActionState } from "@/types";
import { eq, and, lte, asc } from "drizzle-orm";
import { calculateSrsData, type StudyRating } from "@/lib/srs";

const CARDS_PER_SESSION = 20;

export async function getDeckStudySessionAction(deckId: string): Promise<ActionState<{ deckName: string; cards: Flashcard[] }>> {
  try {
    const { userId } = auth();
    if (!userId) {
      return { isSuccess: false, message: "Unauthorized" };
    }

    // Validate deckId
    if (!deckId) {
      return { isSuccess: false, message: "Deck ID is required" };
    }

    // Query deck name and verify ownership
    const deck = await db.query.decks.findFirst({
      where: and(
        eq(decks.id, deckId),
        eq(decks.userId, userId)
      ),
      columns: {
        name: true,
      },
    });

    if (!deck) {
      return { isSuccess: false, message: "Deck not found or access denied" };
    }

    // Query due cards
    const dueCards = await db.query.flashcards.findMany({
      where: and(
        eq(flashcards.deckId, deckId),
        eq(flashcards.userId, userId),
        lte(flashcards.srsDueDate, new Date())
      ),
      orderBy: asc(flashcards.srsDueDate),
      limit: CARDS_PER_SESSION,
    });

    return {
      isSuccess: true,
      data: {
        deckName: deck.name,
        cards: dueCards,
      },
    };
  } catch (error) {
    console.error("Error fetching study session:", error);
    return { isSuccess: false, message: "Failed to fetch study session" };
  }
}

export async function recordStudyRatingAction(
  flashcardId: string,
  rating: StudyRating
): Promise<ActionState> {
  try {
    // Auth check
    const { userId } = auth();
    if (!userId) {
      return {
        isSuccess: false,
        message: "You must be logged in to record study ratings."
      };
    }

    // Validate inputs
    if (!flashcardId || !rating) {
      return {
        isSuccess: false,
        message: "Missing required fields.",
        error: {
          flashcardId: ["Flashcard ID is required"],
          rating: ["Rating is required"]
        }
      };
    }

    // Fetch current card
    const [currentCard] = await db
      .select()
      .from(flashcards)
      .where(eq(flashcards.id, flashcardId));

    if (!currentCard) {
      return {
        isSuccess: false,
        message: "Flashcard not found."
      };
    }

    // Verify ownership
    if (currentCard.userId !== userId) {
      return {
        isSuccess: false,
        message: "You don't have permission to update this flashcard."
      };
    }

    // Calculate new SRS data
    const { newInterval, newEaseFactor, newDueDate } = calculateSrsData(
      currentCard,
      rating
    );

    // Update database
    await db
      .update(flashcards)
      .set({
        srsInterval: newInterval,
        srsEaseFactor: newEaseFactor,
        srsDueDate: newDueDate,
        updatedAt: new Date()
      })
      .where(eq(flashcards.id, flashcardId));

    // TODO: Update user stats in users table
    // - Increment daily study count
    // - Update accuracy based on rating
    // - Update streak if applicable
    // - Update lastStudiedAt

    return {
      isSuccess: true,
      message: "Study rating recorded successfully."
    };
  } catch (error) {
    console.error("Error recording study rating:", error);
    return {
      isSuccess: false,
      message: "Failed to record study rating. Please try again."
    };
  }
} 