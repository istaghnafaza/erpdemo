// =============================================================================
// Neon server fns — pricing configuration
// =============================================================================

import { createServerFn } from "@tanstack/react-start";
import type {
  CategoryMarginFloor,
  CustomerPriceTier,
  PricingBundle,
  PricingSettings,
  VolumePriceTier,
} from "@/types/pricing";

export const neonGetPricingBundle = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string }) => data)
  .handler(async ({ data }) => {
    const { getPricingBundle } = await import("@/server/services/pricing");
    return getPricingBundle(data.tenantId);
  });

export const neonSavePricingBundle = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      userId: string;
      settings: Pick<
        PricingSettings,
        "max_stack_discount_percent" | "max_line_discount_percent" | "default_min_margin_percent"
      >;
      volume_tiers: VolumePriceTier[];
      customer_tiers: CustomerPriceTier[];
      category_margins: CategoryMarginFloor[];
    }) => data,
  )
  .handler(async ({ data }) => {
    const {
      updatePricingSettings,
      replaceVolumeTiers,
      replaceCustomerTiers,
      replaceCategoryMargins,
      getPricingBundle,
    } = await import("@/server/services/pricing");

    await updatePricingSettings(data.tenantId, data.settings, data.userId);
    await replaceVolumeTiers(data.tenantId, data.volume_tiers);
    await replaceCustomerTiers(data.tenantId, data.customer_tiers);
    await replaceCategoryMargins(data.tenantId, data.category_margins);
    return getPricingBundle(data.tenantId);
  });
