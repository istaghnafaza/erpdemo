// =============================================================================
// Dashboard preferences — owner dapat memilih KPI yang ditampilkan.
// =============================================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export const DASHBOARD_KPI_IDS = [
  "sales",
  "gross_profit",
  "net_profit",
  "critical_stock",
  "overdue_ar",
  "cash_balance",
  "cash_vs_profit",
  "cash_forecast",
  "cash_lock_stock",
  "ar_ap_due",
] as const;

export type DashboardKpiId = (typeof DASHBOARD_KPI_IDS)[number];

export const DASHBOARD_KPI_LABELS: Record<DashboardKpiId, string> = {
  sales: "Penjualan",
  gross_profit: "Keuntungan",
  net_profit: "Laba Bersih",
  critical_stock: "Stok Kritis",
  overdue_ar: "Piutang Jatuh Tempo",
  cash_balance: "Saldo Kas & Bank",
  cash_vs_profit: "Kas vs Laba",
  cash_forecast: "Proyeksi Kas 30 Hari",
  cash_lock_stock: "Stok Lambat / Mati",
  ar_ap_due: "AR vs AP 30 Hari",
};

const DEFAULT_VISIBLE: DashboardKpiId[] = [...DASHBOARD_KPI_IDS];

interface DashboardPreferencesState {
  visibleKpis: DashboardKpiId[];
  setVisibleKpis: (ids: DashboardKpiId[]) => void;
  toggleKpi: (id: DashboardKpiId) => void;
  resetKpis: () => void;
  isKpiVisible: (id: DashboardKpiId) => boolean;
}

export const useDashboardPreferencesStore = create<DashboardPreferencesState>()(
  persist(
    (set, get) => ({
      visibleKpis: DEFAULT_VISIBLE,

      setVisibleKpis: (ids) => {
        const unique = DASHBOARD_KPI_IDS.filter((id) => ids.includes(id));
        set({ visibleKpis: unique.length > 0 ? unique : DEFAULT_VISIBLE });
      },

      toggleKpi: (id) => {
        const current = get().visibleKpis;
        const next = current.includes(id)
          ? current.filter((k) => k !== id)
          : [...current, id];
        if (next.length === 0) return;
        set({ visibleKpis: next });
      },

      resetKpis: () => set({ visibleKpis: DEFAULT_VISIBLE }),

      isKpiVisible: (id) => get().visibleKpis.includes(id),
    }),
    {
      name: "ses-dashboard-kpis",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
