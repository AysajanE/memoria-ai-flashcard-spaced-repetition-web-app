"use server";

import { auth } from "@clerk/nextjs";
import { db } from "@/db";
import { decks } from "@/db/schema";
import { eq } from "drizzle-orm";

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