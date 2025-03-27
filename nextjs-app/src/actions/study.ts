"use server";

import { auth } from "@clerk/nextjs";
import { db } from "@/db";
import { flashcards, decks, users } from "@/db/schema";
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

    // Get current user stats
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return {
        isSuccess: false,
        message: "User not found."
      };
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastStudiedDate = user.lastStudiedAt ? new Date(user.lastStudiedAt) : null;
    const lastStudiedDay = lastStudiedDate ? new Date(lastStudiedDate.getFullYear(), lastStudiedDate.getMonth(), lastStudiedDate.getDate()) : null;

    // Calculate streak
    let newStreak = user.consecutiveStudyDays;
    if (!lastStudiedDay) {
      newStreak = 1;
    } else if (lastStudiedDay.getTime() === today.getTime()) {
      // Already studied today, streak remains the same
    } else if (lastStudiedDay.getTime() === today.getTime() - 24 * 60 * 60 * 1000) {
      // Studied yesterday, increment streak
      newStreak += 1;
    } else {
      // Break in streak, reset to 1
      newStreak = 1;
    }

    // Reset daily count if it's a new day
    const dailyCount = lastStudiedDay?.getTime() === today.getTime() 
      ? user.dailyStudyCount + 1 
      : 1;

    // Reset weekly count if it's a new week
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const lastWeekStart = lastStudiedDate ? new Date(lastStudiedDate.getFullYear(), lastStudiedDate.getMonth(), lastStudiedDate.getDate() - lastStudiedDate.getDay()) : null;
    const weeklyCount = lastWeekStart?.getTime() === weekStart.getTime()
      ? user.weeklyStudyCount + 1
      : 1;

    // Update accuracy (Good/Easy ratings count as correct)
    const isCorrect = rating === 'Good' || rating === 'Easy';
    const newAccuracy = ((Number(user.totalRecallAccuracy) * user.dailyStudyCount) + (isCorrect ? 1 : 0)) / (user.dailyStudyCount + 1);

    // Update database in a transaction
    await db.transaction(async (tx) => {
      // Update flashcard
      await tx
        .update(flashcards)
        .set({
          srsInterval: newInterval,
          srsEaseFactor: newEaseFactor,
          srsDueDate: newDueDate,
          updatedAt: now
        })
        .where(eq(flashcards.id, flashcardId));

      // Update user stats
      await tx
        .update(users)
        .set({
          dailyStudyCount: dailyCount,
          weeklyStudyCount: weeklyCount,
          totalRecallAccuracy: newAccuracy.toFixed(2),
          consecutiveStudyDays: newStreak,
          lastStudiedAt: now,
          updatedAt: now
        })
        .where(eq(users.id, userId));
    });

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