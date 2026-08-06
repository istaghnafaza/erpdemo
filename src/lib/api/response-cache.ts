/** Cache singkat respons API client — kurangi loading saat pindah modul. */
import type { ApiResponse } from "@/types/app";

const store = new Map<string, { expires: number; value: unknown }>();

export async function withResponseCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) {
    return hit.value as T;
  }
  const value = await loader();
  store.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

/** Cache only successful ApiResponse values — avoid sticky empty lists after transient DB errors. */
export async function withResponseCacheOnOk<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<ApiResponse<T>>,
): Promise<ApiResponse<T>> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) {
    return hit.value as ApiResponse<T>;
  }
  const value = await loader();
  if (!value.error) {
    store.set(key, { value, expires: Date.now() + ttlMs });
  }
  return value;
}

export function invalidateResponseCache(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
