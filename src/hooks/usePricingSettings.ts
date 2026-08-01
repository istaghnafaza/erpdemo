// =============================================================================
// usePricingSettings — konfigurasi tier harga (owner/manager)
// =============================================================================

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth.store";
import { getPricingBundle, savePricingBundle } from "@/lib/api/pricing";
import { queryKeys } from "@/lib/query-keys";
import { canEdit } from "@/lib/rbac";
import type { PricingBundle } from "@/types/pricing";

export function usePricingSettings() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.currentUser?.profile);
  const tenantId = useAuthStore((s) => s.currentUser?.tenantId) ?? "";
  const userId = user?.id ?? "";

  const canEditPricing = canEdit(user?.role, "pricing_rules");

  const [draft, setDraft] = useState<PricingBundle | null>(null);
  const [saving, setSaving] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.pricingBundle(tenantId),
    queryFn: async () => {
      const result = await getPricingBundle(tenantId);
      if (result.error) throw new Error(result.error);
      return result.data!;
    },
    enabled: Boolean(tenantId),
  });

  const bundle = draft ?? query.data ?? null;

  const setBundle = useCallback((next: PricingBundle) => {
    setDraft(next);
  }, []);

  const save = useCallback(async () => {
    if (!bundle || !tenantId || !userId) return;
    setSaving(true);
    try {
      const result = await savePricingBundle(tenantId, userId, bundle);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.pricingBundle(tenantId) });
      await queryClient.invalidateQueries({ queryKey: ["pos-catalog"] });
      toast.success("Konfigurasi harga disimpan — POS memakai aturan baru");
    } finally {
      setSaving(false);
    }
  }, [bundle, tenantId, userId, queryClient]);

  const resetDraft = useCallback(() => setDraft(null), []);

  return {
    bundle,
    loading: query.isPending,
    saving,
    canEditPricing,
    setBundle,
    save,
    resetDraft,
    isDirty: draft != null,
  };
}
