import { flashcards } from "@/db/schema/flashcards";

export type StudyRating = "Again" | "Hard" | "Good" | "Easy";

interface SrsData {
  newInterval: number;
  newEaseFactor: number;
  newDueDate: Date;
}

/**
 * Calculates new SRS data based on Anki's SM-2 variant algorithm
 *
 * This implementation is based on the SuperMemo 2 algorithm, as modified by Anki.
 * The key differences from the original SM-2 are:
 * 1. Separate handling of the learning phase (when interval = 0)
 * 2. Modified ease factor adjustments for different ratings
 * 3. Additional multiplier for "Easy" ratings
 *
 * Source: Anki's default algorithm (https://apps.ankiweb.net/docs/manual.html#what-spaced-repetition-algorithm-does-anki-use)
 *
 * Intervals (in days):
 * - Again: 0 (reset to learning phase)
 * - Hard: currentInterval * 1.2 (slower progression)
 * - Good: currentInterval * easeFactor (normal progression)
 * - Easy: currentInterval * easeFactor * 1.3 (faster progression)
 *
 * Ease Factor adjustments:
 * - Again: -0.20 (significant decrease)
 * - Hard: -0.15 (moderate decrease)
 * - Good: +0.00 (no change)
 * - Easy: +0.15 (moderate increase)
 *
 * Learning phase intervals (when currentInterval = 0):
 * - Again: 0 (immediate review)
 * - Hard: 0 (immediate review) - Changed to 1 day to prevent too frequent reviews
 * - Good: 1 (next day)
 * - Easy: 3 (3 days)
 *
 * Bounds and Constraints:
 * - Minimum ease factor: 1.3 (prevents cards from becoming too difficult)
 * - Maximum ease factor: 2.5 (prevents cards from becoming too easy)
 * - Intervals are rounded to whole days
 * - Learning phase has fixed intervals for better initial retention
 */
export function calculateSrsData(
  currentCard: typeof flashcards.$inferSelect,
  rating: StudyRating
): SrsData {
  const currentInterval = currentCard.srsInterval;
  const currentEaseFactor =
    typeof currentCard.srsEaseFactor === "string"
      ? parseFloat(currentCard.srsEaseFactor)
      : currentCard.srsEaseFactor;

  // Use UTC timestamp for consistent date calculations
  const now = new Date();

  // Handle learning phase (interval = 0)
  if (currentInterval === 0) {
    const learningIntervals = {
      Again: 0,
      Hard: 1, // Changed from 0 to 1 to prevent too frequent reviews
      Good: 1,
      Easy: 3,
    };

    // Calculate due date with UTC to avoid timezone issues
    const dueDate = new Date();
    dueDate.setUTCDate(dueDate.getUTCDate() + learningIntervals[rating]);

    return {
      newInterval: learningIntervals[rating],
      newEaseFactor: currentEaseFactor,
      newDueDate: dueDate,
    };
  }

  // Calculate new ease factor
  const easeFactorAdjustments = {
    Again: -0.2,
    Hard: -0.15,
    Good: 0.0,
    Easy: 0.15,
  };

  let newEaseFactor = currentEaseFactor + easeFactorAdjustments[rating];

  // Ensure ease factor stays within bounds
  newEaseFactor = Math.max(1.3, Math.min(2.5, newEaseFactor));

  // Calculate new interval
  let newInterval: number;
  switch (rating) {
    case "Again":
      newInterval = 0; // Reset to learning phase
      break;
    case "Hard":
      // For Hard ratings, increase interval by 20% but ensure it's at least 1 day
      newInterval = Math.max(1, Math.round(currentInterval * 1.2));
      break;
    case "Good":
      // For Good ratings, increase by the ease factor
      newInterval = Math.max(1, Math.round(currentInterval * newEaseFactor));
      break;
    case "Easy":
      // For Easy ratings, increase by ease factor with additional 30% boost
      newInterval = Math.max(
        1,
        Math.round(currentInterval * newEaseFactor * 1.3)
      );
      break;
  }

  // Calculate new due date using UTC to avoid timezone issues
  const dueDate = new Date();
  dueDate.setUTCDate(dueDate.getUTCDate() + newInterval);

  return {
    newInterval,
    newEaseFactor,
    newDueDate: dueDate,
  };
} 