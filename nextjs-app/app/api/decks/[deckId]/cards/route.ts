import { auth } from "@clerk/nextjs";
import { db } from "@/db";
import { decks } from "@/db/schema/decks";
import { flashcards } from "@/db/schema/flashcards";
import { eq, and, count } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { deckId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const deckId = params.deckId;
    if (!deckId) {
      return NextResponse.json(
        { error: "Deck ID is required" },
        { status: 400 }
      );
    }

    // First verify the deck exists and belongs to the user
    const deck = await db.query.decks.findFirst({
      where: and(
        eq(decks.id, deckId),
        eq(decks.userId, userId)
      ),
    });

    if (!deck) {
      return NextResponse.json(
        { error: "Deck not found or unauthorized" },
        { status: 404 }
      );
    }

    // Get the flashcards for the deck
    const cards = await db.query.flashcards.findMany({
      where: and(
        eq(flashcards.deckId, deckId),
        eq(flashcards.userId, userId)
      ),
      orderBy: (flashcards, { asc }) => [asc(flashcards.createdAt)]
    });

    // Include count in the response
    return NextResponse.json({
      cards,
      count: cards.length
    });
  } catch (error) {
    console.error("Error fetching flashcards:", error);
    return NextResponse.json(
      { error: "Failed to fetch flashcards" },
      { status: 500 }
    );
  }
} 