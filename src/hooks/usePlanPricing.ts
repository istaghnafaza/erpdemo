import { useEffect, useState } from "react";
import { getPublicPlanPricing, type PlanPricingMap } from "@/lib/api/platform-finance";
import { PLAN_PRICING } from "@/lib/plan-config";

const FALLBACK: PlanPricingMap = {
  basic: { ...PLAN_PRICING.basic },
  pro: { ...PLAN_PRICING.pro },
  enterprise: { ...PLAN_PRICING.enterprise },
};

/** Live remote plan pricing (DB) with static fallback. */
export function usePlanPricing() {
  const [pricing, setPricing] = useState<PlanPricingMap>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getPublicPlanPricing().then((res) => {
      if (cancelled) return;
      if (res.data) setPricing(res.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { pricing, loading };
}
