/** Throttle refresh user / sync auth — hindari round-trip Neon tiap navigasi modul. */
const AUTH_SYNC_TTL_MS = 45_000;
let lastAuthSyncAt = 0;

export function resetAuthSyncCache(): void {
  lastAuthSyncAt = 0;
}

export function markAuthSynced(): void {
  lastAuthSyncAt = Date.now();
}

export function shouldSkipAuthSync(force?: boolean): boolean {
  if (force) return false;
  return Date.now() - lastAuthSyncAt < AUTH_SYNC_TTL_MS;
}

export { AUTH_SYNC_TTL_MS };
