import { 
  redisRateLimit, 
  getRateLimitStatus as getRedisRateLimitStatus, 
  checkRedisHealth,
  getRedisMetrics,
  cleanupExpiredRateLimits
} from "@/lib/redis-rate-limit";
import { log } from "@/lib/log";

// In-memory rate limit fallback for development/local or when Redis is unavailable
const memoryBuckets = new Map<string, { windowStart: number; count: number }>();

/**
 * Enforces rate limiting using Redis in production or memory fallback
 * Maintains backward compatibility with existing function signature
 */
export async function enforceRateLimit(
  userId: string,
  namespace: string,
  limitPerMinute = 10
) {
  const identifier = `${namespace}:${userId}`;
  const windowMs = 60_000; // 1 minute
  
  try {
    // Try Redis-based rate limiting first
    const result = await redisRateLimit(identifier, {
      windowMs,
      maxRequests: limitPerMinute,
      keyPrefix: "rate_limit"
    });
    
    // If Redis returned a successful response (even if rate limited)
    if (result) {
      if (!result.success) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      
      log.debug("Rate limit check passed (Redis)", {
        userId,
        namespace,
        remaining: result.remaining,
        totalHits: result.totalHits
      });
      return;
    }
  } catch (error) {
    // If the error is our rate limit exceeded error, re-throw it
    if (error instanceof Error && error.message.includes("Rate limit exceeded")) {
      throw error;
    }
    
    // For other errors, log and fall back to memory-based limiting
    log.warn("Redis rate limiting failed, falling back to memory", { 
      error,
      userId,
      namespace 
    });
  }
  
  // Fallback to memory-based rate limiting
  const key = `${namespace}:${userId}`;
  const now = Date.now();
  const bucket = memoryBuckets.get(key);
  
  if (!bucket || now - bucket.windowStart >= windowMs) {
    memoryBuckets.set(key, { windowStart: now, count: 1 });
    log.debug("Rate limit check passed (memory - new window)", {
      userId,
      namespace,
      count: 1
    });
    return;
  }
  
  if (bucket.count >= limitPerMinute) {
    log.warn("Rate limit exceeded (memory)", {
      userId,
      namespace,
      count: bucket.count,
      limit: limitPerMinute
    });
    throw new Error("Rate limit exceeded. Please try again later.");
  }
  
  bucket.count += 1;
  log.debug("Rate limit check passed (memory)", {
    userId,
    namespace,
    count: bucket.count,
    limit: limitPerMinute
  });
}

/**
 * Get current rate limit status for a user/namespace combination
 * Returns information about current usage without incrementing the count
 */
export async function getRateLimitStatus(
  userId: string,
  namespace: string,
  limitPerMinute = 10
) {
  const identifier = `${namespace}:${userId}`;
  const windowMs = 60_000;
  
  try {
    // Try Redis-based status check first
    const result = await getRedisRateLimitStatus(identifier, {
      windowMs,
      maxRequests: limitPerMinute,
      keyPrefix: "rate_limit"
    });
    
    if (result) {
      return {
        limit: result.limit,
        remaining: result.remaining,
        resetTime: result.reset,
        currentUsage: result.totalHits,
        provider: "redis" as const
      };
    }
  } catch (error) {
    log.warn("Redis rate limit status check failed", { error, userId, namespace });
  }
  
  // Fallback to memory-based status check
  const key = `${namespace}:${userId}`;
  const now = Date.now();
  const bucket = memoryBuckets.get(key);
  
  if (!bucket || now - bucket.windowStart >= windowMs) {
    return {
      limit: limitPerMinute,
      remaining: limitPerMinute,
      resetTime: now + windowMs,
      currentUsage: 0,
      provider: "memory" as const
    };
  }
  
  return {
    limit: limitPerMinute,
    remaining: Math.max(0, limitPerMinute - bucket.count),
    resetTime: bucket.windowStart + windowMs,
    currentUsage: bucket.count,
    provider: "memory" as const
  };
}

/**
 * Health check for the rate limiting system
 */
export async function rateLimitHealthCheck() {
  const redisHealthy = await checkRedisHealth();
  
  return {
    redis: redisHealthy,
    memory: true, // Memory is always available
    activeProvider: redisHealthy ? "redis" : "memory"
  };
}

/**
 * Get comprehensive rate limiting metrics for monitoring and observability
 */
export async function getRateLimitingMetrics() {
  try {
    const [redisMetrics, healthStatus] = await Promise.allSettled([
      getRedisMetrics(),
      rateLimitHealthCheck()
    ]);

    const memoryStats = {
      bucketsCount: memoryBuckets.size,
      oldestBucket: getOldestMemoryBucketAge(),
    };

    return {
      timestamp: new Date().toISOString(),
      health: healthStatus.status === "fulfilled" ? healthStatus.value : { redis: false, memory: true, activeProvider: "memory" },
      redis: redisMetrics.status === "fulfilled" ? redisMetrics.value : { healthy: false, responseTime: null, keysCount: null, memoryUsage: null, error: "Failed to fetch metrics" },
      memory: memoryStats,
      provider: (healthStatus.status === "fulfilled" && healthStatus.value.redis) ? "redis" : "memory"
    };
  } catch (error) {
    log.error("Failed to collect rate limiting metrics", { error });
    return {
      timestamp: new Date().toISOString(),
      health: { redis: false, memory: true, activeProvider: "memory" },
      redis: { healthy: false, responseTime: null, keysCount: null, memoryUsage: null, error: "Metrics collection failed" },
      memory: { bucketsCount: memoryBuckets.size, oldestBucket: null },
      provider: "memory",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Maintenance function to clean up expired data from both Redis and memory
 */
export async function performRateLimitMaintenance() {
  try {
    const results = {
      redis: { cleaned: 0, error: undefined as string | undefined },
      memory: { cleaned: 0 },
      timestamp: new Date().toISOString()
    };

    // Clean up Redis
    try {
      const redisCleanup = await cleanupExpiredRateLimits();
      results.redis.cleaned = redisCleanup.cleaned;
      results.redis.error = redisCleanup.error;
    } catch (error) {
      results.redis.error = error instanceof Error ? error.message : String(error);
      log.error("Redis rate limit cleanup failed", { error });
    }

    // Clean up memory buckets
    const now = Date.now();
    const windowMs = 60_000;
    let memoryCleanedCount = 0;

    for (const [key, bucket] of memoryBuckets.entries()) {
      if (now - bucket.windowStart >= windowMs) {
        memoryBuckets.delete(key);
        memoryCleanedCount++;
      }
    }

    results.memory.cleaned = memoryCleanedCount;

    log.info("Rate limit maintenance completed", results);
    return results;
  } catch (error) {
    log.error("Rate limit maintenance failed", { error });
    throw error;
  }
}

// Helper function to get the age of the oldest memory bucket
function getOldestMemoryBucketAge(): number | null {
  if (memoryBuckets.size === 0) return null;
  
  const now = Date.now();
  let oldest = now;
  
  for (const bucket of memoryBuckets.values()) {
    if (bucket.windowStart < oldest) {
      oldest = bucket.windowStart;
    }
  }
  
  return now - oldest;
}
