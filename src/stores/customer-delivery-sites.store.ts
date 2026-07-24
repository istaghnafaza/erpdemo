// =============================================================================
// Customer delivery sites — saved addresses/projects (localStorage demo).
// =============================================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { allowMockDataSeeding } from "@/lib/mock-data-guard";
import { isProjectSiteIdle } from "@/lib/customer-delivery-utils";
import { getSeedCustomerDeliverySites } from "@/lib/mock-customer-delivery-sites";
import { useSalesTransactionsStore } from "@/stores/sales-transactions.store";
import type {
  CreateDeliverySiteDraft,
  CustomerDeliverySite,
  UpdateDeliverySiteDraft,
} from "@/types/customer-delivery-sites";

interface CustomerDeliverySitesState {
  sites: CustomerDeliverySite[];
  /** customerId → siteId terakhir dipakai checkout POS */
  lastUsedSiteByCustomer: Record<string, string>;
  seedIfEmpty: () => void;
  listForTenant: (tenantId: string) => CustomerDeliverySite[];
  sitesForCustomer: (customerId: string) => CustomerDeliverySite[];
  getLastUsedSiteId: (customerId: string) => string | null;
  recordLastUsedSite: (customerId: string, siteId: string) => void;
  recordSiteOrder: (siteId: string) => void;
  addSite: (draft: CreateDeliverySiteDraft) => CustomerDeliverySite;
  updateSite: (id: string, patch: UpdateDeliverySiteDraft) => { ok: boolean; error?: string };
  removeSite: (id: string) => { ok: boolean; error?: string };
}

let nextSiteId = 100;

function nextSiteIdStr(): string {
  nextSiteId += 1;
  return `77771111-0000-0000-0000-${String(nextSiteId).padStart(12, "0")}`;
}

function normalizeSite(site: CustomerDeliverySite): CustomerDeliverySite {
  return {
    ...site,
    validFrom: site.validFrom ?? null,
    validUntil: site.validUntil ?? null,
    createdAt: site.createdAt ?? new Date().toISOString(),
    lastOrderAt: site.lastOrderAt ?? null,
  };
}

function syncLastOrderFromTransactions(sites: CustomerDeliverySite[]): CustomerDeliverySite[] {
  const txs = useSalesTransactionsStore.getState().transactions;
  const lastBySite = new Map<string, string>();

  for (const tx of txs) {
    if (!tx.deliverySiteId) continue;
    const prev = lastBySite.get(tx.deliverySiteId);
    if (!prev || new Date(tx.createdAt).getTime() > new Date(prev).getTime()) {
      lastBySite.set(tx.deliverySiteId, tx.createdAt);
    }
  }

  return sites.map((site) => {
    const fromTx = lastBySite.get(site.id);
    if (!fromTx) return site;
    if (!site.lastOrderAt || new Date(fromTx).getTime() > new Date(site.lastOrderAt).getTime()) {
      return { ...site, lastOrderAt: fromTx };
    }
    return site;
  });
}

function applyProjectIdleRules(sites: CustomerDeliverySite[]): CustomerDeliverySite[] {
  const at = new Date();
  return sites.map((site) => {
    if (site.siteType !== "proyek") return site;
    if (!isProjectSiteIdle(site, at)) return site;
    if (!site.isActive) return site;
    return { ...site, isActive: false };
  });
}

function postProcessSites(sites: CustomerDeliverySite[]): CustomerDeliverySite[] {
  return applyProjectIdleRules(syncLastOrderFromTransactions(sites.map(normalizeSite)));
}

