/**
 * @file study.ts
 * @description
 *  Provides server actions for studying flashcards:
 *   1) getDeckStudySessionAction(deckId): Fetch up to N due flashcards
 *   2) recordStudyRatingAction(cardId, rating): Apply the SRS rating, update user stats
 *
 * Key functionalities:
 *  - Checking user auth (Clerk) with `auth()`
 *  - Accessing Drizzle DB (decks, flashcards, users)
 *  - SRS synergy: We call `calculateSrsData` from "@/lib/srs" to ensure uniform logic
 *  - Updating user stats (dailyStudyCount, weeklyStudyCount, totalReviews, totalCorrectReviews,
 *    consecutiveStudyDays, lastStudiedAt)
 *
 * @dependencies
 *  - Clerk: For user authentication
 *  - Drizzle (db, schema: decks, flashcards, users)
 *  - srs.ts: The SRS logic we want to unify with
 *  - zod: For input validation if needed
 *  - ActionState: Our standard return type
 *
 * @notes
 *  - Typically, the UI calls getDeckStudySessionAction to get the due flashcards for the day,
 *    then calls recordStudyRatingAction when the user rates each card ("Again"/"Hard"/"Good"/"Easy").
 *  - The synergy with srs.ts means the rating logic is consistent with the SM-2 variant algorithm.
 */

"use server";

import { auth } from "@clerk/nextjs";
import { db } from "@/db";
import { decks, flashcards, users } from "@/db/schema";
import { and, eq, lte, asc } from "drizzle-orm";
import { ActionState } from "@/types";
import { z } from "zod";
import { calculateSrsData, StudyRating } from "@/lib/srs";

/**
 * Maximum number of cards to return for a single study session
 */
const CARDS_PER_SESSION = 20;

/**
 * @function getDeckStudySessionAction
 * @async
 * @description
 *  Fetches up to CARDS_PER_SESSION flashcards that are due for review from a given deck.
 *  "Due" means flashcards.srsDueDate <= now. This is used by the UI to load today's session.
 *
 * @param deckId The ID of the deck from which to fetch due cards
 * @returns Promise<ActionState<{ deckName: string; cards: any[] }>>
 *  - deckName: The name of the deck
 *  - cards: The array of due flashcards (limited by CARDS_PER_SESSION)
 */
export async function getDeckStudySessionAction(
  deckId: string
): Promise<ActionState<{ deckName: string; cards: any[] }>> {
  try {
    const { userId } = auth();
    if (!userId) {
      return {
        isSuccess: false,
        message: "Unauthorized",
      };
    }

    if (!deckId) {
      return {
        isSuccess: false,
        message: "Deck ID is required",
      };
    }

    // Ensure the deck belongs to the user
    const deck = await db.query.decks.findFirst({
      where: and(eq(decks.id, deckId), eq(decks.userId, userId)),
      columns: {
        name: true,
      },
    });

    if (!deck) {
      return {
        isSuccess: false,
        message: "Deck not found or access denied",
      };
    }

    // Get current time for due date comparison
    const now = new Date();

    // Query up to CARDS_PER_SESSION flashcards that are due
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
    return {
      isSuccess: false,
      message: "Failed to fetch study session",
    };
  }
}

/**
 * Zod schema for validating the rating input if needed
 */
const ratingSchema = z.enum(["Again", "Hard", "Good", "Easy"]);

/**
 * @function recordStudyRatingAction
 * @async
 * @description
 *  Applies the user's rating ("Again", "Hard", "Good", or "Easy") to a specific flashcard,
 *  calculates new SRS data via `calculateSrsData(...)`, updates the flashcard in the DB,
 *  and updates the user's study stats (daily count, weekly count, total reviews, correct reviews,
 *  consecutive day streak, lastStudiedAt).
 *
 * @param flashcardId The ID of the flashcard to update
 * @param rating One of the 4 SRS rating labels
 * @returns Promise<ActionState<void>> 
 */
