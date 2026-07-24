// =============================================================================
// Branch setup helpers — empty-tenant / no-active-branch UX
// =============================================================================

import { allowMockDataSeeding } from "@/lib/mock-data-guard";
import { clearClientDemoDataForRealTenant } from "@/lib/clear-client-demo-data";
import type { Tenant } from "@/types/database";

/** Routes that still render page content when no active branches exist. */
export function isBranchSetupExemptPath(pathname: string, tenantSlug: string): boolean {
  const base = `/${tenantSlug}`;
  const exemptSuffixes = ["/toko-saya"];
  return exemptSuffixes.some(
    (suffix) => pathname === `${base}${suffix}` || pathname.startsWith(`${base}${suffix}/`),
  );
}

/** Buka wizard onboarding penuh (Jalur → Toko → User → Produk → Selesai). */
export function navigateToBranchSetup(options: {
  navigate: (opts: { to: "/onboarding" }) => void;
  tenant: Tenant | null | undefined;
  startWizardSetup: (prefill?: {
    storeName?: string;
    storeSlug?: string;
    storePhone?: string;
  }) => void;
}): void {
  const { navigate, tenant, startWizardSetup } = options;
  if (tenant?.id) {
    clearClientDemoDataForRealTenant(tenant.id);
  }
  startWizardSetup(
    tenant
      ? {
          storeName: tenant.name,
          storeSlug: tenant.slug,
          storePhone: tenant.phone ?? undefined,
        }
      : undefined,
  );
  navigate({ to: "/onboarding" });
}
