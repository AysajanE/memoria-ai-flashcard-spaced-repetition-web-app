"use server";

import { auth } from "@clerk/nextjs";
import { db } from "@/db";
import { flashcards, decks, users } from "@/db/schema";
import { ActionState } from "@/types";
import { eq, and, lte, asc } from "drizzle-orm";
import { calculateSrsData, type StudyRating } from "@/lib/srs";

const CARDS_PER_SESSION = 20;

export async function getDeckStudySessionAction(
  deckId: string
): Promise<ActionState<{ deckName: string; cards: Flashcard[] }>> {
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
      where: and(eq(decks.id, deckId), eq(decks.userId, userId)),
      columns: {
        name: true,
      },
    });

    if (!deck) {
      return { isSuccess: false, message: "Deck not found or access denied" };
    }

    // Get current time for due date comparison
    const now = new Date();

    // Query due cards
    const dueCards = await db.query.flashcards.findMany({
      where: and(
        eq(flashcards.deckId, deckId),
        eq(flashcards.userId, userId),
        lte(flashcards.srsDueDate, now)
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
        message: "You must be logged in to record study ratings.",
      };
    }

    // Validate inputs
    if (!flashcardId || !rating) {
      return {
        isSuccess: false,
        message: "Missing required fields.",
        error: {
          flashcardId: ["Flashcard ID is required"],
          rating: ["Rating is required"],
        },
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
        message: "Flashcard not found.",
      };
    }

    // Verify ownership
    if (currentCard.userId !== userId) {
      return {
        isSuccess: false,
        message: "You don't have permission to update this flashcard.",
      };
    }

    // Calculate new SRS data
    const { newInterval, newEaseFactor, newDueDate } = calculateSrsData(
      currentCard,
      rating
    );

    // Get current user stats
    const [user] = await db.select().from(users).where(eq(users.id, userId));

    if (!user) {
      return {
        isSuccess: false,
        message: "User not found.",
      };
    }

    // Use UTC dates for consistent timezone handling
    const now = new Date();
    // Get current date in UTC (year, month, day only)
    const todayUTC = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );

    // Get last studied date in UTC
    const lastStudiedDate = user.lastStudiedAt
      ? new Date(user.lastStudiedAt)
      : null;
    const lastStudiedDayUTC = lastStudiedDate
      ? new Date(
          Date.UTC(
            lastStudiedDate.getUTCFullYear(),
            lastStudiedDate.getUTCMonth(),
            lastStudiedDate.getUTCDate()
          )
        )
      : null;

    // Calculate streak
    let newStreak = user.consecutiveStudyDays;
    if (!lastStudiedDayUTC) {
      // First time studying
      newStreak = 1;
    } else if (lastStudiedDayUTC.getTime() === todayUTC.getTime()) {
      // Already studied today, streak remains the same
    } else {
      // Calculate day difference using UTC timestamps
      const dayDiff =
        (todayUTC.getTime() - lastStudiedDayUTC.getTime()) /
        (24 * 60 * 60 * 1000);

      if (dayDiff === 1) {
        // Studied yesterday, increment streak
        newStreak += 1;
      } else if (dayDiff > 1) {
        // Break in streak, reset to 1
        newStreak = 1;
      }
    }

    // Reset daily count if it's a new day (using UTC comparison)
    const dailyCount =
      lastStudiedDayUTC?.getTime() === todayUTC.getTime()
        ? user.dailyStudyCount + 1
        : 1;

    // Reset weekly count if it's a new week (using UTC)
    const weekStartUTC = new Date(todayUTC);
    weekStartUTC.setUTCDate(todayUTC.getUTCDate() - todayUTC.getUTCDay());

    const lastWeekStartUTC = lastStudiedDayUTC
      ? new Date(
          Date.UTC(
            lastStudiedDayUTC.getUTCFullYear(),
            lastStudiedDayUTC.getUTCMonth(),
            lastStudiedDayUTC.getUTCDate() - lastStudiedDayUTC.getUTCDay()
          )
        )
      : null;

    const weeklyCount =
      lastWeekStartUTC?.getTime() === weekStartUTC.getTime()
        ? user.weeklyStudyCount + 1
        : 1;

    // Update accuracy (Good/Easy ratings count as correct)
    const isCorrect = rating === "Good" || rating === "Easy";

    // Update database in a transaction
    await db.transaction(async (tx) => {
      // Update flashcard
      await tx
        .update(flashcards)
        .set({
          srsInterval: newInterval,
          srsEaseFactor: newEaseFactor,
          srsDueDate: newDueDate,
          updatedAt: now,
        })
        .where(eq(flashcards.id, flashcardId));

      // Update user stats
      await tx
        .update(users)
        .set({
          dailyStudyCount: dailyCount,
          weeklyStudyCount: weeklyCount,
          totalReviews: db.sql`${users.totalReviews} + 1`,
          totalCorrectReviews: isCorrect
            ? db.sql`${users.totalCorrectReviews} + 1`
            : users.totalCorrectReviews,
          consecutiveStudyDays: newStreak,
          lastStudiedAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, userId));
    });

    return {
      isSuccess: true,
      message: "Study rating recorded successfully.",
    };
  } catch (error) {
    console.error("Error recording study rating:", error);
    return {
      isSuccess: false,
      message: "Failed to record study rating. Please try again.",
    };
  }
}
