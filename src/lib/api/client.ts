// =============================================================================
// API Client — backend router + standardized error handling
// =============================================================================

import { getSupabaseClient, isSupabaseConfigured, supabase } from "@/lib/supabase";
import { getDataBackend, isNeonBackend, isSupabaseBackend } from "@/lib/api/backend";
import type { ApiResponse } from "@/types/app";

export { supabase };

/**
 * Legacy db client for Supabase data queries in api/*.ts files.
 * Deprecated — set VITE_DATA_BACKEND=neon for production.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = isSupabaseBackend() && isSupabaseConfigured()
  ? (getSupabaseClient() as any)
  : (null as any);

export function getActiveBackend() {
  return getDataBackend();
}

// ---------------------------------------------------------------------------
// Standard error normalizer
// ---------------------------------------------------------------------------
export function toApiError(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && "message" in err) return String((err as { message: unknown }).message);
  return JSON.stringify(err);
}

export function ok<T>(data: T): ApiResponse<T> {
  return { data, error: null };
}

export function fail<T = null>(error: unknown): ApiResponse<T> {
  return { data: null, error: toApiError(error) };
}

export async function query<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: () => Promise<{ data: any; error: any }>,
): Promise<ApiResponse<T>> {
  try {
    const { data, error } = await fn();
    if (error) return fail(error);
    if (data === null) return fail("No data returned");
    return ok(data as T);
  } catch (err) {
    return fail(err);
  }
}

export async function queryMany<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: () => Promise<{ data: any; error: any }>,
): Promise<ApiResponse<T[]>> {
  try {
    const { data, error } = await fn();
    if (error) return fail(error);
    return ok((data ?? []) as T[]);
  } catch (err) {
    return fail(err);
  }
}

export interface SupabasePageResult<T> {
  data: T[];
  count: number | null;
}

export function paginate<T>(result: SupabasePageResult<T>, page: number, pageSize: number) {
  const total = result.count ?? 0;
  return {
    data: result.data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function rpc<T>(
  fnName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: Record<string, any>,
): Promise<ApiResponse<T>> {
  if (!isSupabaseBackend()) return fail("RPC hanya tersedia di backend Supabase");
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (getSupabaseClient() as any).rpc(fnName, params);
    if (error) return fail(error);
    return ok(data as T);
  } catch (err) {
    return fail(err);
  }
}

export { isNeonBackend, isSupabaseBackend };