export async function recordStudyRatingAction(
  flashcardId: string,
  rating: "Again" | "Hard" | "Good" | "Easy"
): Promise<ActionState<void>> {
  try {
    const { userId } = auth();
    if (!userId) {
      return {
        isSuccess: false,
        message: "You must be logged in to record study ratings",
      };
    }

    // Validate rating
    const validatedRating = ratingSchema.safeParse(rating);
    if (!validatedRating.success) {
      return {
        isSuccess: false,
        message: "Invalid rating",
        error: { rating: ["Must be one of Again, Hard, Good, Easy"] },
      };
    }

    // Retrieve the flashcard
    const card = await db.query.flashcards.findFirst({
      where: eq(flashcards.id, flashcardId),
    });

    if (!card) {
      return {
        isSuccess: false,
        message: "Flashcard not found",
      };
    }

    // Verify ownership
    if (card.userId !== userId) {
      return {
        isSuccess: false,
        message: "Unauthorized - You do not own this flashcard",
      };
    }

    // At this point, we unify the logic with srs.ts
    // We call calculateSrsData(...) to get newInterval, newEaseFactor, newDueDate
    const { newInterval, newEaseFactor, newDueDate } = calculateSrsData(
      card,
      rating as StudyRating
    );

    // We'll also handle user stats
    const userRec = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!userRec) {
      return {
        isSuccess: false,
        message: "User record not found",
      };
    }

    // For daily & weekly stats, we do a date-based comparison in UTC
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    let newDailyCount = userRec.dailyStudyCount;
    let newWeeklyCount = userRec.weeklyStudyCount;
    let newStreak = userRec.consecutiveStudyDays;

    const lastStudiedAt = userRec.lastStudiedAt ? new Date(userRec.lastStudiedAt) : null;
    let lastStudiedDayUTC: Date | null = null;
    if (lastStudiedAt) {
      lastStudiedDayUTC = new Date(
        Date.UTC(
          lastStudiedAt.getUTCFullYear(),
          lastStudiedAt.getUTCMonth(),
          lastStudiedAt.getUTCDate()
        )
      );
    }

    // Check if it's a new day
    const isSameDay = lastStudiedDayUTC
      ? lastStudiedDayUTC.getTime() === todayUTC.getTime()
      : false;

    if (!isSameDay) {
      // It's definitely a new day, so daily count resets to 0
      newDailyCount = 0;
      // Check if the day difference is exactly 1 day => increment streak
      // Otherwise, reset streak to 1
      if (lastStudiedDayUTC) {
        const dayDiff =
          (todayUTC.getTime() - lastStudiedDayUTC.getTime()) / (24 * 60 * 60 * 1000);

        if (dayDiff === 1) {
          newStreak = userRec.consecutiveStudyDays + 1;
        } else {
          newStreak = 1;
        }
      } else {
        // If they've never studied before, let's set streak to 1
        newStreak = 1;
      }
    }

    // Increase daily count by 1
    newDailyCount += 1;

    // For weekly count, we define "week start" as Sunday
    // So we check if the old date is in the same Sunday-based week
    const weekStartUTC = new Date(todayUTC);
    weekStartUTC.setUTCDate(todayUTC.getUTCDate() - todayUTC.getUTCDay());

    let lastWeekStartUTC: Date | null = null;
    if (lastStudiedDayUTC) {
      lastWeekStartUTC = new Date(lastStudiedDayUTC);
      lastWeekStartUTC.setUTCDate(lastStudiedDayUTC.getUTCDate() - lastStudiedDayUTC.getUTCDay());
    }

    const isSameWeek = lastWeekStartUTC
      ? lastWeekStartUTC.getTime() === weekStartUTC.getTime()
      : false;

    if (!isSameWeek) {
      // new week => reset weekly count
      newWeeklyCount = 0;
    }
    newWeeklyCount += 1;

    // SRS correctness => rating = "Good" or "Easy"
    const isCorrect = rating === "Good" || rating === "Easy";

    // Do everything in a transaction
    await db.transaction(async (tx) => {
      // 1) Update the flashcard
      await tx
        .update(flashcards)
        .set({
          srsInterval: newInterval,
          srsEaseFactor: newEaseFactor.toString(),
          srsDueDate: newDueDate,
          updatedAt: now,
        })
        .where(eq(flashcards.id, card.id));

      // 2) Update user stats
      // We'll increment totalReviews by 1, totalCorrectReviews if isCorrect
      const newTotalReviews = (userRec.totalReviews || 0) + 1;
      const newTotalCorrectReviews = isCorrect
        ? (userRec.totalCorrectReviews || 0) + 1
        : (userRec.totalCorrectReviews || 0);

      await tx
        .update(users)
        .set({
          dailyStudyCount: newDailyCount,
          weeklyStudyCount: newWeeklyCount,
          totalReviews: newTotalReviews,
          totalCorrectReviews: newTotalCorrectReviews,
          consecutiveStudyDays: newStreak,
          lastStudiedAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, userId));
    });

    return {
      isSuccess: true,
      message: "Study rating recorded successfully",
    };
  } catch (error) {
    console.error("Error recording study rating:", error);
    return {
      isSuccess: false,
      message: "Failed to record study rating",
      error: { server: ["An unexpected error occurred"] },
    };
  }
}
