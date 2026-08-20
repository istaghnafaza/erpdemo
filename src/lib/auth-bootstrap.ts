// =============================================================================
// Auth bootstrap — hydration + server sync for route guards
// =============================================================================

import { redirect } from "@tanstack/react-router";
import { isNeonBackend } from "@/lib/api/backend";
import { getPostAuthDestination } from "@/lib/auth-navigate";
import { useAuthStore } from "@/stores/auth.store";
import { useOnboardingStore } from "@/stores/onboarding.store";
import { markAuthSynced, shouldSkipAuthSync } from "@/lib/auth-sync-cache";
import {
  rememberedRouteForPlatform,
  rememberedRouteForTenant,
} from "@/lib/last-route";

export function waitForAuthHydration(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const persist = useAuthStore.persist;
  if (!persist || persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    persist.onFinishHydration(() => resolve());
  });
}

/** Muat ulang user + tenant dari server (Neon). Throttle agar navigasi modul tidak lambat. */
export async function syncAuthFromServer(options?: { force?: boolean }): Promise<void> {
  // SSR: skip server-fn auth sync — client hydrates then refreshUser runs in __root.
  if (typeof window === "undefined") return;

  await waitForAuthHydration();
  if (!isNeonBackend()) return;

  if (shouldSkipAuthSync(options?.force)) {
    return;
  }

  await useAuthStore.getState().refreshUser({ force: options?.force });
  markAuthSynced();

  const tenant = useAuthStore.getState().currentTenant;
  if (tenant?.onboarding_complete) {
    const { wizardResumeMode } = useOnboardingStore.getState();
    if (!wizardResumeMode) {
      useOnboardingStore.getState().completeOnboarding();
    }
  }
}

type AuthRedirect =
  | ReturnType<typeof redirect>
  | null;

/** Halaman login/register — verifikasi sesi ke server (client-only via usePublicAuthRedirect). */
export async function preparePublicAuthRoute(): Promise<AuthRedirect> {
  await syncAuthFromServer({ force: true });
  return redirectIfAuthenticated();
}

/** Sync guard untuk beforeLoad — SSR-safe, tidak await network. */
export function preparePublicAuthRouteSync(): AuthRedirect {
  return redirectIfAuthenticated();
}

/** Path redirect jika sudah login — untuk navigate() di client. */
export function resolveAuthenticatedRedirectPath(): string | null {
  return resolveAuthenticatedRedirectHref();
}

/** Href halaman terakhir (12 jam) atau dashboard/POS default. */
export function resolveAuthenticatedRedirectHref(): string | null {
  const { isAuthenticated, currentUser, currentTenant } = useAuthStore.getState();
  if (!isAuthenticated || !currentUser) return null;

  if (currentUser.isPlatformAdmin) {
    return rememberedRouteForPlatform() ?? "/platform/dashboard";
  }

  if (!currentTenant) return null;

  const last = rememberedRouteForTenant(currentTenant.slug);
  if (last) return last;

  const dest = getPostAuthDestination(currentTenant, currentUser.profile.role);
  if (dest.to === "/$tenantSlug/pos") return `/${currentTenant.slug}/pos`;
  return `/${currentTenant.slug}/dashboard`;
}

/** Redirect untuk user yang sudah login — null jika belum auth atau tenant belum ter-load. */
export function redirectIfAuthenticated(): AuthRedirect {
  const href = resolveAuthenticatedRedirectHref();
  if (!href) return null;
  return redirect({ href });
}

/** Redirect jika onboarding sudah selesai (halaman setup tidak perlu dibuka lagi). */
export function redirectIfOnboardingComplete(): AuthRedirect {
  const { isAuthenticated, currentUser, currentTenant } = useAuthStore.getState();
  if (!isAuthenticated || !currentUser) {
    return redirect({ to: "/login" });
  }
  if (!currentTenant) {
    return redirect({ to: "/login" });
  }
  if (currentTenant.onboarding_complete) {
    return redirect(getPostAuthDestination(currentTenant, currentUser.profile.role));
  }
  return null;
}
