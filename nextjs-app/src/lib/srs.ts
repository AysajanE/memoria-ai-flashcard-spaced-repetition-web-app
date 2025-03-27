import { Flashcard } from "@/db/schema";

export type StudyRating = 'Again' | 'Hard' | 'Good' | 'Easy';

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
 * - Hard: 0 (immediate review)
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
  currentCard: Flashcard,
  rating: StudyRating
): SrsData {
  const currentInterval = currentCard.srsInterval;
  const currentEaseFactor = currentCard.srsEaseFactor;
  const now = new Date();

  // Handle learning phase (interval = 0)
  if (currentInterval === 0) {
    const learningIntervals = {
      Again: 0,
      Hard: 0,
      Good: 1,
      Easy: 3
    };

    return {
      newInterval: learningIntervals[rating],
      newEaseFactor: currentEaseFactor,
      newDueDate: new Date(now.getTime() + learningIntervals[rating] * 24 * 60 * 60 * 1000)
    };
  }

  // Calculate new ease factor
  const easeFactorAdjustments = {
    Again: -0.20,
    Hard: -0.15,
    Good: 0.00,
    Easy: 0.15
  };

  let newEaseFactor = currentEaseFactor + easeFactorAdjustments[rating];
  
  // Ensure ease factor stays within bounds
  newEaseFactor = Math.max(1.3, Math.min(2.5, newEaseFactor));

  // Calculate new interval
  let newInterval: number;
  switch (rating) {
    case 'Again':
      newInterval = 0; // Reset to learning phase
      break;
    case 'Hard':
      newInterval = Math.round(currentInterval * 1.2);
      break;
    case 'Good':
      newInterval = Math.round(currentInterval * newEaseFactor);
      break;
    case 'Easy':
      newInterval = Math.round(currentInterval * newEaseFactor * 1.3);
      break;
  }

  // Calculate new due date
  const newDueDate = new Date(now.getTime() + newInterval * 24 * 60 * 60 * 1000);

  return {
    newInterval,
    newEaseFactor,
    newDueDate
  };
} 