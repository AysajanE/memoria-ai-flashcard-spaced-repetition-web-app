/**
 * @file study.test.ts
 * @description Comprehensive tests for recordStudyRatingAction
 * 
 * Test coverage:
 * - Happy path with different ratings
 * - Unauthorized access (no user)
 * - Invalid ratings validation
 * - Ownership validation (user doesn't own flashcard)
 * - Flashcard not found
 * - Streak calculation logic
 * - Stats updates (daily, weekly, total)
 * - Database transaction rollback on error
 */

import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest';
import { recordStudyRatingAction } from '@/actions/study';
import { auth } from '@clerk/nextjs';
import { db } from '@/db';
import * as srsLib from '@/lib/srs';

// Mock dependencies
vi.mock('@clerk/nextjs');
vi.mock('@/db');
vi.mock('@/lib/srs');

const mockAuth = auth as MockedFunction<typeof auth>;
const mockDb = db as any;
const mockCalculateSrsData = srsLib.calculateSrsData as MockedFunction<typeof srsLib.calculateSrsData>;

// Test data constants
const TEST_USER_ID = 'user_test123';
const TEST_FLASHCARD_ID = 'card_test456';
const TEST_OTHER_USER_ID = 'user_other789';

// Mock flashcard data
const mockFlashcard = {
  id: TEST_FLASHCARD_ID,
  userId: TEST_USER_ID,
  deckId: 'deck_test123',
  front: 'Test Question',
  back: 'Test Answer',
  srsLevel: 1,
  srsInterval: 1,
  srsEaseFactor: '2.5',
  srsDueDate: new Date('2025-01-01'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

// Mock user data
const mockUser = {
  id: TEST_USER_ID,
  clerkId: TEST_USER_ID,
  email: 'test@example.com',
  dailyStudyCount: 5,
  weeklyStudyCount: 25,
  totalReviews: 100,
  totalCorrectReviews: 75,
  consecutiveStudyDays: 3,
  lastStudiedAt: new Date('2025-01-01'),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

// Mock SRS calculation result
const mockSrsResult = {
  newInterval: 4,
  newEaseFactor: 2.6,
  newDueDate: new Date('2025-01-05'),
  newSrsLevel: 2,
};

describe('recordStudyRatingAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up default mocks
    mockAuth.mockReturnValue({ userId: TEST_USER_ID });
    mockCalculateSrsData.mockReturnValue(mockSrsResult);
    
    // Mock database queries
    mockDb.query = {
      flashcards: {
        findFirst: vi.fn().mockResolvedValue(mockFlashcard),
      },
      users: {
        findFirst: vi.fn().mockResolvedValue(mockUser),
      },
    };
    
    // Mock database transaction with proper update tracking
    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
    
    mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
      const mockTx = { update: mockUpdate };
      await callback(mockTx);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should return unauthorized when user is not authenticated', async () => {
      mockAuth.mockReturnValue({ userId: null });

      const result = await recordStudyRatingAction(TEST_FLASHCARD_ID, 'Good');

      expect(result.isSuccess).toBe(false);
      expect(result.message).toBe('You must be logged in to record study ratings');
    });

    it('should return unauthorized when user does not own the flashcard', async () => {
      mockDb.query.flashcards.findFirst.mockResolvedValue({
        ...mockFlashcard,
        userId: TEST_OTHER_USER_ID, // Different user
      });

      const result = await recordStudyRatingAction(TEST_FLASHCARD_ID, 'Good');

      expect(result.isSuccess).toBe(false);
      expect(result.message).toBe('Unauthorized - You do not own this flashcard');
    });
  });

  describe('Input Validation', () => {
    it('should return error for invalid rating', async () => {
      // @ts-expect-error Testing invalid input
      const result = await recordStudyRatingAction(TEST_FLASHCARD_ID, 'Invalid');

      expect(result.isSuccess).toBe(false);
      expect(result.message).toBe('Invalid rating');
      expect(result.error).toEqual({
        rating: ['Must be one of Again, Hard, Good, Easy'],
      });
    });

    it('should accept all valid ratings', async () => {
      const validRatings: Array<'Again' | 'Hard' | 'Good' | 'Easy'> = ['Again', 'Hard', 'Good', 'Easy'];

      for (const rating of validRatings) {
        mockAuth.mockReturnValue({ userId: TEST_USER_ID });
        const result = await recordStudyRatingAction(TEST_FLASHCARD_ID, rating);
        
        expect(result.isSuccess).toBe(true);
        expect(mockCalculateSrsData).toHaveBeenCalledWith(mockFlashcard, rating);
      }
    });
  });

  describe('Data Validation', () => {
    it('should return error when flashcard is not found', async () => {
      mockDb.query.flashcards.findFirst.mockResolvedValue(null);

      const result = await recordStudyRatingAction(TEST_FLASHCARD_ID, 'Good');

      expect(result.isSuccess).toBe(false);
      expect(result.message).toBe('Flashcard not found');
    });

    it('should return error when user record is not found', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null);

      const result = await recordStudyRatingAction(TEST_FLASHCARD_ID, 'Good');

      expect(result.isSuccess).toBe(false);
      expect(result.message).toBe('User record not found');
    });
  });

  describe('Happy Path - SRS Updates', () => {
    it('should successfully record a Good rating', async () => {
      const result = await recordStudyRatingAction(TEST_FLASHCARD_ID, 'Good');

      expect(result.isSuccess).toBe(true);
      expect(result.message).toBe('Study rating recorded successfully');
      
      // Verify SRS calculation was called
      expect(mockCalculateSrsData).toHaveBeenCalledWith(mockFlashcard, 'Good');
      
      // Verify database transaction was called
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should update flashcard with SRS data', async () => {
      // Create a more detailed mock to track calls
      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
      
      mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = { update: mockUpdate };
        await callback(mockTx);
      });

      await recordStudyRatingAction(TEST_FLASHCARD_ID, 'Good');

      expect(mockDb.transaction).toHaveBeenCalledWith(expect.any(Function));
      expect(mockUpdate).toHaveBeenCalledTimes(2); // flashcard + user
      
      // Verify flashcard update
      const flashcardUpdate = mockSet.mock.calls[0][0];
      expect(flashcardUpdate).toEqual({
        srsLevel: mockSrsResult.newSrsLevel,
        srsInterval: mockSrsResult.newInterval,
        srsEaseFactor: mockSrsResult.newEaseFactor.toString(),
        srsDueDate: mockSrsResult.newDueDate,
        updatedAt: expect.any(Date),
      });
    });
  });

  describe('Stats Updates', () => {
    it('should increment daily and weekly counts for new study session', async () => {
      // Mock user to have studied today already, so counts will increment
      const today = new Date();
      mockDb.query.users.findFirst.mockResolvedValue({
        ...mockUser,
        lastStudiedAt: today,
        dailyStudyCount: 3, // Some existing count
        weeklyStudyCount: 15,
      });

      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
      
      mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = { update: mockUpdate };
        await callback(mockTx);
      });
      
      await recordStudyRatingAction(TEST_FLASHCARD_ID, 'Good');
      
      // Get the user update call (second call)
      const userUpdate = mockSet.mock.calls[1][0];
      
      expect(userUpdate.dailyStudyCount).toBe(4); // 3 + 1
      expect(userUpdate.weeklyStudyCount).toBe(16); // 15 + 1
      expect(userUpdate.totalReviews).toBe(mockUser.totalReviews + 1);
    });

    it('should increment correct reviews for Good rating', async () => {
      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
      
      mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = { update: mockUpdate };
        await callback(mockTx);
      });
      
      await recordStudyRatingAction(TEST_FLASHCARD_ID, 'Good');
      
      const userUpdate = mockSet.mock.calls[1][0];
      expect(userUpdate.totalCorrectReviews).toBe(mockUser.totalCorrectReviews + 1);
    });

    it('should not increment correct reviews for Again rating', async () => {
      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
      
      mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = { update: mockUpdate };
        await callback(mockTx);
      });
      
      await recordStudyRatingAction(TEST_FLASHCARD_ID, 'Again');
      
      const userUpdate = mockSet.mock.calls[1][0];
      expect(userUpdate.totalCorrectReviews).toBe(mockUser.totalCorrectReviews);
    });
  });

  describe('Streak Calculation', () => {
    it('should increment streak for consecutive day study', async () => {
      // Mock user last studied yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      mockDb.query.users.findFirst.mockResolvedValue({
        ...mockUser,
        lastStudiedAt: yesterday,
        consecutiveStudyDays: 2,
      });

      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
      
      mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = { update: mockUpdate };
        await callback(mockTx);
      });

      await recordStudyRatingAction(TEST_FLASHCARD_ID, 'Good');
      
      const userUpdate = mockSet.mock.calls[1][0];
      expect(userUpdate.consecutiveStudyDays).toBe(3);
    });

    it('should reset streak for non-consecutive day study', async () => {
      // Mock user last studied 3 days ago
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      mockDb.query.users.findFirst.mockResolvedValue({
        ...mockUser,
        lastStudiedAt: threeDaysAgo,
        consecutiveStudyDays: 5,
      });

      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
      
      mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = { update: mockUpdate };
        await callback(mockTx);
      });

      await recordStudyRatingAction(TEST_FLASHCARD_ID, 'Good');
      
      const userUpdate = mockSet.mock.calls[1][0];
      expect(userUpdate.consecutiveStudyDays).toBe(1);
    });

    it('should set streak to 1 for first-time study', async () => {
      mockDb.query.users.findFirst.mockResolvedValue({
        ...mockUser,
        lastStudiedAt: null,
        consecutiveStudyDays: 0,
      });

      const mockSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
      
      mockDb.transaction = vi.fn().mockImplementation(async (callback) => {
        const mockTx = { update: mockUpdate };
        await callback(mockTx);
      });

      await recordStudyRatingAction(TEST_FLASHCARD_ID, 'Good');
      
      const userUpdate = mockSet.mock.calls[1][0];
      expect(userUpdate.consecutiveStudyDays).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDb.query.flashcards.findFirst.mockRejectedValue(new Error('Database error'));

      const result = await recordStudyRatingAction(TEST_FLASHCARD_ID, 'Good');

      expect(result.isSuccess).toBe(false);
      expect(result.message).toBe('Failed to record study rating');
      expect(result.error).toEqual({
        server: ['An unexpected error occurred'],
      });
    });

    it('should handle transaction errors', async () => {
      mockDb.transaction.mockRejectedValue(new Error('Transaction failed'));

      const result = await recordStudyRatingAction(TEST_FLASHCARD_ID, 'Good');

      expect(result.isSuccess).toBe(false);
      expect(result.message).toBe('Failed to record study rating');
    });

    it('should handle SRS calculation errors', async () => {
      mockCalculateSrsData.mockImplementation(() => {
        throw new Error('SRS calculation failed');
      });

      const result = await recordStudyRatingAction(TEST_FLASHCARD_ID, 'Good');

      expect(result.isSuccess).toBe(false);
      expect(result.message).toBe('Failed to record study rating');
    });
  });

  describe('Integration with SRS Library', () => {
    it('should pass correct parameters to calculateSrsData', async () => {
      await recordStudyRatingAction(TEST_FLASHCARD_ID, 'Easy');

      expect(mockCalculateSrsData).toHaveBeenCalledWith(mockFlashcard, 'Easy');
      expect(mockCalculateSrsData).toHaveBeenCalledTimes(1);
    });

    it('should handle all rating types with SRS calculation', async () => {
      const ratings: Array<'Again' | 'Hard' | 'Good' | 'Easy'> = ['Again', 'Hard', 'Good', 'Easy'];
      
      for (const rating of ratings) {
        mockCalculateSrsData.mockClear();
        await recordStudyRatingAction(TEST_FLASHCARD_ID, rating);
        
        expect(mockCalculateSrsData).toHaveBeenCalledWith(mockFlashcard, rating);
      }
    });
  });
});