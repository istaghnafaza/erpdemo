// =============================================================================
// Data backend selector — mock | supabase | neon
// =============================================================================

export type DataBackend = "mock" | "supabase" | "neon";

export function getDataBackend(): DataBackend {
  const v = import.meta.env.VITE_DATA_BACKEND as string | undefined;
  if (v === "neon" || v === "supabase" || v === "mock") return v;
  return "mock";
}

export function isNeonBackend(): boolean {
  return getDataBackend() === "neon";
}

export function isSupabaseBackend(): boolean {
  // Legacy rollback only — production uses neon (Fase 6 cutover)
  return getDataBackend() === "supabase";
}

export function isMockBackend(): boolean {
  return getDataBackend() === "mock";
}

/** Wrap server fn call into ApiResponse envelope */
export async function neonCall<T>(fn: () => Promise<T>): Promise<{ data: T | null; error: string | null }> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { data: null, error: message };
  }
}
