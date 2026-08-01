// =============================================================================
// Pricing API — bundle + settings (Neon)
// =============================================================================

import { isNeonBackend, ok, fail } from "./client";
import { neonCall } from "./backend";
import { neonGetPricingBundle, neonSavePricingBundle } from "./neon/pricing-fns";
import type { ApiResponse } from "@/types/app";
import type { PricingBundle } from "@/types/pricing";
import {
  defaultCustomerTiers,
  defaultPricingSettings,
  defaultVolumeTiers,
} from "@/lib/pricing-defaults";
import { usePricingStore } from "@/stores/pricing.store";
import { isMockTenantId } from "@/lib/mock-session";

export function getDefaultPricingBundle(tenantId: string): PricingBundle {
  return {
    settings: defaultPricingSettings(tenantId),
    volume_tiers: defaultVolumeTiers(tenantId).map((t, i) => ({
      ...t,
      id: `default-vol-${i}`,
    })),
    customer_tiers: defaultCustomerTiers(tenantId).map((t, i) => ({
      ...t,
      id: `default-cust-${i}`,
    })),
    category_margins: [],
  };
}

export async function getPricingBundle(tenantId: string): Promise<ApiResponse<PricingBundle>> {
  if (isMockTenantId(tenantId)) {
    usePricingStore.getState().seedIfEmpty(tenantId);
    return ok(usePricingStore.getState().getBundle(tenantId));
  }
  if (isNeonBackend()) {
    const result = await neonCall(() => neonGetPricingBundle({ data: { tenantId } }));
    if (result.error) return fail(result.error);
    return ok(result.data as PricingBundle);
  }
  return ok(getDefaultPricingBundle(tenantId));
}

export async function savePricingBundle(
  tenantId: string,
  userId: string,
  bundle: PricingBundle,
): Promise<ApiResponse<PricingBundle>> {
  if (isMockTenantId(tenantId)) {
    usePricingStore.getState().saveBundle(tenantId, bundle);
    return ok(bundle);
  }
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonSavePricingBundle({
        data: {
          tenantId,
          userId,
          settings: {
            max_stack_discount_percent: bundle.settings.max_stack_discount_percent,
            max_line_discount_percent: bundle.settings.max_line_discount_percent,
            default_min_margin_percent: bundle.settings.default_min_margin_percent,
          },
          volume_tiers: bundle.volume_tiers,
          customer_tiers: bundle.customer_tiers,
          category_margins: bundle.category_margins,
        },
      }),
    );
    if (result.error) return fail(result.error);
    return ok(result.data as PricingBundle);
  }
  return ok(bundle);
}
