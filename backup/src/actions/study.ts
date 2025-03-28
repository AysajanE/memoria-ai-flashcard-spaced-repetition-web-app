"use server";

import { auth } from "@clerk/nextjs";
import { db } from "@/db";
import { flashcards, users } from "@/db/schema";
import { eq, and, lte } from "drizzle-orm";
import { ActionState } from "@/types";
import { z } from "zod";

const RatingSchema = z.enum(["Again", "Hard", "Good", "Easy"]);

export async function getStudyCardsAction(deckId: string): Promise<ActionState<{ id: string; front: string; back: string }[]>> {
  try {
    const { userId } = auth();
    if (!userId) {
      return {
        isSuccess: false,
        message: "Authentication required",
      };
    }

    // Get cards that are due for review (due date <= now)
    const now = new Date();
    const dueCards = await db.query.flashcards.findMany({
      where: and(
        eq(flashcards.deckId, deckId),
        eq(flashcards.userId, userId),
        lte(flashcards.srsDueDate, now)
      ),
      orderBy: flashcards.srsDueDate,
    });

    return {
      isSuccess: true,
      data: dueCards.map(card => ({
        id: card.id,
        front: card.front,
        back: card.back,
      })),
    };
  } catch (error) {
    console.error("Error fetching study cards:", error);
    return {
      isSuccess: false,
      message: "Failed to fetch study cards",
    };
  }
}

export async function recordStudyRatingAction(
  cardId: string,
  rating: "Again" | "Hard" | "Good" | "Easy"
): Promise<ActionState<void>> {
  try {
    const { userId } = auth();
    if (!userId) {
      return {
        isSuccess: false,
        message: "Authentication required",
      };
    }

    // Validate input
    const validatedRating = RatingSchema.parse(rating);

    // Verify card exists and belongs to user
    const card = await db.query.flashcards.findFirst({
      where: eq(flashcards.id, cardId),
    });

    if (!card || card.userId !== userId) {
      return {
        isSuccess: false,
        message: "Card not found or unauthorized",
      };
    }

    // Calculate new SRS values based on rating
    const now = new Date();
    let newSrsLevel = card.srsLevel;
    let newSrsInterval = card.srsInterval;
    let newSrsEaseFactor = parseFloat(card.srsEaseFactor);

    switch (validatedRating) {
      case "Again":
        newSrsLevel = 0;
        newSrsInterval = 0;
        newSrsEaseFactor = Math.max(1.3, newSrsEaseFactor - 0.2);
        break;
      case "Hard":
        newSrsInterval = Math.max(1, Math.round(newSrsInterval * 1.2));
        newSrsEaseFactor = Math.max(1.3, newSrsEaseFactor - 0.15);
        break;
      case "Good":
        if (newSrsLevel === 0) {
          newSrsInterval = 1;
        } else {
          newSrsInterval = Math.round(newSrsInterval * newSrsEaseFactor);
        }
        newSrsLevel += 1;
        break;
      case "Easy":
        if (newSrsLevel === 0) {
          newSrsInterval = 4;
        } else {
          newSrsInterval = Math.round(newSrsInterval * newSrsEaseFactor * 1.3);
        }
        newSrsLevel += 2;
        newSrsEaseFactor = Math.min(2.5, newSrsEaseFactor + 0.15);
        break;
    }

    // Calculate next due date using UTC to avoid timezone issues
    const dueDate = new Date();
    dueDate.setUTCDate(dueDate.getUTCDate() + newSrsInterval);

    // Also handle streak and stats with UTC for consistency
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    
    // Get user data for stats calculation
    const userData = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        lastStudiedAt: true,
        dailyStudyCount: true,
        weeklyStudyCount: true,
      },
    });
    
    // Calculate whether this is a new study day
    const lastStudiedAt = userData?.lastStudiedAt ? new Date(userData.lastStudiedAt) : null;
    const lastStudiedDayUTC = lastStudiedAt
      ? new Date(Date.UTC(lastStudiedAt.getUTCFullYear(), lastStudiedAt.getUTCMonth(), lastStudiedAt.getUTCDate()))
      : null;
    
    const isNewDay = !lastStudiedDayUTC || lastStudiedDayUTC.getTime() !== todayUTC.getTime();
    
    // Calculate whether this is a new week
    const weekStartUTC = new Date(todayUTC);
    weekStartUTC.setUTCDate(todayUTC.getUTCDate() - todayUTC.getUTCDay());
    
    const lastWeekStartUTC = lastStudiedDayUTC
      ? new Date(Date.UTC(
          lastStudiedDayUTC.getUTCFullYear(),
          lastStudiedDayUTC.getUTCMonth(),
          lastStudiedDayUTC.getUTCDate() - lastStudiedDayUTC.getUTCDay()))
      : null;
    
    const isNewWeek = !lastWeekStartUTC || lastWeekStartUTC.getTime() !== weekStartUTC.getTime();

    // Update flashcard and user stats in a transaction
    await db.transaction(async (tx) => {
      // Update flashcard
      await tx
        .update(flashcards)
        .set({
          srsLevel: newSrsLevel,
          srsInterval: newSrsInterval,
          srsEaseFactor: newSrsEaseFactor.toString(),
          srsDueDate: dueDate,
          updatedAt: now,
        })
        .where(eq(flashcards.id, cardId));

      // Update user stats
      await tx
        .update(users)
        .set({
          dailyStudyCount: isNewDay ? 1 : db.sql`${users.dailyStudyCount} + 1`,
          weeklyStudyCount: isNewWeek ? 1 : db.sql`${users.weeklyStudyCount} + 1`,
          lastStudiedAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, userId));
    });

    return {
      isSuccess: true,
      message: "Study progress recorded",
    };
  } catch (error) {
    console.error("Error recording study rating:", error);

    if (error instanceof z.ZodError) {
      return {
        isSuccess: false,
        message: "Invalid rating value",
        error: error.formErrors.fieldErrors,
      };
    }

    return {
      isSuccess: false,
      message: "Failed to record study progress",
    };
  }
} 