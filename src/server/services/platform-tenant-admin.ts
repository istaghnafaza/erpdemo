// =============================================================================
// Platform admin — override tenant plan / dates + cross-store price search
// =============================================================================

import { eq, sql } from "drizzle-orm";
import {
  defaultPlanAccessDates,
  getTenantAccessStatus,
  isPaidPlan,
  type BillingCycle,
} from "@/lib/plan-config";
import { getDb, getWriteDb } from "@/server/db";
import { ensurePlanBillingSchema } from "@/server/db/ensure-plan-billing-schema";
import { tenantSubscriptions } from "@/server/db/schema";
import { getTenantById, updateTenant } from "@/server/services/tenants";
import type { TenantPlan } from "@/types/app";
import type { Tenant } from "@/types/database";
import type {
  PlatformPriceCompareRow,
  PlatformProductSupplierPayload,
  PlatformTenantAccessUpdate,
} from "@/types/platform";

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const withRows = result as { rows?: T[] };
  return withRows.rows ?? [];
}

export async function adminUpdateTenantAccess(input: PlatformTenantAccessUpdate): Promise<Tenant> {
  await ensurePlanBillingSchema();

  const existing = await getTenantById(input.tenantId);
  if (!existing) throw new Error("Tenant tidak ditemukan");

  const plan = input.plan as TenantPlan;
  const cycle: BillingCycle = input.billingCycle === "yearly" ? "yearly" : "monthly";
  const defaults = defaultPlanAccessDates(plan, cycle);

  const trialEndsAt = input.applyDefaultDates
    ? defaults.trialEndsAt
    : input.trialEndsAt !== undefined
      ? input.trialEndsAt
      : existing.trial_ends_at;
  const planRenewsAt = input.applyDefaultDates
    ? defaults.planRenewsAt
    : input.planRenewsAt !== undefined
      ? input.planRenewsAt
      : existing.plan_renews_at;

  const updated = await updateTenant(input.tenantId, {
    plan,
    trial_ends_at: trialEndsAt,
    plan_renews_at: planRenewsAt,
    is_active: input.isActive,
  });
  if (!updated) throw new Error("Gagal menyimpan tenant");

  const db = getWriteDb();
  const now = new Date();
  const periodEnd = planRenewsAt ? new Date(planRenewsAt) : null;
  const access = getTenantAccessStatus(updated);
  const subStatus =
    plan === "trial"
      ? ("trialing" as const)
      : access === "past_due"
        ? ("past_due" as const)
        : ("active" as const);

  const existingSub = await db.query.tenantSubscriptions.findFirst({
    where: eq(tenantSubscriptions.tenantId, input.tenantId),
  });

  if (existingSub) {
    await db
      .update(tenantSubscriptions)
      .set({
        plan,
        status: subStatus,
        billingCycle: plan === "trial" ? existingSub.billingCycle : cycle,
        currentPeriodEnd: periodEnd,
        updatedAt: now,
      })
      .where(eq(tenantSubscriptions.tenantId, input.tenantId));
  } else if (isPaidPlan(plan)) {
    await db.insert(tenantSubscriptions).values({
      tenantId: input.tenantId,
      plan,
      status: subStatus,
      billingCycle: cycle,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      createdAt: now,
      updatedAt: now,
    });
  }

  return updated;
}

type RawPriceRow = {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  branch_id: string;
  branch_name: string;
  product_id: string;
  sku: string;
  product_name: string;
  unit: string;
  selling_price: number | string | null;
  stock: number | string | null;
};

