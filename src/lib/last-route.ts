// =============================================================================
// Last in-app route — restore after lock screen / app switch (reasonable TTL)
// =============================================================================

const STORAGE_KEY = "seps.last-app-route";
/** 12 jam — cukup untuk shift kasir, tidak menahan halaman berhari-hari. */
export const LAST_ROUTE_TTL_MS = 12 * 60 * 60 * 1000;

const BLOCKED_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/landing",
  "/pricing",
  "/auth/",
  "/health",
  "/api/",
];

export function isRestorableAppPath(pathname: string): boolean {
  if (!pathname.startsWith("/") || pathname === "/") return false;
  return !BLOCKED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

export function rememberAppRoute(pathname: string, search = ""): void {
  if (typeof window === "undefined") return;
  if (!isRestorableAppPath(pathname)) return;
  try {
    const href = `${pathname}${search || ""}`;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ href, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function clearRememberedAppRoute(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function peekRememberedAppRoute(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { href?: string; at?: number };
    if (!parsed.href || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > LAST_ROUTE_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (!isRestorableAppPath(parsed.href.split("?")[0] ?? parsed.href)) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function rememberedRouteForTenant(tenantSlug: string): string | null {
  const href = peekRememberedAppRoute();
  if (!href) return null;
  const path = href.split("?")[0] ?? href;
  if (path === `/${tenantSlug}` || path.startsWith(`/${tenantSlug}/`)) return href;
  return null;
}

export function rememberedRouteForPlatform(): string | null {
  const href = peekRememberedAppRoute();
  if (!href) return null;
  const path = href.split("?")[0] ?? href;
  if (path === "/platform" || path.startsWith("/platform/")) return href;
  return null;
}
