/** Cache singkat respons API client — kurangi loading saat pindah modul. */
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

export function invalidateResponseCache(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
