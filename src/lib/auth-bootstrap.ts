// =============================================================================
// Auth bootstrap — hydration + server sync for route guards
// =============================================================================

import { redirect } from "@tanstack/react-router";
import { isNeonBackend } from "@/lib/api/backend";
import { getPostAuthDestination } from "@/lib/auth-navigate";
import { useAuthStore } from "@/stores/auth.store";
import { useOnboardingStore } from "@/stores/onboarding.store";
import { markAuthSynced, shouldSkipAuthSync } from "@/lib/auth-sync-cache";

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

/** Halaman login/register — selalu verifikasi sesi ke server (hindari redirect dari cache lokal). */
export async function preparePublicAuthRoute(): Promise<AuthRedirect> {
  await syncAuthFromServer({ force: true });
  return redirectIfAuthenticated();
}

/** Redirect untuk user yang sudah login — null jika belum auth atau tenant belum ter-load. */
export function redirectIfAuthenticated(): AuthRedirect {
  const { isAuthenticated, currentUser, currentTenant } = useAuthStore.getState();
  if (!isAuthenticated || !currentUser) return null;

  if (currentUser.isPlatformAdmin) {
    return redirect({ to: "/platform/dashboard" });
  }

  if (!currentTenant) return null;

  return redirect(getPostAuthDestination(currentTenant, currentUser.profile.role));
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
