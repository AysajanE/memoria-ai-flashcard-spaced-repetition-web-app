"use server";

import { auth } from "@clerk/nextjs";
import { db } from "@/db/db";
import { decks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ActionState } from "@/types";
import { Deck } from "@/types";

export async function getDecksAction(): Promise<ActionState<Deck[]>> {
  try {
    const { userId } = auth();
    if (!userId) {
      return {
        isSuccess: false,
        message: "Unauthorized",
      };
    }

    const userDecks = await db.select().from(decks).where(eq(decks.userId, userId));

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