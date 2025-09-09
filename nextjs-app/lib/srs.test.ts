import { describe, it, expect } from 'vitest';
import { 
  calculateSrsData, 
  type StudyRating, 
  MS_PER_DAY,
  calculateNextReview,
  calculateStreakUpdate 
} from './srs';

// Minimal shape to satisfy the type expectations in calculateSrsData
function makeCard({ 
  interval = 0, 
  ease = 2.5, 
  srsLevel = 0 
}: { 
  interval?: number; 
  ease?: number; 
  srsLevel?: number; 
}) {
  return {
    id: 'card-1',
    deckId: 'deck-1',
    userId: 'user-1',
    front: 'Q',
    back: 'A',
    cardType: 'qa' as const,
    srsLevel,
    srsInterval: interval,
    srsEaseFactor: ease,
    srsDueDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;
}

describe('calculateSrsData', () => {
  describe('Learning Phase (interval = 0)', () => {
    it('Good rating should move out of learning phase (srsLevel increments)', () => {
      const card = makeCard({ interval: 0, srsLevel: 0 });
      const { newInterval, newSrsLevel } = calculateSrsData(card, 'Good');
      expect(newInterval).toBe(1);
      expect(newSrsLevel).toBe(1); // Should increment from 0
    });

    it('Easy rating should move out of learning phase (srsLevel increments)', () => {
      const card = makeCard({ interval: 0, srsLevel: 0 });
      const { newInterval, newSrsLevel } = calculateSrsData(card, 'Easy');
      expect(newInterval).toBe(3);
      expect(newSrsLevel).toBe(1); // Should increment from 0
    });

    it('Again rating should reset srsLevel to 0', () => {
      const card = makeCard({ interval: 0, srsLevel: 2 });
      const { newInterval, newSrsLevel } = calculateSrsData(card, 'Again');
      expect(newInterval).toBe(0);
      expect(newSrsLevel).toBe(0); // Should reset to 0
    });

    it('Hard rating should schedule for 1 day and maintain srsLevel', () => {
      const card = makeCard({ interval: 0, srsLevel: 0 });
      const { newInterval, newDueDate, newSrsLevel } = calculateSrsData(card, 'Hard');
      expect(newInterval).toBe(1);
      expect(newSrsLevel).toBe(0); // Should maintain current level
      const today = new Date();
      const diffDays = Math.round(
        (newDueDate.getTime() - today.getTime()) / MS_PER_DAY
      );
      // Allow +/- one day for timezone/UTC rounding
      expect(diffDays === 1 || diffDays === 0).toBe(true);
    });
  });

  describe('Review Phase (interval > 0)', () => {
    it('Good rating should increase interval and increment srsLevel', () => {
      const card = makeCard({ interval: 5, ease: 2.3, srsLevel: 2 });
      const { newInterval, newSrsLevel } = calculateSrsData(card, 'Good');
      expect(newInterval).toBe(Math.max(1, Math.round(5 * 2.3)));
      expect(newSrsLevel).toBe(3); // Should increment
    });

    it('Easy rating should increase interval with boost and increment srsLevel', () => {
      const card = makeCard({ interval: 5, ease: 2.0, srsLevel: 3 });
      const { newInterval, newSrsLevel, newEaseFactor } = calculateSrsData(card, 'Easy');
      // Easy rating first adjusts ease factor: 2.0 + 0.15 = 2.15
      // Then calculates: 5 * 2.15 * 1.3 = 13.975 ≈ 14
      expect(newInterval).toBe(Math.max(1, Math.round(5 * 2.15 * 1.3)));
      expect(newSrsLevel).toBe(4); // Should increment
      expect(newEaseFactor).toBe(2.15); // Ease factor should increase
    });

    it('Again rating should reset to learning phase and reset srsLevel', () => {
      const card = makeCard({ interval: 10, ease: 2.5, srsLevel: 5 });
      const { newInterval, newSrsLevel } = calculateSrsData(card, 'Again');
      expect(newInterval).toBe(0);
      expect(newSrsLevel).toBe(0); // Should reset to 0
    });

    it('Hard rating should increase interval slowly and maintain srsLevel', () => {
      const card = makeCard({ interval: 5, ease: 2.5, srsLevel: 3 });
      const { newInterval, newSrsLevel } = calculateSrsData(card, 'Hard');
      expect(newInterval).toBe(Math.max(1, Math.round(5 * 1.2))); // 1.2x multiplier
      expect(newSrsLevel).toBe(3); // Should maintain current level
    });
  });

  describe('Ease Factor Adjustments', () => {
    it('should adjust ease factor correctly for each rating', () => {
      const baseEase = 2.5;
      
      // Again: -0.2
      const againCard = makeCard({ interval: 5, ease: baseEase });
      const { newEaseFactor: againEase } = calculateSrsData(againCard, 'Again');
      expect(againEase).toBe(2.3); // 2.5 - 0.2
      
      // Hard: -0.15
      const hardCard = makeCard({ interval: 5, ease: baseEase });
      const { newEaseFactor: hardEase } = calculateSrsData(hardCard, 'Hard');
      expect(hardEase).toBe(2.35); // 2.5 - 0.15
      
      // Good: no change
      const goodCard = makeCard({ interval: 5, ease: baseEase });
      const { newEaseFactor: goodEase } = calculateSrsData(goodCard, 'Good');
      expect(goodEase).toBe(2.5); // 2.5 + 0.0
      
      // Easy: +0.15
      const easyCard = makeCard({ interval: 5, ease: baseEase });
      const { newEaseFactor: easyEase } = calculateSrsData(easyCard, 'Easy');
      expect(easyEase).toBe(2.5); // 2.5 + 0.15, but capped at 2.5
    });

    it('should enforce ease factor bounds', () => {
      // Test minimum bound (1.3)
      const lowEaseCard = makeCard({ interval: 5, ease: 1.4 });
      const { newEaseFactor: minEase } = calculateSrsData(lowEaseCard, 'Again');
      expect(minEase).toBe(1.3); // Should not go below 1.3
      
      // Test maximum bound (2.5)
      const highEaseCard = makeCard({ interval: 5, ease: 2.4 });
      const { newEaseFactor: maxEase } = calculateSrsData(highEaseCard, 'Easy');
      expect(maxEase).toBe(2.5); // Should not go above 2.5
    });
  });

  describe('Date Calculations', () => {
    it('should use UTC dates to avoid timezone issues', () => {
      const card = makeCard({ interval: 0 });
      const { newDueDate } = calculateSrsData(card, 'Good');
      
      // Check that the date is calculated using UTC
      const today = new Date();
      const expectedDate = new Date();
      expectedDate.setUTCDate(expectedDate.getUTCDate() + 1);
      
      // Allow some tolerance for test execution time
      const timeDiff = Math.abs(newDueDate.getTime() - expectedDate.getTime());
      expect(timeDiff).toBeLessThan(1000); // Less than 1 second difference
    });
  });

  describe('Edge Cases', () => {
    it('should handle string ease factor input', () => {
      const card = {
        ...makeCard({ interval: 5, srsLevel: 2 }),
        srsEaseFactor: "2.3" // String instead of number
      };
      const { newInterval, newEaseFactor } = calculateSrsData(card, 'Good');
      expect(newInterval).toBe(Math.max(1, Math.round(5 * 2.3)));
      expect(newEaseFactor).toBe(2.3);
    });

    it('should handle missing srsLevel gracefully', () => {
      const card = {
        ...makeCard({ interval: 5 }),
        srsLevel: undefined as any
      };
      const { newSrsLevel } = calculateSrsData(card, 'Good');
      expect(newSrsLevel).toBe(1); // Should default to 0 + 1
    });
  });
});

describe('MS_PER_DAY constant', () => {
  it('should have the correct value for milliseconds per day', () => {
    expect(MS_PER_DAY).toBe(24 * 60 * 60 * 1000);
    expect(MS_PER_DAY).toBe(86400000);
  });

  it('should correctly calculate day differences', () => {
    const date1 = new Date('2023-01-01T00:00:00Z');
    const date2 = new Date('2023-01-02T00:00:00Z');
    const dayDiff = (date2.getTime() - date1.getTime()) / MS_PER_DAY;
    expect(dayDiff).toBe(1);
  });
});

describe('calculateNextReview', () => {
  it('should calculate next review date correctly', () => {
    const baseDate = new Date('2023-01-01T12:00:00Z');
    const nextReview = calculateNextReview(3, baseDate);
    
    // Should add 3 days using UTC
    const expected = new Date('2023-01-04T12:00:00Z');
    expect(nextReview.getUTCFullYear()).toBe(expected.getUTCFullYear());
    expect(nextReview.getUTCMonth()).toBe(expected.getUTCMonth());
    expect(nextReview.getUTCDate()).toBe(expected.getUTCDate());
  });

  it('should handle zero interval (same day)', () => {
    const baseDate = new Date('2023-01-01T12:00:00Z');
    const nextReview = calculateNextReview(0, baseDate);
    
    expect(nextReview.getUTCDate()).toBe(baseDate.getUTCDate());
  });

  it('should handle large intervals', () => {
    const baseDate = new Date('2023-01-01T12:00:00Z');
    const nextReview = calculateNextReview(365, baseDate);
    
    // Should add 365 days
    expect(nextReview.getUTCFullYear()).toBe(2024);
    expect(nextReview.getUTCMonth()).toBe(0); // January
    expect(nextReview.getUTCDate()).toBe(1);
  });

  it('should use current date when no baseDate provided', () => {
    const before = new Date();
    const nextReview = calculateNextReview(1);
    const after = new Date();
    
    // The next review should be approximately 1 day from now
    const expectedTime = before.getTime() + (24 * 60 * 60 * 1000); // 1 day later
    const tolerance = 60 * 1000; // 1 minute tolerance
    
    expect(nextReview.getTime()).toBeGreaterThan(expectedTime - tolerance);
    expect(nextReview.getTime()).toBeLessThan(expectedTime + tolerance);
  });
});

describe('calculateStreakUpdate', () => {
  it('should maintain streak when studying on same day', () => {
    const lastStudied = new Date('2023-01-01T10:00:00Z');
    const currentDate = new Date('2023-01-01T15:00:00Z'); // Same day
    const currentStreak = 5;
    
    const { newStreak, isNewDay } = calculateStreakUpdate(lastStudied, currentDate, currentStreak);
    
    expect(newStreak).toBe(5); // Should maintain current streak
    expect(isNewDay).toBe(false);
  });

  it('should increment streak when studying consecutive days', () => {
    const lastStudied = new Date('2023-01-01T10:00:00Z');
    const currentDate = new Date('2023-01-02T15:00:00Z'); // Next day
    const currentStreak = 5;
    
    const { newStreak, isNewDay } = calculateStreakUpdate(lastStudied, currentDate, currentStreak);
    
    expect(newStreak).toBe(6); // Should increment streak
    expect(isNewDay).toBe(true);
  });

  it('should reset streak when gap is more than 1 day', () => {
    const lastStudied = new Date('2023-01-01T10:00:00Z');
    const currentDate = new Date('2023-01-03T15:00:00Z'); // 2 days gap
    const currentStreak = 10;
    
    const { newStreak, isNewDay } = calculateStreakUpdate(lastStudied, currentDate, currentStreak);
    
    expect(newStreak).toBe(1); // Should reset to 1
    expect(isNewDay).toBe(true);
  });

  it('should set streak to 1 for first-time study (null lastStudiedAt)', () => {
    const currentDate = new Date('2023-01-01T15:00:00Z');
    const currentStreak = 0;
    
    const { newStreak, isNewDay } = calculateStreakUpdate(null, currentDate, currentStreak);
    
    expect(newStreak).toBe(1); // Should start at 1
    expect(isNewDay).toBe(true);
  });

  it('should handle timezone differences correctly using UTC', () => {
    // Late night in one timezone, early morning in another (same UTC day)
    const lastStudied = new Date('2023-01-01T23:30:00Z');
    const currentDate = new Date('2023-01-01T01:30:00Z'); // Different times, same UTC day
    const currentStreak = 3;
    
    const { newStreak, isNewDay } = calculateStreakUpdate(lastStudied, currentDate, currentStreak);
    
    expect(newStreak).toBe(3); // Should maintain streak (same UTC day)
    expect(isNewDay).toBe(false);
  });

  it('should handle edge case: exactly 24 hours later', () => {
    const lastStudied = new Date('2023-01-01T12:00:00Z');
    const currentDate = new Date('2023-01-02T12:00:00Z'); // Exactly 24 hours
    const currentStreak = 2;
    
    const { newStreak, isNewDay } = calculateStreakUpdate(lastStudied, currentDate, currentStreak);
    
    expect(newStreak).toBe(3); // Should increment (consecutive days)
    expect(isNewDay).toBe(true);
  });

  it('should handle partial day differences correctly', () => {
    const lastStudied = new Date('2023-01-01T23:59:00Z');
    const currentDate = new Date('2023-01-02T00:01:00Z'); // 2 minutes later, next day
    const currentStreak = 7;
    
    const { newStreak, isNewDay } = calculateStreakUpdate(lastStudied, currentDate, currentStreak);
    
    expect(newStreak).toBe(8); // Should increment (consecutive days)
    expect(isNewDay).toBe(true);
  });

  it('should use Math.floor for day difference calculation', () => {
    // Test that fractional days are handled correctly
    const lastStudied = new Date('2023-01-01T12:00:00Z');
    const currentDate = new Date('2023-01-02T06:00:00Z'); // 18 hours = 0.75 days
    const currentStreak = 1;
    
    const { newStreak, isNewDay } = calculateStreakUpdate(lastStudied, currentDate, currentStreak);
    
    // Math.floor(0.75) = 0, but since it's a different UTC day, it should still increment
    expect(newStreak).toBe(2);
    expect(isNewDay).toBe(true);
  });

  it('should handle leap year correctly', () => {
    const lastStudied = new Date('2024-02-28T12:00:00Z'); // Day before leap day
    const currentDate = new Date('2024-02-29T12:00:00Z'); // Leap day
    const currentStreak = 10;
    
    const { newStreak, isNewDay } = calculateStreakUpdate(lastStudied, currentDate, currentStreak);
    
    expect(newStreak).toBe(11); // Should handle leap day correctly
    expect(isNewDay).toBe(true);
  });
});

