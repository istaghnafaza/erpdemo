import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase.types";

export type { Database };

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let _client: SupabaseClient<Database> | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/** Lazy Supabase client — only when VITE_DATA_BACKEND=supabase */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (_client) return _client;
  if (!isSupabaseConfigured()) {
    throw new Error(
      "[SES] Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, or use VITE_DATA_BACKEND=neon|mock",
    );
  }
  _client = createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return _client;
}

// Back-compat export (supabase backend only)
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    return Reflect.get(getSupabaseClient(), prop);
  },
});
