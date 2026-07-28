// =============================================================================
// In-memory rate limiter (per key). Suitable for single-instance deploys;
// replace with Redis (P0-3) when scaling horizontally.
// =============================================================================

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Periodic cleanup so the map does not grow without bound. */
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
let lastCleanup = Date.now();

function pruneExpired(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

export interface RateLimitOptions {
  maxAttempts: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec?: number;
}

export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  pruneExpired(now);

  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true };
  }

  if (bucket.count >= options.maxAttempts) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true };
}

export function clearRateLimit(key: string) {
  buckets.delete(key);
}

/** Redis-backed rate limit when Upstash is configured; falls back to in-memory. */
export async function checkRateLimitAsync(
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  try {
    const { getRedisClient } = await import("@/server/cache/redis");
    const redis = getRedisClient();
    if (redis) {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, Math.max(1, Math.ceil(options.windowMs / 1000)));
      }
      if (count > options.maxAttempts) {
        const ttl = await redis.ttl(key);
        return {
          allowed: false,
          retryAfterSec: Math.max(1, ttl > 0 ? ttl : Math.ceil(options.windowMs / 1000)),
        };
      }
      return { allowed: true };
    }
  } catch {
    // fall through to in-memory
  }
  return checkRateLimit(key, options);
}

export async function getClientIp(): Promise<string> {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const forwarded = getRequestHeader("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return getRequestHeader("x-real-ip") ?? getRequestHeader("cf-connecting-ip") ?? "unknown";
}
