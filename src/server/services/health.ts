// =============================================================================
// Health check — Neon connectivity & ops metrics (Phase C)
// =============================================================================

import { count, sql } from "drizzle-orm";
import { getCacheStats, isRedisConfigured } from "@/server/cache/redis";
import { getReadDb, getWriteDb, isReadReplicaConfigured } from "@/server/db";
import { dailyBranchSales, tenants } from "@/server/db/schema";

export interface HealthReport {
  ok: boolean;
  timestamp: string;
  postgresVersion: string;
  tenantCount: number;
  readReplica: boolean;
  redisConfigured: boolean;
  cache: ReturnType<typeof getCacheStats>;
  dailyAggregateRows: number;
}

export async function getHealthReport(): Promise<HealthReport> {
  const db = getWriteDb();

  const versionResult = await db.execute(sql`SELECT version() AS v`);
  const versionRow = Array.isArray(versionResult)
    ? (versionResult[0] as { v?: string })
    : (versionResult as { rows?: { v: string }[] }).rows?.[0];
  const postgresVersion = versionRow?.v ?? "unknown";

  const [tenantRow] = await db.select({ n: count() }).from(tenants);

  let dailyAggregateRows = 0;
  try {
    const readDb = getReadDb();
    const [aggRow] = await readDb.select({ n: count() }).from(dailyBranchSales);
    dailyAggregateRows = Number(aggRow?.n ?? 0);
  } catch {
    dailyAggregateRows = -1;
  }

  return {
    ok: true,
    timestamp: new Date().toISOString(),
    postgresVersion,
    tenantCount: Number(tenantRow?.n ?? 0),
    readReplica: isReadReplicaConfigured(),
    redisConfigured: isRedisConfigured(),
    cache: getCacheStats(),
    dailyAggregateRows,
  };
}
