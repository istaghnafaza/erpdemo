// =============================================================================
// Pricing Store — mock tenant config (localStorage)
// =============================================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  defaultCustomerTiers,
  defaultPricingSettings,
  defaultVolumeTiers,
} from "@/lib/pricing-defaults";
import type { PricingBundle } from "@/types/pricing";

interface PricingState {
  bundles: Record<string, PricingBundle>;
  seedIfEmpty: (tenantId: string) => void;
  getBundle: (tenantId: string) => PricingBundle;
  saveBundle: (tenantId: string, bundle: PricingBundle) => void;
}

function buildDefault(tenantId: string): PricingBundle {
  return {
    settings: defaultPricingSettings(tenantId),
    volume_tiers: defaultVolumeTiers(tenantId).map((t, i) => ({
      ...t,
      id: `mock-vol-${i}`,
    })),
    customer_tiers: defaultCustomerTiers(tenantId).map((t, i) => ({
      ...t,
      id: `mock-cust-${i}`,
    })),
    category_margins: [],
  };
}

export const usePricingStore = create<PricingState>()(
  persist(
    (set, get) => ({
      bundles: {},

      seedIfEmpty: (tenantId) => {
        if (get().bundles[tenantId]) return;
        set((s) => ({
          bundles: { ...s.bundles, [tenantId]: buildDefault(tenantId) },
        }));
      },

      getBundle: (tenantId) => get().bundles[tenantId] ?? buildDefault(tenantId),

      saveBundle: (tenantId, bundle) =>
        set((s) => ({
          bundles: { ...s.bundles, [tenantId]: bundle },
        })),
    }),
    {
      name: "ses-pricing-config",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
