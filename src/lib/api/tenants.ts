// =============================================================================
// Tenants API
// =============================================================================

import { db as supabase, ok, fail, queryMany, isNeonBackend } from "./client";
import { neonCall } from "./backend";
import {
  neonCreateTenant,
  neonGetAllTenants,
  neonGetTenant,
  neonGetTenantBySlug,
  neonCheckTenantSlugAvailable,
  neonUpdateTenant,
} from "@/lib/api/neon/fns";
import type { ApiResponse } from "@/types/app";
import type { Tenant, TenantInsert, TenantUpdate } from "@/types/database";

export async function getTenant(tenantId: string): Promise<ApiResponse<Tenant>> {
  if (isNeonBackend()) {
    const result = await neonCall(() => neonGetTenant({ data: { tenantId } }));
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Tenant tidak ditemukan");
    return ok(result.data);
  }

  try {
    const { data, error } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", tenantId)
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function getAllTenants(): Promise<ApiResponse<Tenant[]>> {
  if (isNeonBackend()) {
    const result = await neonCall(() => neonGetAllTenants());
    if (result.error) return fail(result.error);
    return ok(result.data ?? []);
  }
  return queryMany(() => supabase.from("tenants").select("*").order("name"));
}

export async function createTenant(payload: TenantInsert): Promise<ApiResponse<Tenant>> {
  if (isNeonBackend()) {
    const result = await neonCall(() => neonCreateTenant({ data: { payload } }));
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal membuat tenant");
    return ok(result.data);
  }

  try {
    const { data, error } = await supabase.from("tenants").insert(payload).select().single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function updateTenant(
  tenantId: string,
  updates: TenantUpdate,
): Promise<ApiResponse<Tenant>> {
  if (isNeonBackend()) {
    const result = await neonCall(() => neonUpdateTenant({ data: { tenantId, updates } }));
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Tenant tidak ditemukan");
    return ok(result.data);
  }

  try {
    const { data, error } = await supabase
      .from("tenants")
      .update(updates)
      .eq("id", tenantId)
      .select()
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function setOnboardingComplete(tenantId: string): Promise<ApiResponse<Tenant>> {
  return updateTenant(tenantId, { onboarding_complete: true });
}

export async function getTenantBySlug(slug: string): Promise<ApiResponse<Tenant>> {
  if (isNeonBackend()) {
    const result = await neonCall(() => neonGetTenantBySlug({ data: { slug } }));
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Tenant tidak ditemukan");
    return ok(result.data);
  }

  try {
    const { data, error } = await supabase
      .from("tenants")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function checkTenantSlugAvailable(
  slug: string,
  tenantId?: string,
): Promise<ApiResponse<boolean>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonCheckTenantSlugAvailable({ data: { slug, tenantId } }),
    );
    if (result.error) return fail(result.error);
    return ok(result.data?.available ?? false);
  }
  return ok(true);
}

export async function setLegacyMode(
  tenantId: string,
  active: boolean,
): Promise<ApiResponse<Tenant>> {
  return updateTenant(tenantId, { legacy_mode_active: active });
}
