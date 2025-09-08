// In-memory rate limit for development/local. For production, wire a Redis-based limiter.
const memoryBuckets = new Map<string, { windowStart: number; count: number }>();

export async function enforceRateLimit(
  userId: string,
  namespace: string,
  limitPerMinute = 10
) {
  const key = `${namespace}:${userId}`;
  const now = Date.now();
  const windowMs = 60_000;
  const bucket = memoryBuckets.get(key);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    memoryBuckets.set(key, { windowStart: now, count: 1 });
    return;
  }
  if (bucket.count >= limitPerMinute) {
    throw new Error("Rate limit exceeded. Please try again later.");
  }
  bucket.count += 1;
}