export const useCustomerDeliverySitesStore = create<CustomerDeliverySitesState>()(
  persist(
    (set, get) => ({
      sites: [],
      lastUsedSiteByCustomer: {},

      seedIfEmpty: () => {
        if (!allowMockDataSeeding()) return;
        if (get().sites.length > 0) {
          set((s) => ({ sites: postProcessSites(s.sites) }));
          return;
        }
        set({ sites: postProcessSites(getSeedCustomerDeliverySites()) });
      },

      listForTenant: (tenantId) => get().sites.filter((s) => s.tenantId === tenantId),

      sitesForCustomer: (customerId) =>
        get()
          .sites.filter((s) => s.customerId === customerId)
          .sort((a, b) => a.label.localeCompare(b.label, "id")),

      getLastUsedSiteId: (customerId) => get().lastUsedSiteByCustomer[customerId] ?? null,

      recordLastUsedSite: (customerId, siteId) => {
        set((s) => ({
          lastUsedSiteByCustomer: {
            ...s.lastUsedSiteByCustomer,
            [customerId]: siteId,
          },
        }));
      },

      recordSiteOrder: (siteId) => {
        const now = new Date().toISOString();
        set((s) => ({
          sites: s.sites.map((site) => {
            if (site.id !== siteId) return site;
            return {
              ...site,
              lastOrderAt: now,
              isActive: site.siteType === "proyek" ? true : site.isActive,
            };
          }),
        }));
      },

      addSite: (draft) => {
        const now = new Date().toISOString();
        const record: CustomerDeliverySite = {
          id: nextSiteIdStr(),
          tenantId: draft.tenantId,
          customerId: draft.customerId,
          label: draft.label.trim(),
          address: draft.address.trim(),
          contactName: draft.contactName?.trim() || null,
          contactPhone: draft.contactPhone?.trim() || null,
          siteType: draft.siteType ?? "lainnya",
          validFrom: null,
          validUntil: null,
          isDefault: draft.isDefault ?? false,
          isActive: true,
          createdAt: now,
          lastOrderAt: null,
        };

        set((s) => {
          let sites = [...s.sites, record];
          if (record.isDefault) {
            sites = sites.map((site) =>
              site.customerId === record.customerId && site.id !== record.id
                ? { ...site, isDefault: false }
                : site,
            );
          }
          return { sites };
        });

        return record;
      },

      updateSite: (id, patch) => {
        const existing = get().sites.find((s) => s.id === id);
        if (!existing) return { ok: false, error: "Lokasi tidak ditemukan" };

        set((s) => {
          let sites = s.sites.map((site) => {
            if (site.id !== id) return site;
            return {
              ...site,
              label: patch.label !== undefined ? patch.label.trim() : site.label,
              address: patch.address !== undefined ? patch.address.trim() : site.address,
              contactName:
                patch.contactName !== undefined ? patch.contactName : site.contactName,
              contactPhone:
                patch.contactPhone !== undefined ? patch.contactPhone : site.contactPhone,
              siteType: patch.siteType ?? site.siteType,
              isDefault: patch.isDefault !== undefined ? patch.isDefault : site.isDefault,
              isActive: patch.isActive !== undefined ? patch.isActive : site.isActive,
            };
          });

          if (patch.isDefault) {
            sites = sites.map((site) =>
              site.customerId === existing.customerId && site.id !== id
                ? { ...site, isDefault: false }
                : site,
            );
          }

          return { sites: applyProjectIdleRules(sites) };
        });

        return { ok: true };
      },

      removeSite: (id) => {
        const existing = get().sites.find((s) => s.id === id);
        if (!existing) return { ok: false, error: "Lokasi tidak ditemukan" };
        set((s) => ({
          sites: s.sites.filter((site) => site.id !== id),
          lastUsedSiteByCustomer: Object.fromEntries(
            Object.entries(s.lastUsedSiteByCustomer).filter(([, sid]) => sid !== id),
          ),
        }));
        return { ok: true };
      },
    }),
    {
      name: "ses-customer-delivery-sites",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (!allowMockDataSeeding()) return;
        useSalesTransactionsStore.getState().seedIfEmpty();
        state?.seedIfEmpty();
      },
    },
  ),
);
