// =============================================================================
// Server fn rate limit — abuse protection for heavy read endpoints (Fase C)
// =============================================================================

import { checkRateLimitAsync, getClientIp } from "@/server/rate-limit";

export async function assertServerFnRateLimit(
  scope: string,
  tenantId: string,
  options?: { maxAttempts?: number; windowMs?: number },
): Promise<void> {
  const ip = await getClientIp();
  const key = `sfn:${scope}:${tenantId}:${ip}`;
  const result = await checkRateLimitAsync(key, {
    maxAttempts: options?.maxAttempts ?? 120,
    windowMs: options?.windowMs ?? 60_000,
  });

  if (!result.allowed) {
    throw new Error(
      `Terlalu banyak permintaan. Coba lagi dalam ${result.retryAfterSec ?? 60} detik.`,
    );
  }
}

export async function assertAuthRateLimit(scope: string): Promise<void> {
  const ip = await getClientIp();
  const key = `auth:${scope}:${ip}`;
  const result = await checkRateLimitAsync(key, {
    maxAttempts: scope === "register" ? 5 : 10,
    windowMs: 15 * 60 * 1000,
  });

  if (!result.allowed) {
    throw new Error(
      `Terlalu banyak percobaan. Coba lagi dalam ${result.retryAfterSec ?? 900} detik.`,
    );
  }
}
