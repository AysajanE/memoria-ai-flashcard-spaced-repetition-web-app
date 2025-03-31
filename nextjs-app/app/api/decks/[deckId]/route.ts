import { auth } from "@clerk/nextjs";
import { db } from "@/db";
import { decks } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { NextResponse } from "next/server";
import { flashcards } from "@/db/schema";

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

    // Get the deck with card count
    const result = await db
      .select({
        ...decks,
        cardCount: count(flashcards.id),
      })
      .from(decks)
      .leftJoin(flashcards, eq(flashcards.deckId, decks.id))
      .where(and(
        eq(decks.id, deckId),
        eq(decks.userId, userId)
      ))
      .groupBy(decks.id);

    if (!result || result.length === 0) {
      return NextResponse.json(
        { error: "Deck not found or unauthorized" },
        { status: 404 }
      );
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error("Error fetching deck:", error);
    return NextResponse.json(
      { error: "Failed to fetch deck" },
      { status: 500 }
    );
  }
} 