export async function searchPlatformProductPrices(query: string): Promise<PlatformPriceCompareRow[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const db = getDb();
  const like = `%${q.replace(/[%_\\]/g, (ch) => `\\${ch}`)}%`;
  const result = await db.execute<RawPriceRow>(sql`
    SELECT
      t.id AS tenant_id,
      t.name AS tenant_name,
      t.slug AS tenant_slug,
      b.id AS branch_id,
      b.name AS branch_name,
      p.id AS product_id,
      p.sku,
      p.name AS product_name,
      p.unit,
      bp.selling_price,
      bp.stock
    FROM products p
    JOIN tenants t ON t.id = p.tenant_id
    JOIN branch_products bp ON bp.product_id = p.id AND bp.tenant_id = p.tenant_id
    JOIN branches b ON b.id = bp.branch_id
    WHERE p.is_active = true
      AND b.is_active = true
      AND (
        p.name ILIKE ${like}
        OR p.sku ILIKE ${like}
        OR COALESCE(p.barcode, '') ILIKE ${like}
      )
    ORDER BY p.name ASC, bp.selling_price ASC, t.name ASC
    LIMIT 200
  `);

  return rowsOf<RawPriceRow>(result).map((row) => ({
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    tenantSlug: row.tenant_slug,
    branchId: row.branch_id,
    branchName: row.branch_name,
    productId: row.product_id,
    sku: row.sku,
    productName: row.product_name,
    unit: row.unit,
    sellingPrice: Number(row.selling_price ?? 0),
    stock: Number(row.stock ?? 0),
  }));
}

type RawSupplierRow = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  address: string | null;
  email: string | null;
  payment_term_days: number | string | null;
  is_active: boolean;
  is_preferred: boolean | null;
  last_price: number | string | null;
  last_po_number: string | null;
  last_po_at: Date | string | null;
};

export async function getPlatformProductSuppliers(
  tenantId: string,
  productId: string,
): Promise<PlatformProductSupplierPayload> {
  const { ensureProductSuppliersTable } = await import("@/server/db/ensure-product-suppliers");
  await ensureProductSuppliersTable();

  const db = getDb();
  const productResult = await db.execute<{
    product_name: string;
    sku: string;
    unit: string;
    purchase_price: number | string | null;
    tenant_name: string;
  }>(sql`
    SELECT p.name AS product_name, p.sku, p.unit, p.purchase_price, t.name AS tenant_name
    FROM products p
    JOIN tenants t ON t.id = p.tenant_id
    WHERE p.id = ${productId} AND p.tenant_id = ${tenantId}
    LIMIT 1
  `);
  const product = rowsOf(productResult)[0];
  if (!product) throw new Error("Produk tidak ditemukan di toko ini");

  const supplierResult = await db.execute<RawSupplierRow>(sql`
    SELECT
      s.id,
      s.name,
      s.contact_person,
      s.phone,
      s.address,
      s.email,
      s.payment_term_days,
      s.is_active,
      COALESCE(ps.is_preferred, false) AS is_preferred,
      last_po.last_price,
      last_po.last_po_number,
      last_po.last_po_at
    FROM suppliers s
    LEFT JOIN product_suppliers ps
      ON ps.supplier_id = s.id
     AND ps.product_id = ${productId}
     AND ps.tenant_id = ${tenantId}
    LEFT JOIN LATERAL (
      SELECT
        poi.purchase_price AS last_price,
        po.po_number AS last_po_number,
        po.created_at AS last_po_at
      FROM purchase_order_items poi
      JOIN purchase_orders po ON po.id = poi.po_id
      WHERE poi.tenant_id = ${tenantId}
        AND poi.product_id = ${productId}
        AND po.supplier_id = s.id
      ORDER BY po.created_at DESC
      LIMIT 1
    ) last_po ON true
    WHERE s.tenant_id = ${tenantId}
      AND (ps.id IS NOT NULL OR last_po.last_price IS NOT NULL)
    ORDER BY COALESCE(ps.is_preferred, false) DESC, s.name ASC
  `);

  return {
    tenantId,
    tenantName: product.tenant_name,
    productId,
    productName: product.product_name,
    sku: product.sku,
    unit: product.unit,
    purchasePrice: Number(product.purchase_price ?? 0),
    suppliers: rowsOf<RawSupplierRow>(supplierResult).map((row) => ({
      id: row.id,
      name: row.name,
      contactPerson: row.contact_person,
      phone: row.phone,
      address: row.address,
      email: row.email,
      paymentTermDays: Number(row.payment_term_days ?? 0),
      isActive: row.is_active,
      isPreferred: Boolean(row.is_preferred),
      lastPurchasePrice: row.last_price == null ? null : Number(row.last_price),
      lastPoNumber: row.last_po_number,
      lastPoAt: row.last_po_at
        ? row.last_po_at instanceof Date
          ? row.last_po_at.toISOString()
          : String(row.last_po_at)
        : null,
    })),
  };
}
