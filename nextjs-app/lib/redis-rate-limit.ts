import { Redis } from "@upstash/redis";
import { log } from "@/lib/log";

// Redis client configuration
let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
  if (redisClient) return redisClient;
  
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!redisUrl || !redisToken) {
    log.info("Redis credentials not configured, falling back to memory-based rate limiting");
    return null;
  }
  
  try {
    redisClient = new Redis({
      url: redisUrl,
      token: redisToken,
    });
    return redisClient;
  } catch (error) {
    log.error("Failed to initialize Redis client", { error });
    return null;
  }
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  totalHits: number;
}

export interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  keyPrefix?: string;
}

/**
 * Redis-based rate limiter using sliding window algorithm
 * Uses sorted sets to track request timestamps within the window
 */
export async function redisRateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const {
    windowMs = 60_000, // 1 minute default
    maxRequests = 10,
    keyPrefix = "rate_limit"
  } = options;
  
  const redis = getRedisClient();
  
  // If Redis is not available, fail open (allow the request)
  if (!redis) {
    log.warn("Redis unavailable, failing open for rate limiting");
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      reset: Date.now() + windowMs,
      totalHits: 1,
    };
  }
  
  const key = `${keyPrefix}:${identifier}`;
  const now = Date.now();
  const windowStart = now - windowMs;
  
  try {
    // Use Redis pipeline for atomic operations
    const pipeline = redis.pipeline();
    
    // Remove expired entries (older than the window)
    pipeline.zremrangebyscore(key, 0, windowStart);
    
    // Count current requests in the window
    pipeline.zcard(key);
    
    // Add current request timestamp
    pipeline.zadd(key, { score: now, member: `${now}:${Math.random()}` });
    
    // Set expiration on the key (cleanup after window expires)
    pipeline.expire(key, Math.ceil(windowMs / 1000));
    
    // Execute pipeline
    const results = await pipeline.exec();
    
    if (!results || results.length !== 4) {
      throw new Error("Redis pipeline execution failed");
    }
    
    // Extract results from pipeline
    const currentCount = (results[1] as number) || 0;
    
    // Check if the request should be allowed
    const isAllowed = currentCount < maxRequests;
    const remaining = Math.max(0, maxRequests - currentCount - 1);
    const resetTime = now + windowMs;
    
    if (!isAllowed) {
      // If rate limit exceeded, remove the request we just added
      await redis.zrem(key, `${now}:${Math.random()}`);
    }
    
    log.debug("Redis rate limit check", {
      identifier,
      currentCount,
      maxRequests,
      isAllowed,
      remaining,
      windowMs,
    });
    
    return {
      success: isAllowed,
      limit: maxRequests,
      remaining: isAllowed ? remaining : 0,
      reset: resetTime,
      totalHits: currentCount + (isAllowed ? 1 : 0),
    };
    
  } catch (error) {
    log.error("Redis rate limit error, failing open", { error, identifier });
    
    // Fail open - allow the request if Redis operations fail
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      reset: now + windowMs,
      totalHits: 1,
    };
  }
}

/**
 * Get current rate limit status without incrementing the count
 */
export async function getRateLimitStatus(
  identifier: string,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const {
    windowMs = 60_000,
    maxRequests = 10,
    keyPrefix = "rate_limit"
  } = options;
  
  const redis = getRedisClient();
  
  if (!redis) {
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests,
      reset: Date.now() + windowMs,
      totalHits: 0,
    };
  }
  
  const key = `${keyPrefix}:${identifier}`;
  const now = Date.now();
  const windowStart = now - windowMs;
  
  try {
    // Remove expired entries and count current requests
    await redis.zremrangebyscore(key, 0, windowStart);
    const currentCount = await redis.zcard(key);
    
    const remaining = Math.max(0, maxRequests - currentCount);
    const resetTime = now + windowMs;
    
    return {
      success: currentCount < maxRequests,
      limit: maxRequests,
      remaining,
      reset: resetTime,
      totalHits: currentCount,
    };
    
  } catch (error) {
    log.error("Redis rate limit status check error", { error, identifier });
    
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests,
      reset: now + windowMs,
      totalHits: 0,
    };
  }
}

