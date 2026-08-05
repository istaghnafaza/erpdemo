// =============================================================================
// Platform catalog — publish & sync untuk semua toko
// =============================================================================

import { sql } from "drizzle-orm";
import { getWriteDb } from "@/server/db";
import { ensurePlatformCatalogTables } from "@/server/db/ensure-platform-catalog";
import { getSeedPlatformCatalogPayload, normalizePlatformCatalogPayload } from "@/lib/product-catalog-seed";
import type { CatalogRequest, PlatformCatalogPayload } from "@/types/product-attributes";

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] }).rows ?? []) as T[];
}

export async function getPublishedPlatformCatalog(): Promise<PlatformCatalogPayload | null> {
  await ensurePlatformCatalogTables();
  const db = getWriteDb();
  const rows = rowsOf<{ version: number; payload: PlatformCatalogPayload; published_at: string }>(
    await db.execute(
      sql`SELECT version, payload, published_at FROM platform_product_catalog ORDER BY version DESC LIMIT 1`,
    ),
  );
  const row = rows[0];
  if (!row) return null;
  return normalizePlatformCatalogPayload({
    ...row.payload,
    version: row.version,
    publishedAt: row.published_at,
  });
}

export async function getOrSeedPublishedCatalog(): Promise<PlatformCatalogPayload> {
  const existing = await getPublishedPlatformCatalog();
  if (existing) return existing;
  const seed = getSeedPlatformCatalogPayload();
  await publishPlatformCatalog(seed, null);
  return seed;
}

export async function publishPlatformCatalog(
  payload: PlatformCatalogPayload,
  publishedBy: string | null,
): Promise<PlatformCatalogPayload> {
  await ensurePlatformCatalogTables();
  const db = getWriteDb();
  const version = payload.version;
  await db.execute(
    sql`INSERT INTO platform_product_catalog (version, payload, published_by)
        VALUES (${version}, ${JSON.stringify(payload)}::jsonb, ${publishedBy})`,
  );
  return { ...payload, publishedAt: new Date().toISOString() };
}

export async function listCatalogRequests(status?: string): Promise<CatalogRequest[]> {
  await ensurePlatformCatalogTables();
  const db = getWriteDb();
  const query =
    status && status !== "all"
      ? sql`SELECT id, tenant_id, tenant_name, kind, status, payload, notes, created_at, resolved_at
            FROM catalog_requests WHERE status = ${status}
            ORDER BY created_at ASC`
      : sql`SELECT id, tenant_id, tenant_name, kind, status, payload, notes, created_at, resolved_at
            FROM catalog_requests ORDER BY created_at DESC LIMIT 200`;
  const rows = rowsOf<{
    id: string;
    tenant_id: string;
    tenant_name: string;
    kind: string;
    status: string;
    payload: Record<string, unknown>;
    notes: string | null;
    created_at: string;
    resolved_at: string | null;
  }>(await db.execute(query));
  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenant_id,
    tenantName: r.tenant_name,
    kind: r.kind as CatalogRequest["kind"],
    status: r.status as CatalogRequest["status"],
    categoryName: r.payload.categoryName as string | undefined,
    productTypeName: r.payload.productTypeName as string | undefined,
    attributeName: r.payload.attributeName as string | undefined,
    proposedLabel: (r.payload.proposedLabel as string) ?? "",
    proposedAbbreviation: r.payload.proposedAbbreviation as string | undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at ?? undefined,
  }));
}

export async function createCatalogRequest(
  tenantId: string,
  tenantName: string,
  input: Omit<CatalogRequest, "id" | "tenantId" | "tenantName" | "status" | "createdAt">,
): Promise<CatalogRequest> {
  await ensurePlatformCatalogTables();
  const db = getWriteDb();
  const payload = {
    categoryName: input.categoryName,
    productTypeName: input.productTypeName,
    attributeName: input.attributeName,
    proposedLabel: input.proposedLabel,
    proposedAbbreviation: input.proposedAbbreviation,
  };
  const rows = rowsOf<{ id: string; created_at: string }>(
    await db.execute(
      sql`INSERT INTO catalog_requests (tenant_id, tenant_name, kind, payload, notes)
          VALUES (${tenantId}, ${tenantName}, ${input.kind}, ${JSON.stringify(payload)}::jsonb, ${input.notes ?? null})
          RETURNING id, created_at`,
    ),
  );
  const row = rows[0];
  return {
    id: row.id,
    tenantId,
    tenantName,
    kind: input.kind,
    status: "pending",
    ...input,
    createdAt: row.created_at,
  };
}

export async function resolveCatalogRequest(
  requestId: string,
  status: "approved" | "rejected",
  resolvedBy: string | null,
): Promise<void> {
  await ensurePlatformCatalogTables();
  const db = getWriteDb();
  await db.execute(
    sql`UPDATE catalog_requests
        SET status = ${status}, resolved_at = now(), resolved_by = ${resolvedBy}
        WHERE id = ${requestId}::uuid`,
  );
}
