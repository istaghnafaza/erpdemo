// =============================================================================
// $tenantSlug Layout — parent route for all tenant-scoped pages.
//
// Responsibilities:
//   1. Verify user is authenticated (redirect → /login if not)
//   2. Load tenant by slug & verify user belongs to this tenant
//   3. Load accessible branches into branch.store
//   4. Subscribe to notifications (Realtime + polling)
//   5. Render child routes via <Outlet />
//
// This file MUST be named `$tenantSlug.tsx` (sibling to the `$tenantSlug/`
// directory). TanStack Router uses this as the nested layout for all routes
// under /$tenantSlug/*.
// =============================================================================

import { createFileRoute, redirect, Outlet, useParams, Navigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { useNotificationStore } from "@/stores/notification.store";
import { getTenant, getTenantBySlug } from "@/lib/api/tenants";
import { syncAuthFromServer } from "@/lib/auth-bootstrap";
import { isMockBackend } from "@/lib/api/backend";
import { MOCK_TENANT_ID } from "@/lib/mock-ids";
import { seedMockNotifications } from "@/lib/mock-notifications";
import type { UserRole } from "@/types/app";
import { canAccess, rolesForFeature, type RbacFeature } from "@/lib/rbac";
import { resolvePortalTenantBySlug } from "@/lib/portal-utils";

// ---------------------------------------------------------------------------
// Route guard helpers (called in beforeLoad — outside React)
// ---------------------------------------------------------------------------

/**
 * Throws redirect to /login if user is not authenticated.
 * Safe to call from beforeLoad (no React hooks needed).
 */
export function requireAuth(): NonNullable<
  ReturnType<typeof useAuthStore.getState>["currentUser"]
> {
  const { currentUser, isAuthenticated } = useAuthStore.getState();
  if (!isAuthenticated || !currentUser) throw redirect({ to: "/login" });
  if (currentUser.isPlatformAdmin) {
    throw redirect({ to: "/platform/dashboard" });
  }
  return currentUser;
}

/**
 * Throws redirect to dashboard if user doesn't have the required role.
 * Call this inside individual route beforeLoad after requireAuth().
 */
export function requireRole(tenantSlug: string, allowedRoles: UserRole[]): void {
  const { currentUser } = useAuthStore.getState();
  if (!currentUser) throw redirect({ to: "/login" });
  if (!allowedRoles.includes(currentUser.profile.role as UserRole)) {
    throw redirect({
      to: "/$tenantSlug/dashboard",
      params: { tenantSlug },
    });
  }
}

/** Route guard using central RBAC matrix. */
export function requireFeature(tenantSlug: string, feature: RbacFeature): void {
  const { currentUser } = useAuthStore.getState();
  if (!currentUser) throw redirect({ to: "/login" });
  if (!canAccess(currentUser.profile.role, feature)) {
    throw redirect({
      to: "/$tenantSlug/dashboard",
      params: { tenantSlug },
    });
  }
}

export { rolesForFeature };

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/$tenantSlug")({
  // -------------------------------------------------------------------------
  // beforeLoad: runs BEFORE the component renders.
  // This is where we do auth checks and tenant validation.
  // -------------------------------------------------------------------------
  beforeLoad: async ({ params, location }) => {
    // Jangan tangkap path publik sebagai slug toko (mis. /landing → login)
    const reserved = new Set([
      "landing",
      "login",
      "register",
      "pricing",
      "platform",
      "health",
      "onboarding",
      "api",
      "auth",
    ]);
    const slug = params.tenantSlug.toLowerCase();
    if (reserved.has(slug)) {
      if (slug === "landing") throw redirect({ to: "/landing" });
      if (slug === "login") throw redirect({ to: "/login" });
      if (slug === "register") throw redirect({ to: "/register" });
      if (slug === "pricing") throw redirect({ to: "/pricing" });
      if (slug === "platform") throw redirect({ to: "/platform/dashboard" });
      if (slug === "health") throw redirect({ to: "/health" });
      if (slug === "onboarding") throw redirect({ to: "/onboarding" });
      throw redirect({ to: "/landing" });
    }

    const isPortalRoute = location.pathname.includes(`/${params.tenantSlug}/shop`);

    if (isPortalRoute) {
      const tenant = resolvePortalTenantBySlug(params.tenantSlug);
      if (!tenant) throw redirect({ to: "/login" });
      return { tenant, isPortal: true as const };
    }

    const user = requireAuth();

    const { currentTenant: cachedTenant } = useAuthStore.getState();
    const isMockSession =
      isMockBackend() && user.tenantId === MOCK_TENANT_ID && !!cachedTenant;

    if (isMockSession) {
      if (params.tenantSlug !== cachedTenant!.slug) {
        throw redirect({
          to: "/$tenantSlug/dashboard",
          params: { tenantSlug: cachedTenant!.slug },
        });
      }
      return { tenant: cachedTenant };
    }

    // Tenant sudah di cache & slug cocok — skip round-trip Neon
    if (
      cachedTenant &&
      cachedTenant.slug === params.tenantSlug &&
      user.tenantId === cachedTenant.id
    ) {
      return { tenant: cachedTenant };
    }

    await syncAuthFromServer();

    const { currentTenant } = useAuthStore.getState();

    const isMockAfterSync =
      isMockBackend() && user.tenantId === MOCK_TENANT_ID && !!currentTenant;

    if (isMockAfterSync) {
      if (params.tenantSlug !== currentTenant!.slug) {
        throw redirect({
          to: "/$tenantSlug/dashboard",
          params: { tenantSlug: currentTenant!.slug },
        });
      }
      return { tenant: currentTenant };
    }

    // Load tenant from slug
    const tenantResult = await getTenantBySlug(params.tenantSlug);

    if (tenantResult.error || !tenantResult.data) {
      const byId = await getTenant(user.tenantId);
      if (byId.data?.slug) {
        throw redirect({
          to: "/$tenantSlug/dashboard",
          params: { tenantSlug: byId.data.slug },
        });
      }
      throw redirect({ to: "/login" });
    }

    const tenant = tenantResult.data;

    // URL slug stale — arahkan ke slug tenant yang benar
    if (params.tenantSlug !== tenant.slug) {
      throw redirect({
        to: "/$tenantSlug/dashboard",
        params: { tenantSlug: tenant.slug },
      });
    }

    // Verify user belongs to this tenant
    if (user.tenantId !== tenant.id) {
      // User is trying to access another tenant's data
      throw redirect({ to: "/login" });
    }

    // Persist tenant in auth store if it changed
    if (!currentTenant || currentTenant.id !== tenant.id) {
      useAuthStore.setState({ currentTenant: tenant });
    }

    return { tenant };
  },

  // -------------------------------------------------------------------------
  // component: renders the tenant shell + child routes
  // -------------------------------------------------------------------------
  component: TenantLayout,
});

