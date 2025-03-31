"use server";

import { auth } from "@clerk/nextjs";
import { db } from "@/db";
import { decks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ActionState } from "@/types";
import { Deck } from "@/types";
import { z } from "zod";

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

// Schema for deck creation
const CreateDeckSchema = z.object({
  name: z.string().min(1, "Deck name is required").max(100, "Deck name is too long"),
});

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
