// =============================================================================
// Server-side cache — Upstash Redis when configured, in-memory fallback otherwise.
// =============================================================================

import { readEnv } from "@/server/env";
import { Redis } from "@upstash/redis";

type MemoryEntry = { value: string; expiresAt: number };

const memory = new Map<string, MemoryEntry>();
/** Tracks multi-branch cache keys per tenant for targeted invalidation. */
const multiKeysByTenant = new Map<string, Set<string>>();

let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;

  const url = readEnv("UPSTASH_REDIS_REST_URL");
  const token = readEnv("UPSTASH_REDIS_REST_TOKEN");
  if (!url || !token) {
    redisClient = null;
    return null;
  }

  try {
    redisClient = new Redis({ url, token });
  } catch {
    redisClient = null;
  }
  return redisClient;
}

function pruneMemory(now: number) {
  for (const [key, entry] of memory) {
    if (now >= entry.expiresAt) memory.delete(key);
  }
}

export function isRedisConfigured(): boolean {
  return getRedis() != null;
}

export function getRedisClient(): Redis | null {
  return getRedis();
}

let cacheHits = 0;
let cacheMisses = 0;

export function getCacheStats() {
  const total = cacheHits + cacheMisses;
  return {
    hits: cacheHits,
    misses: cacheMisses,
    hitRatePct: total > 0 ? Math.round((cacheHits / total) * 1000) / 10 : null,
    backend: getRedis() ? "redis" : "memory",
    memoryKeys: memory.size,
  };
}

export function resetCacheStatsForTests() {
  cacheHits = 0;
  cacheMisses = 0;
}

export function registerMultiBranchCacheKey(tenantId: string, key: string) {
  let set = multiKeysByTenant.get(tenantId);
  if (!set) {
    set = new Set();
    multiKeysByTenant.set(tenantId, set);
  }
  set.add(key);
}

export async function clearTrackedMultiBranchKeys(tenantId: string): Promise<void> {
  const tracked = multiKeysByTenant.get(tenantId);
  if (!tracked) return;
  await Promise.all([...tracked].map((key) => cacheDel(key)));
  tracked.clear();
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const value = await redis.get<T>(key);
      if (value != null) cacheHits += 1;
      else cacheMisses += 1;
      return value ?? null;
    } catch {
      cacheMisses += 1;
      return null;
    }
  }

  const now = Date.now();
  pruneMemory(now);
  const entry = memory.get(key);
  if (!entry || now >= entry.expiresAt) {
    memory.delete(key);
    cacheMisses += 1;
    return null;
  }
  cacheHits += 1;
  return JSON.parse(entry.value) as T;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key, value, { ex: ttlSeconds });
    } catch {
      // ignore — next read falls through to DB
    }
    return;
  }

  memory.set(key, {
    value: JSON.stringify(value),
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export async function cacheDel(key: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(key);
    } catch {
      // ignore
    }
  }
  memory.delete(key);
}

export async function cacheDelPrefix(prefix: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      let cursor = 0;
      do {
        const [nextCursor, keys] = await redis.scan(cursor, { match: `${prefix}*`, count: 100 });
        cursor = Number(nextCursor);
        if (keys.length > 0) await redis.del(...keys);
      } while (cursor !== 0);
    } catch {
      // ignore
    }
  }

  for (const key of memory.keys()) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
}

export async function getCached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit != null) return hit;

  const value = await loader();
  await cacheSet(key, value, ttlSeconds);
  return value;
}

export const CACHE_TTL = {
  branchProducts: 90,
  categories: 300,
  customers: 90,
  branches: 300,
  suppliers: 120,
} as const;
