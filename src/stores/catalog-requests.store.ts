// =============================================================================
// Catalog Requests — toko minta kategori/jenis/atribut ke developer
// =============================================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CatalogRequest, CatalogRequestKind } from "@/types/product-attributes";

interface CatalogRequestsState {
  requests: CatalogRequest[];
  submitRequest: (input: {
    tenantId: string;
    tenantName: string;
    kind: CatalogRequestKind;
    categoryName?: string;
    productTypeName?: string;
    attributeName?: string;
    proposedLabel: string;
    proposedAbbreviation?: string;
    notes?: string;
  }) => { ok: boolean; error?: string; id?: string };
  listForTenant: (tenantId: string) => CatalogRequest[];
  listPending: () => CatalogRequest[];
  resolveRequest: (id: string, status: "approved" | "rejected") => { ok: boolean; error?: string };
}

let nextReqSeq = 1;

export const useCatalogRequestsStore = create<CatalogRequestsState>()(
  persist(
    (set, get) => ({
      requests: [],

      submitRequest: (input) => {
        const trimmed = input.proposedLabel.trim();
        if (!trimmed) return { ok: false, error: "Label permintaan wajib diisi" };
        const id = `req-${Date.now()}-${nextReqSeq++}`;
        const req: CatalogRequest = {
          id,
          tenantId: input.tenantId,
          tenantName: input.tenantName,
          kind: input.kind,
          status: "pending",
          categoryName: input.categoryName?.trim(),
          productTypeName: input.productTypeName?.trim(),
          attributeName: input.attributeName?.trim(),
          proposedLabel: trimmed,
          proposedAbbreviation: input.proposedAbbreviation?.trim(),
          notes: input.notes?.trim(),
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ requests: [req, ...s.requests] }));
        return { ok: true, id };
      },

      listForTenant: (tenantId) =>
        get()
          .requests.filter((r) => r.tenantId === tenantId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

      listPending: () =>
        get()
          .requests.filter((r) => r.status === "pending")
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),

      resolveRequest: (id, status) => {
        const req = get().requests.find((r) => r.id === id);
        if (!req) return { ok: false, error: "Permintaan tidak ditemukan" };
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id
              ? { ...r, status, resolvedAt: new Date().toISOString() }
              : r,
          ),
        }));
        return { ok: true };
      },
    }),
    {
      name: "ses-catalog-requests",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
