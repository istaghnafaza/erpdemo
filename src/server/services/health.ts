// =============================================================================
// Health check — Neon connectivity & basic schema sanity (Phase 6 cutover)
// =============================================================================

import { count, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { tenants } from "@/server/db/schema";

export interface HealthReport {
  ok: boolean;
  timestamp: string;
  postgresVersion: string;
  tenantCount: number;
}

export async function getHealthReport(): Promise<HealthReport> {
  const db = getDb();

  const versionResult = await db.execute(sql`SELECT version() AS v`);
  const versionRow = Array.isArray(versionResult)
    ? (versionResult[0] as { v?: string })
    : (versionResult as { rows?: { v: string }[] }).rows?.[0];
  const postgresVersion = versionRow?.v ?? "unknown";

  const [tenantRow] = await db.select({ n: count() }).from(tenants);

  return {
    ok: true,
    timestamp: new Date().toISOString(),
    postgresVersion,
    tenantCount: Number(tenantRow?.n ?? 0),
  };
}
