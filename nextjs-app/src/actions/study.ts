"use server";

import { auth } from "@clerk/nextjs";
import { db } from "@/db";
import { flashcards, decks } from "@/db/schema";
import { ActionState } from "@/types";
import { eq, and, lte, asc } from "drizzle-orm";

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