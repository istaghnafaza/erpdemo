// =============================================================================
// Customers service — Neon/Drizzle (Phase 2)
// =============================================================================

import { and, asc, eq, ilike } from "drizzle-orm";
import { getDb } from "@/server/db";
import { customersKey } from "@/server/cache/keys";
import { CACHE_TTL, getCached } from "@/server/cache/redis";
import { invalidateCustomers } from "@/server/cache/invalidate";
import { toCustomer } from "@/server/db/mappers";
import { customers } from "@/server/db/schema";
import type { Customer, CustomerInsert, CustomerUpdate } from "@/types/database";

export async function listCustomers(
  tenantId: string,
  options?: { search?: string; type?: "retail" | "credit" },
): Promise<Customer[]> {
  if (options?.search || options?.type) {
    const db = getDb();
    const conditions = [eq(customers.tenantId, tenantId)];
    if (options?.type) conditions.push(eq(customers.type, options.type));
    if (options?.search) conditions.push(ilike(customers.name, `%${options.search}%`));

    const rows = await db.query.customers.findMany({
      where: and(...conditions),
      orderBy: asc(customers.name),
    });
    return rows.map(toCustomer);
  }

  return getCached(customersKey(tenantId), CACHE_TTL.customers, async () => {
    const db = getDb();
    const rows = await db.query.customers.findMany({
      where: eq(customers.tenantId, tenantId),
      orderBy: asc(customers.name),
    });
    return rows.map(toCustomer);
  });
}

export async function getCustomerById(
  tenantId: string,
  customerId: string,
): Promise<Customer | null> {
  const db = getDb();
  const row = await db.query.customers.findFirst({
    where: and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)),
  });
  return row ? toCustomer(row) : null;
}

export async function createCustomer(
  tenantId: string,
  payload: Omit<CustomerInsert, "tenant_id">,
): Promise<Customer> {
  const db = getDb();
  const [row] = await db
    .insert(customers)
    .values({
      id: payload.id,
      tenantId,
      name: payload.name,
      phone: payload.phone,
      address: payload.address,
      type: payload.type,
      creditLimit: payload.credit_limit,
      outstandingDebt: payload.outstanding_debt ?? 0,
      pricingTierId: payload.pricing_tier_id ?? null,
    })
    .returning();
  await invalidateCustomers(tenantId);
  return toCustomer(row);
}

export async function updateCustomer(
  tenantId: string,
  customerId: string,
  updates: CustomerUpdate,
): Promise<Customer | null> {
  const db = getDb();
  const patch: Partial<typeof customers.$inferInsert> = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.phone !== undefined) patch.phone = updates.phone;
  if (updates.address !== undefined) patch.address = updates.address;
  if (updates.type !== undefined) patch.type = updates.type;
  if (updates.credit_limit !== undefined) patch.creditLimit = updates.credit_limit;
  if (updates.outstanding_debt !== undefined) patch.outstandingDebt = updates.outstanding_debt;
  if (updates.pricing_tier_id !== undefined) patch.pricingTierId = updates.pricing_tier_id;

  const [row] = await db
    .update(customers)
    .set(patch)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)))
    .returning();
  if (row) await invalidateCustomers(tenantId);
  return row ? toCustomer(row) : null;
}

export async function adjustOutstandingDebt(
  tenantId: string,
  customerId: string,
  delta: number,
): Promise<Customer | null> {
  const current = await getCustomerById(tenantId, customerId);
  if (!current) return null;
  const newDebt = Math.max(0, current.outstanding_debt + delta);
  return updateCustomer(tenantId, customerId, { outstanding_debt: newDebt });
}