// ---------------------------------------------------------------------------
// TenantLayout component
// ---------------------------------------------------------------------------

function TenantLayout() {
  const { tenantSlug } = useParams({ from: "/$tenantSlug" });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isPortalRoute = pathname.includes(`/${tenantSlug}/shop`);

  const currentUser = useAuthStore((s) => s.currentUser);
  const currentTenant = useAuthStore((s) => s.currentTenant);
  const loadBranches = useBranchStore((s) => s.loadBranches);
  const subscribe = useNotificationStore((s) => s.subscribe);
  const unsubscribe = useNotificationStore((s) => s.unsubscribe);
  const activeBranchId = useBranchStore((s) => s.activeBranch?.id ?? null);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const persist = useAuthStore.persist;
    if (!persist) {
      setHydrated(true);
      return;
    }
    if (persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return persist.onFinishHydration(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (isPortalRoute || !currentTenant || !currentUser) return;
    void loadBranches(currentTenant.id, currentUser.allowedBranchIds, currentUser.isOwner);
  }, [isPortalRoute, currentTenant?.id, currentUser?.id, loadBranches]);

  useEffect(() => {
    if (isPortalRoute || !currentTenant?.id) return;
    let cancelled = false;
    void getTenant(currentTenant.id).then((result) => {
      if (cancelled || !result.data) return;
      useAuthStore.setState({ currentTenant: result.data });
    });
    return () => {
      cancelled = true;
    };
  }, [isPortalRoute, currentTenant?.id]);

  useEffect(() => {
    if (isPortalRoute || !currentTenant || !activeBranchId) return;

    if (tenantSlug === "toko-simetri" && currentTenant.slug === "toko-simetri") {
      seedMockNotifications(activeBranchId);
      return;
    }

    subscribe(currentTenant.id, activeBranchId);
    return () => unsubscribe();
  }, [isPortalRoute, currentTenant?.id, activeBranchId, subscribe, unsubscribe, tenantSlug]);

  if (isPortalRoute) {
    const portalTenant = resolvePortalTenantBySlug(tenantSlug);
    if (!portalTenant) return <Navigate to="/login" replace />;
    return <Outlet />;
  }

  if (!hydrated) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Memuat...
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Tenant sudah divalidasi di beforeLoad — jangan redirect balik ke login (hindari loop)
  if (!currentTenant) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Memuat data bisnis...
      </div>
    );
  }

  return <Outlet />;
}