/**
 * Clear rate limit data for a specific identifier (useful for testing)
 */
export async function clearRateLimit(
  identifier: string,
  keyPrefix = "rate_limit"
): Promise<void> {
  const redis = getRedisClient();
  
  if (!redis) {
    return;
  }
  
  const key = `${keyPrefix}:${identifier}`;
  
  try {
    await redis.del(key);
    log.debug("Cleared rate limit data", { identifier });
  } catch (error) {
    log.error("Failed to clear rate limit data", { error, identifier });
  }
}

/**
 * Get detailed Redis metrics for monitoring
 */
export async function getRedisMetrics(): Promise<{
  healthy: boolean;
  responseTime: number | null;
  keysCount: number | null;
  memoryUsage: string | null;
  error?: string;
}> {
  const redis = getRedisClient();
  
  if (!redis) {
    return {
      healthy: false,
      responseTime: null,
      keysCount: null,
      memoryUsage: null,
      error: "Redis client not configured"
    };
  }
  
  try {
    const startTime = Date.now();
    
    // Health check with ping only (Upstash Redis doesn't support INFO command)
    const pingResult = await Promise.allSettled([
      redis.ping()
    ]);
    
    const responseTime = Date.now() - startTime;
    
    if (pingResult[0].status === "rejected") {
      throw pingResult[0].reason;
    }
    
    // Note: Upstash Redis REST API doesn't support INFO command for memory usage
    let memoryUsage: string | null = null;
    
    // Get approximate count of rate limit keys
    let keysCount: number | null = null;
    try {
      const keys = await redis.keys("rate_limit:*");
      keysCount = Array.isArray(keys) ? keys.length : 0;
    } catch (error) {
      log.debug("Could not fetch rate limit keys count", { error });
    }
    
    log.debug("Redis metrics collected", {
      responseTime,
      keysCount,
      memoryUsage
    });
    
    return {
      healthy: true,
      responseTime,
      keysCount,
      memoryUsage,
    };
    
  } catch (error) {
    log.error("Redis metrics collection failed", { error });
    return {
      healthy: false,
      responseTime: null,
      keysCount: null,
      memoryUsage: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Health check for Redis connection
 */
export async function checkRedisHealth(): Promise<boolean> {
  const redis = getRedisClient();
  
  if (!redis) {
    return false;
  }
  
  try {
    const startTime = Date.now();
    await redis.ping();
    const responseTime = Date.now() - startTime;
    
    // Log slow responses for monitoring
    if (responseTime > 100) {
      log.warn("Slow Redis response detected", { responseTime });
    }
    
    return true;
  } catch (error) {
    log.error("Redis health check failed", { error });
    return false;
  }
}

/**
 * Clean up expired rate limit data (useful for maintenance)
 */
export async function cleanupExpiredRateLimits(): Promise<{
  cleaned: number;
  error?: string;
}> {
  const redis = getRedisClient();
  
  if (!redis) {
    return {
      cleaned: 0,
      error: "Redis client not configured"
    };
  }
  
  try {
    const now = Date.now();
    const keys = await redis.keys("rate_limit:*");
    
    if (!Array.isArray(keys) || keys.length === 0) {
      return { cleaned: 0 };
    }
    
    let cleaned = 0;
    
    // Process keys in batches to avoid blocking Redis
    const batchSize = 100;
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      const pipeline = redis.pipeline();
      
      for (const key of batch) {
        // Remove entries older than 5 minutes (safety margin beyond normal window)
        const cutoff = now - 5 * 60 * 1000;
        pipeline.zremrangebyscore(key, 0, cutoff);
      }
      
      const results = await pipeline.exec();
      cleaned += results?.filter(result => Array.isArray(result) && result[1] > 0).length || 0;
    }
    
    log.info("Rate limit cleanup completed", { cleaned, totalKeys: keys.length });
    
    return { cleaned };
    
  } catch (error) {
    log.error("Rate limit cleanup failed", { error });
    return {
      cleaned: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}