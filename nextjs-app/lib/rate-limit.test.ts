import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  enforceRateLimit, 
  getRateLimitStatus, 
  rateLimitHealthCheck 
} from './rate-limit';

// Mock the Redis rate limiter module
vi.mock('./redis-rate-limit', () => ({
  redisRateLimit: vi.fn(),
  getRateLimitStatus: vi.fn(),
  checkRedisHealth: vi.fn(),
  clearRateLimit: vi.fn(),
}));

// Mock the log module
vi.mock('./log', () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { 
  redisRateLimit, 
  getRateLimitStatus as getRedisRateLimitStatus,
  checkRedisHealth,
  clearRateLimit
} from './redis-rate-limit';
import { log } from './log';

describe('Rate Limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear any in-memory buckets by resetting the module
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('enforceRateLimit', () => {
    describe('Redis-based rate limiting', () => {
      it('should allow request when Redis returns success', async () => {
        const mockRedisResult = {
          success: true,
          limit: 10,
          remaining: 9,
          reset: Date.now() + 60000,
          totalHits: 1,
        };
        
        (redisRateLimit as any).mockResolvedValue(mockRedisResult);

        await expect(
          enforceRateLimit('user123', 'test-namespace', 10)
        ).resolves.toBeUndefined();

        expect(redisRateLimit).toHaveBeenCalledWith('test-namespace:user123', {
          windowMs: 60000,
          maxRequests: 10,
          keyPrefix: 'rate_limit'
        });

        expect(log.debug).toHaveBeenCalledWith('Rate limit check passed (Redis)', {
          userId: 'user123',
          namespace: 'test-namespace',
          remaining: 9,
          totalHits: 1
        });
      });

      it('should throw error when Redis returns rate limit exceeded', async () => {
        const mockRedisResult = {
          success: false,
          limit: 10,
          remaining: 0,
          reset: Date.now() + 60000,
          totalHits: 10,
        };
        
        (redisRateLimit as any).mockResolvedValue(mockRedisResult);

        await expect(
          enforceRateLimit('user123', 'test-namespace', 10)
        ).rejects.toThrow('Rate limit exceeded. Please try again later.');

        expect(redisRateLimit).toHaveBeenCalled();
      });

      it('should fall back to memory when Redis fails', async () => {
        (redisRateLimit as any).mockRejectedValue(new Error('Redis connection failed'));

        await expect(
          enforceRateLimit('user123', 'test-namespace', 10)
        ).resolves.toBeUndefined();

        expect(log.warn).toHaveBeenCalledWith(
          'Redis rate limiting failed, falling back to memory',
          expect.objectContaining({
            error: expect.any(Error),
            userId: 'user123',
            namespace: 'test-namespace'
          })
        );

        expect(log.debug).toHaveBeenCalledWith(
          'Rate limit check passed (memory - new window)',
          expect.objectContaining({
            userId: 'user123',
            namespace: 'test-namespace',
            count: 1
          })
        );
      });

      it('should re-throw rate limit exceeded errors from Redis', async () => {
        (redisRateLimit as any).mockRejectedValue(new Error('Rate limit exceeded. Please try again later.'));

        await expect(
          enforceRateLimit('user123', 'test-namespace', 10)
        ).rejects.toThrow('Rate limit exceeded. Please try again later.');

        // Should not fall back to memory for rate limit errors
        expect(log.warn).not.toHaveBeenCalledWith(
          'Redis rate limiting failed, falling back to memory',
          expect.any(Object)
        );
      });
    });

    describe('Memory-based rate limiting fallback', () => {
      beforeEach(() => {
        // Mock Redis to always fail/return null to force memory fallback
        (redisRateLimit as any).mockResolvedValue(null);
      });

      it('should allow first request in new window', async () => {
        await expect(
          enforceRateLimit('user456', 'memory-test', 5)
        ).resolves.toBeUndefined();

        expect(log.debug).toHaveBeenCalledWith(
          'Rate limit check passed (memory - new window)',
          expect.objectContaining({
            userId: 'user456',
            namespace: 'memory-test',
            count: 1
          })
        );
      });

      it('should allow multiple requests within limit', async () => {
        const userId = 'user789';
        const namespace = 'multi-test';
        const limit = 3;

        // First request
        await expect(
          enforceRateLimit(userId, namespace, limit)
        ).resolves.toBeUndefined();

        // Second request
        await expect(
          enforceRateLimit(userId, namespace, limit)
        ).resolves.toBeUndefined();

        // Third request
        await expect(
          enforceRateLimit(userId, namespace, limit)
        ).resolves.toBeUndefined();

        expect(log.debug).toHaveBeenCalledTimes(3);
      });

      it('should reject requests exceeding limit', async () => {
        const userId = 'user999';
        const namespace = 'limit-test';
        const limit = 2;

        // First two requests should pass
        await enforceRateLimit(userId, namespace, limit);
        await enforceRateLimit(userId, namespace, limit);

        // Third request should fail
        await expect(
          enforceRateLimit(userId, namespace, limit)
        ).rejects.toThrow('Rate limit exceeded. Please try again later.');

        expect(log.warn).toHaveBeenCalledWith(
          'Rate limit exceeded (memory)',
          expect.objectContaining({
            userId,
            namespace,
            count: 2,
            limit: 2
          })
        );
      });

      it('should reset window after time expires', async () => {
        const userId = 'user-reset';
        const namespace = 'reset-test';
        const limit = 1;

        // Mock Date.now to control time
        const originalNow = Date.now;
        let mockTime = 1000000;
        Date.now = vi.fn(() => mockTime);

        try {
          // First request should pass
          await enforceRateLimit(userId, namespace, limit);

          // Second request should fail
          await expect(
            enforceRateLimit(userId, namespace, limit)
          ).rejects.toThrow('Rate limit exceeded');

          // Advance time beyond window (60 seconds)
          mockTime += 61000;

          // Request should now pass again
          await expect(
            enforceRateLimit(userId, namespace, limit)
          ).resolves.toBeUndefined();
        } finally {
          Date.now = originalNow;
        }
      });

      it('should handle different namespaces separately', async () => {
        const userId = 'user-namespaces';
        const limit = 1;

        await enforceRateLimit(userId, 'namespace1', limit);
        await enforceRateLimit(userId, 'namespace2', limit);

        // Both should work since they're different namespaces
        expect(log.debug).toHaveBeenCalledTimes(2);

        // But second request to same namespace should fail
        await expect(
          enforceRateLimit(userId, 'namespace1', limit)
        ).rejects.toThrow('Rate limit exceeded');
      });

      it('should handle different users separately', async () => {
        const namespace = 'shared-namespace';
        const limit = 1;

        await enforceRateLimit('user1', namespace, limit);
        await enforceRateLimit('user2', namespace, limit);

        // Both should work since they're different users
        expect(log.debug).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('getRateLimitStatus', () => {
    describe('Redis-based status check', () => {
      it('should return Redis status when available', async () => {
        const mockRedisStatus = {
          success: true,
          limit: 10,
          remaining: 7,
          reset: Date.now() + 30000,
          totalHits: 3,
        };

        (getRedisRateLimitStatus as any).mockResolvedValue(mockRedisStatus);

        const status = await getRateLimitStatus('user123', 'test-status', 10);

        expect(status).toEqual({
          limit: 10,
          remaining: 7,
          resetTime: mockRedisStatus.reset,
          currentUsage: 3,
          provider: 'redis'
        });

        expect(getRedisRateLimitStatus).toHaveBeenCalledWith('test-status:user123', {
          windowMs: 60000,
          maxRequests: 10,
          keyPrefix: 'rate_limit'
        });
      });

      it('should fall back to memory status when Redis fails', async () => {
        (getRedisRateLimitStatus as any).mockRejectedValue(new Error('Redis failed'));

        const status = await getRateLimitStatus('user456', 'status-fallback', 5);

        expect(status).toEqual({
          limit: 5,
          remaining: 5,
          resetTime: expect.any(Number),
          currentUsage: 0,
          provider: 'memory'
        });

        expect(log.warn).toHaveBeenCalledWith(
          'Redis rate limit status check failed',
          expect.objectContaining({
            error: expect.any(Error),
            userId: 'user456',
            namespace: 'status-fallback'
          })
        );
      });
    });

    describe('Memory-based status check', () => {
      beforeEach(() => {
        (getRedisRateLimitStatus as any).mockResolvedValue(null);
      });

      it('should return full limit for new user/namespace', async () => {
        const status = await getRateLimitStatus('new-user', 'new-namespace', 8);

        expect(status).toEqual({
          limit: 8,
          remaining: 8,
          resetTime: expect.any(Number),
          currentUsage: 0,
          provider: 'memory'
        });
      });

      it('should return correct status after some usage', async () => {
        const userId = 'status-user';
        const namespace = 'status-namespace';
        const limit = 5;

        // Use some quota first (Redis mocked to return null, so uses memory)
        (redisRateLimit as any).mockResolvedValue(null);
        await enforceRateLimit(userId, namespace, limit);
        await enforceRateLimit(userId, namespace, limit);

        // Check status
        const status = await getRateLimitStatus(userId, namespace, limit);

        expect(status).toEqual({
          limit: 5,
          remaining: 3, // 5 - 2 used
          resetTime: expect.any(Number),
          currentUsage: 2,
          provider: 'memory'
        });
      });

      it('should show zero remaining when limit exceeded', async () => {
        const userId = 'exceeded-user';
        const namespace = 'exceeded-namespace';
        const limit = 2;

        // Use up the quota
        (redisRateLimit as any).mockResolvedValue(null);
        await enforceRateLimit(userId, namespace, limit);
        await enforceRateLimit(userId, namespace, limit);

        // Check status
        const status = await getRateLimitStatus(userId, namespace, limit);

        expect(status).toEqual({
          limit: 2,
          remaining: 0,
          resetTime: expect.any(Number),
          currentUsage: 2,
          provider: 'memory'
        });
      });
    });
  });

  describe('rateLimitHealthCheck', () => {
    it('should return Redis healthy when Redis is available', async () => {
      (checkRedisHealth as any).mockResolvedValue(true);

      const health = await rateLimitHealthCheck();

      expect(health).toEqual({
        redis: true,
        memory: true,
        activeProvider: 'redis'
      });
    });

    it('should return Redis unhealthy when Redis is unavailable', async () => {
      (checkRedisHealth as any).mockResolvedValue(false);

      const health = await rateLimitHealthCheck();

      expect(health).toEqual({
        redis: false,
        memory: true,
        activeProvider: 'memory'
      });
    });
  });
});

describe('Redis Rate Limiting Integration', () => {
  // These tests would run against actual Redis in integration environments
  // For unit tests, they use mocks, but the structure is ready for integration tests
  
  it('should handle Redis pipeline failures gracefully', async () => {
    (redisRateLimit as any).mockRejectedValue(new Error('Pipeline execution failed'));

    // Should not throw, should fall back to memory
    await expect(
      enforceRateLimit('pipeline-test-user', 'pipeline-test', 5)
    ).resolves.toBeUndefined();

    expect(log.warn).toHaveBeenCalledWith(
      'Redis rate limiting failed, falling back to memory',
      expect.any(Object)
    );
  });

  it('should handle Redis connection timeouts', async () => {
    (redisRateLimit as any).mockRejectedValue(new Error('Connection timeout'));

    await expect(
      enforceRateLimit('timeout-test-user', 'timeout-test', 3)
    ).resolves.toBeUndefined();

    expect(log.warn).toHaveBeenCalledWith(
      'Redis rate limiting failed, falling back to memory',
      expect.objectContaining({
        error: expect.any(Error),
        userId: 'timeout-test-user',
        namespace: 'timeout-test'
      })
    );
  });
});