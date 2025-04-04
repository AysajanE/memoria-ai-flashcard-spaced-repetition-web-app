// File: nextjs-app/app/api/decks/[deckId]/route.ts

import { auth } from "@clerk/nextjs";
import { db } from "@/db";
// Corrected import paths assuming schema files are directly under db/schema
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

    // Get the deck with card count
    const result = await db
      .select({
        deck: decks, // Select the whole decks table under the 'deck' key
        cardCount: count(flashcards.id), // Select the count
      })
      .from(decks)
      .leftJoin(flashcards, eq(flashcards.deckId, decks.id))
      .where(and(
        eq(decks.id, deckId), 
        eq(decks.userId, userId)
      ))
      .groupBy(
        decks.id, 
        decks.userId, 
        decks.name, 
        decks.createdAt, 
        decks.updatedAt 
        // Group by all selected non-aggregated columns from 'decks'
      ); 
      // Note: Added groupBy for all selected deck columns, which is usually required 
      // by PostgreSQL when using aggregates like count() without selecting ONLY aggregates.

    if (!result || result.length === 0) {
      return NextResponse.json(
        { error: "Deck not found or unauthorized" },
        { status: 404 }
      );
    }

    // Return the first result (should be unique by ID)
    // The structure is now { deck: { id, name, ... }, cardCount: number }
    return NextResponse.json(result[0]); 

  } catch (error) {
    console.error("Error fetching deck:", error);
    return NextResponse.json(
      { error: "Failed to fetch deck" },
      { status: 500 }
    );
  }
}