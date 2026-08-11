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
): Promise<PlatformCatalogPayload & { syncedTenants: number; syncedCategories: number }> {
  await ensurePlatformCatalogTables();
  const db = getWriteDb();
  const version = payload.version;
  const normalized = normalizePlatformCatalogPayload(payload);
  await db.execute(
    sql`INSERT INTO platform_product_catalog (version, payload, published_by)
        VALUES (${version}, ${JSON.stringify(normalized)}::jsonb, ${publishedBy})`,
  );

  const sync = await syncPublishedCategoriesToAllTenants(normalized);

  return {
    ...normalized,
    publishedAt: new Date().toISOString(),
    syncedTenants: sync.tenants,
    syncedCategories: sync.categoriesTouched,
  };
}

/**
 * Push active platform category names into every tenant's product_categories.
 * Renames alias/old names to the published label when safe; otherwise ensures the new name exists.
 */
export async function syncPublishedCategoriesToAllTenants(
  payload: PlatformCatalogPayload,
): Promise<{ tenants: number; categoriesTouched: number }> {
  const { resolveCategoryForAttributes } = await import("@/lib/category-attribute-map");
  const { productCategories, products, tenants } = await import("@/server/db/schema");
  const { eq, and } = await import("drizzle-orm");
  const { invalidateCategories } = await import("@/server/cache/invalidate");

  const activeNames = (payload.catalogCategories ?? [])
    .filter((c) => c.isActive !== false)
    .map((c) => c.name.trim())
    .filter(Boolean);

  if (activeNames.length === 0) return { tenants: 0, categoriesTouched: 0 };

  const targetByCanonical = new Map<string, string>();
  for (const name of activeNames) {
    targetByCanonical.set(resolveCategoryForAttributes(name), name);
  }

  const db = getWriteDb();
  const tenantRows = await db.query.tenants.findMany({
    columns: { id: true },
    where: eq(tenants.isActive, true),
  });

  let categoriesTouched = 0;

  for (const tenant of tenantRows) {
    const existing = await db.query.productCategories.findMany({
      where: eq(productCategories.tenantId, tenant.id),
    });
    const byName = new Map(existing.map((c) => [c.name, c]));
    let touched = false;

    for (const targetName of activeNames) {
      if (byName.has(targetName)) continue;

      // Prefer renaming an alias row that maps to the same canonical category.
      const canonical = resolveCategoryForAttributes(targetName);
      const aliasRow = existing.find((c) => {
        if (c.name === targetName) return false;
        return resolveCategoryForAttributes(c.name) === canonical;
      });

      if (aliasRow && !byName.has(targetName)) {
        await db
          .update(productCategories)
          .set({ name: targetName })
          .where(eq(productCategories.id, aliasRow.id));
        byName.delete(aliasRow.name);
        byName.set(targetName, { ...aliasRow, name: targetName });
        touched = true;
        categoriesTouched += 1;
        continue;
      }

      const [inserted] = await db
        .insert(productCategories)
        .values({ tenantId: tenant.id, name: targetName, icon: null })
        .onConflictDoNothing({
          target: [productCategories.tenantId, productCategories.name],
        })
        .returning();
      if (inserted) {
        byName.set(targetName, inserted);
        touched = true;
        categoriesTouched += 1;
      }
    }

    // Second pass: rename leftover aliases when target already exists — re-point products then drop alias.
    for (const row of existing) {
      const canonical = resolveCategoryForAttributes(row.name);
      const targetName = targetByCanonical.get(canonical);
      if (!targetName || row.name === targetName) continue;
      const target = byName.get(targetName);
      if (!target || target.id === row.id) continue;

      await db
        .update(products)
        .set({ categoryId: target.id })
        .where(
          and(eq(products.tenantId, tenant.id), eq(products.categoryId, row.id)),
        );
      await db.delete(productCategories).where(eq(productCategories.id, row.id));
      byName.delete(row.name);
      touched = true;
      categoriesTouched += 1;
    }

    if (touched) {
      await invalidateCategories(tenant.id);
    }
  }

  return { tenants: tenantRows.length, categoriesTouched };
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
