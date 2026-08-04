// =============================================================================
// Suppliers Store — mock tenant CRUD + product links
// =============================================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { allowMockDataSeeding } from "@/lib/mock-data-guard";
import { MOCK_SUPPLIER_LIST } from "@/lib/mock-purchasing";
import {
  MOCK_PRODUCT_SUPPLIER_LINKS,
  type MockProductSupplierLink,
} from "@/lib/mock-supplier-products";
import type { Supplier, SupplierWithProducts } from "@/types/database";

export interface SupplierFormInput {
  name: string;
  contact_person?: string | null;
  phone?: string | null;
  address?: string | null;
  email?: string | null;
  payment_term_days?: number;
  is_active?: boolean;
  product_ids?: string[];
  preferred_product_id?: string | null;
}

interface SuppliersState {
  suppliers: Supplier[];
  productLinks: MockProductSupplierLink[];
  seedIfEmpty: () => void;
  listForTenant: (tenantId: string) => SupplierWithProducts[];
  findById: (id: string) => Supplier | undefined;
  getProductIds: (supplierId: string) => string[];
  getSuppliersForProduct: (productId: string, activeOnly?: boolean) => Supplier[];
  getPreferredSupplierIdForProduct: (productId: string) => string | null;
  createSupplier: (tenantId: string, input: SupplierFormInput) => { ok: boolean; error?: string };
  updateSupplier: (
    supplierId: string,
    input: SupplierFormInput,
  ) => { ok: boolean; error?: string };
  setProductLinks: (
    supplierId: string,
    productIds: string[],
    preferredProductId?: string | null,
  ) => void;
}

let nextSupplierId = 200;

function newSupplierId(): string {
  nextSupplierId += 1;
  return `77779999-0000-0000-0000-${String(nextSupplierId).padStart(12, "0")}`;
}

function validate(input: SupplierFormInput): string | null {
  if (!input.name.trim()) return "Nama supplier wajib diisi";
  return null;
}

function applyLinks(
  links: MockProductSupplierLink[],
  supplierId: string,
  productIds: string[],
  preferredProductId?: string | null,
): MockProductSupplierLink[] {
  const filtered = links.filter((l) => l.supplier_id !== supplierId);
  const unique = [...new Set(productIds.filter(Boolean))];
  const preferred = preferredProductId ?? unique[0] ?? null;
  const next = unique.map((productId) => ({
    product_id: productId,
    supplier_id: supplierId,
    is_preferred: productId === preferred,
  }));
  return [...filtered, ...next];
}

export const useSuppliersStore = create<SuppliersState>()(
  persist(
    (set, get) => ({
      suppliers: [],
      productLinks: [],

      seedIfEmpty: () => {
        if (!allowMockDataSeeding()) return;
        if (get().suppliers.length > 0) return;
        set({
          suppliers: MOCK_SUPPLIER_LIST.map((s) => ({ ...s })),
          productLinks: MOCK_PRODUCT_SUPPLIER_LINKS.map((l) => ({ ...l })),
        });
      },

      listForTenant: (tenantId) => {
        const { suppliers, productLinks } = get();
        return suppliers
          .filter((s) => s.tenant_id === tenantId)
          .map((s) => ({
            ...s,
            product_ids: productLinks.filter((l) => l.supplier_id === s.id).map((l) => l.product_id),
          }))
          .sort((a, b) => a.name.localeCompare(b.name, "id"));
      },

      findById: (id) => get().suppliers.find((s) => s.id === id),

      getProductIds: (supplierId) =>
        get()
          .productLinks.filter((l) => l.supplier_id === supplierId)
          .map((l) => l.product_id),

      getSuppliersForProduct: (productId, activeOnly = true) => {
        const { suppliers, productLinks } = get();
        const linkedIds = productLinks
          .filter((l) => l.product_id === productId)
          .sort((a, b) => Number(b.is_preferred) - Number(a.is_preferred))
          .map((l) => l.supplier_id);

        let list =
          linkedIds.length > 0
            ? linkedIds
                .map((id) => suppliers.find((s) => s.id === id))
                .filter((s): s is Supplier => Boolean(s))
            : suppliers;

        if (activeOnly) list = list.filter((s) => s.is_active);
        return list;
      },

      getPreferredSupplierIdForProduct: (productId) => {
        const link = get().productLinks.find(
          (l) => l.product_id === productId && l.is_preferred,
        );
        if (link) return link.supplier_id;
        const any = get().productLinks.find((l) => l.product_id === productId);
        return any?.supplier_id ?? null;
      },

      createSupplier: (tenantId, input) => {
        const err = validate(input);
        if (err) return { ok: false, error: err };

        const id = newSupplierId();
        const supplier: Supplier = {
          id,
          tenant_id: tenantId,
          name: input.name.trim(),
          contact_person: input.contact_person?.trim() || null,
          phone: input.phone?.trim() || null,
          address: input.address?.trim() || null,
          email: input.email?.trim() || null,
          payment_term_days: input.payment_term_days ?? 30,
          outstanding_debt: 0,
          is_active: input.is_active ?? true,
        };

        set((s) => {
          s.suppliers.push(supplier);
          if (input.product_ids?.length) {
            s.productLinks = applyLinks(
              s.productLinks,
              id,
              input.product_ids,
              input.preferred_product_id,
            );
          }
        });

        return { ok: true };
      },

      updateSupplier: (supplierId, input) => {
        const err = validate(input);
        if (err) return { ok: false, error: err };
        const existing = get().findById(supplierId);
        if (!existing) return { ok: false, error: "Supplier tidak ditemukan" };

        set((s) => {
          const row = s.suppliers.find((x) => x.id === supplierId);
          if (!row) return;
          row.name = input.name.trim();
          row.contact_person = input.contact_person?.trim() || null;
          row.phone = input.phone?.trim() || null;
          row.address = input.address?.trim() || null;
          row.email = input.email?.trim() || null;
          if (input.payment_term_days !== undefined) row.payment_term_days = input.payment_term_days;
          if (input.is_active !== undefined) row.is_active = input.is_active;
          if (input.product_ids !== undefined) {
            s.productLinks = applyLinks(
              s.productLinks,
              supplierId,
              input.product_ids,
              input.preferred_product_id,
            );
          }
        });

        return { ok: true };
      },

      setProductLinks: (supplierId, productIds, preferredProductId) => {
        set((s) => {
          s.productLinks = applyLinks(s.productLinks, supplierId, productIds, preferredProductId);
        });
      },
    }),
    {
      name: "seps-suppliers-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ suppliers: s.suppliers, productLinks: s.productLinks }),
    },
  ),
);

export function ensureMockSuppliersSeeded(): void {
  useSuppliersStore.getState().seedIfEmpty();
}
