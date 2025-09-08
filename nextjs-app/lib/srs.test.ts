import { describe, it, expect } from 'vitest';
import { calculateSrsData, type StudyRating } from './srs';

// Minimal shape to satisfy the type expectations in calculateSrsData
function makeCard({ interval = 0, ease = 2.5 }: { interval?: number; ease?: number }) {
  return {
    id: 'card-1',
    deckId: 'deck-1',
    userId: 'user-1',
    front: 'Q',
    back: 'A',
    cardType: 'qa' as const,
    srsLevel: 0,
    srsInterval: interval,
    srsEaseFactor: ease,
    srsDueDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;
}

describe('calculateSrsData', () => {
  it('learning phase: Hard should schedule for 1 day', () => {
    const card = makeCard({ interval: 0 });
    const { newInterval, newDueDate } = calculateSrsData(card, 'Hard');
    expect(newInterval).toBe(1);
    const today = new Date();
    const diffDays = Math.round(
      (newDueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
    );
    // Allow +/- one day for timezone/UTC rounding
    expect(diffDays === 1 || diffDays === 0).toBe(true);
  });

  it('review phase: Good increases interval using ease factor', () => {
    const card = makeCard({ interval: 5, ease: 2.3 });
    const { newInterval } = calculateSrsData(card, 'Good');
    expect(newInterval).toBeGreaterThanOrEqual(1);
    expect(newInterval).toBe(Math.max(1, Math.round(5 * 2.3)));
  });

  it('review phase: Again resets to learning (interval 0)', () => {
    const card = makeCard({ interval: 3, ease: 2.5 });
    const { newInterval } = calculateSrsData(card, 'Again');
    expect(newInterval).toBe(0);
  });
});

