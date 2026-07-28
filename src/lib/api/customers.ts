// =============================================================================
// Customers API
// =============================================================================

import { db as supabase, ok, fail, queryMany, isNeonBackend } from "./client";
import { neonCall } from "./backend";
import { withResponseCache } from "./response-cache";
import {
  neonAdjustOutstandingDebt,
  neonCreateCustomer,
  neonGetCustomer,
  neonGetCustomers,
  neonUpdateCustomer,
} from "@/lib/api/neon/catalog-fns";
import type { ApiResponse } from "@/types/app";
import type { Customer, CustomerInsert, CustomerUpdate } from "@/types/database";

export async function getCustomers(
  tenantId: string,
  options?: { search?: string; type?: "retail" | "credit" }
): Promise<ApiResponse<Customer[]>> {
  if (isNeonBackend()) {
    const cacheKey = `customers:${tenantId}`;
    const useCache = !options?.search && !options?.type;
    const load = async () => {
      const result = await neonCall(() =>
        neonGetCustomers({ data: { tenantId, options } }),
      );
      if (result.error) return fail(result.error);
      return ok(result.data ?? []);
    };
    if (useCache) {
      return withResponseCache(cacheKey, 30_000, load);
    }
    return load();
  }
  return queryMany(() => {
    let q = supabase
      .from("customers")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("name");

    if (options?.type) q = q.eq("type", options.type);
    if (options?.search) q = q.ilike("name", `%${options.search}%`);

    return q;
  });
}

export async function getCustomer(
  tenantId: string,
  customerId: string
): Promise<ApiResponse<Customer>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetCustomer({ data: { tenantId, customerId } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Pelanggan tidak ditemukan");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", customerId)
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function getCreditCustomers(
  tenantId: string
): Promise<ApiResponse<Customer[]>> {
  return getCustomers(tenantId, { type: "credit" });
}

export async function createCustomer(
  tenantId: string,
  payload: Omit<CustomerInsert, "tenant_id">
): Promise<ApiResponse<Customer>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonCreateCustomer({ data: { tenantId, payload } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal membuat pelanggan");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("customers")
      .insert({ ...payload, tenant_id: tenantId })
      .select()
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function updateCustomer(
  tenantId: string,
  customerId: string,
  updates: CustomerUpdate
): Promise<ApiResponse<Customer>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonUpdateCustomer({ data: { tenantId, customerId, updates } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Pelanggan tidak ditemukan");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("customers")
      .update(updates)
      .eq("tenant_id", tenantId)
      .eq("id", customerId)
      .select()
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

/** Update outstanding_debt — called after AR payment or new credit sale */
export async function adjustOutstandingDebt(
  tenantId: string,
  customerId: string,
  delta: number   // positive = increase debt, negative = decrease
): Promise<ApiResponse<Customer>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonAdjustOutstandingDebt({ data: { tenantId, customerId, delta } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Pelanggan tidak ditemukan");
    return ok(result.data);
  }
  try {
    const current = await getCustomer(tenantId, customerId);
    if (current.error) return fail(current.error);

    const newDebt = Math.max(0, (current.data?.outstanding_debt ?? 0) + delta);
    return updateCustomer(tenantId, customerId, { outstanding_debt: newDebt });
  } catch (err) {
    return fail(err);
  }
}
