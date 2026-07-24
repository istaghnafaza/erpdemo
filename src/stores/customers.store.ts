// =============================================================================
// Customers Store — master pelanggan tenant (demo/mock persist + CRUD).
// =============================================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { allowMockDataSeeding } from "@/lib/mock-data-guard";
import { MOCK_POS_CUSTOMERS } from "@/lib/mock-pos-catalog";
import { MOCK_CUSTOMER_SEGMENTS } from "@/lib/mock-customer-delivery-sites";
import { MOCK_TENANT_ID } from "@/stores/auth.store";
import type { CustomerSegment } from "@/types/customer-delivery-sites";
import type { Customer, DbCustomerType } from "@/types/database";

export interface TenantCustomerRecord extends Customer {
  segment: CustomerSegment;
}

export interface CreateCustomerInput {
  name: string;
  phone?: string | null;
  address?: string | null;
  type: DbCustomerType;
  credit_limit?: number;
  segment?: CustomerSegment;
}

export interface UpdateCustomerInput {
  name?: string;
  phone?: string | null;
  address?: string | null;
  type?: DbCustomerType;
  credit_limit?: number;
  segment?: CustomerSegment;
}

interface CustomersState {
  customers: TenantCustomerRecord[];
  seedIfEmpty: () => void;
  listForTenant: (tenantId: string) => TenantCustomerRecord[];
  findById: (id: string) => TenantCustomerRecord | undefined;
  getSegment: (customerId: string) => CustomerSegment | null;
  addCustomer: (tenantId: string, input: CreateCustomerInput) => { ok: boolean; error?: string; customer?: TenantCustomerRecord };
  updateCustomer: (id: string, input: UpdateCustomerInput) => { ok: boolean; error?: string };
}

let nextCustomCustomerId = 100;

function newCustomerId(): string {
  nextCustomCustomerId += 1;
  return `66669999-0000-0000-0000-${String(nextCustomCustomerId).padStart(12, "0")}`;
}

function toRecord(customer: Customer, segment: CustomerSegment): TenantCustomerRecord {
  return { ...customer, segment };
}

function seedCustomers(): TenantCustomerRecord[] {
  return MOCK_POS_CUSTOMERS.map((c) =>
    toRecord(c, MOCK_CUSTOMER_SEGMENTS[c.id] ?? "umum"),
  );
}

function validateCreate(input: CreateCustomerInput): string | null {
  if (!input.name.trim()) return "Nama pelanggan wajib diisi";
  if (input.type === "credit" && (input.credit_limit ?? 0) <= 0) {
    return "Limit kredit wajib diisi untuk pelanggan kredit";
  }
  return null;
}

export const useCustomersStore = create<CustomersState>()(
  persist(
    (set, get) => ({
      customers: [],

      seedIfEmpty: () => {
        if (!allowMockDataSeeding()) return;
        if (get().customers.length > 0) return;
        set({ customers: seedCustomers() });
      },

      listForTenant: (tenantId) =>
        get()
          .customers.filter((c) => c.tenant_id === tenantId)
          .sort((a, b) => a.name.localeCompare(b.name, "id")),

      findById: (id) => get().customers.find((c) => c.id === id),

      getSegment: (customerId) => get().findById(customerId)?.segment ?? null,

      addCustomer: (tenantId, input) => {
        const err = validateCreate(input);
        if (err) return { ok: false, error: err };

        const isCredit = input.type === "credit";
        const record: TenantCustomerRecord = {
          id: newCustomerId(),
          tenant_id: tenantId,
          name: input.name.trim(),
          phone: input.phone?.trim() || null,
          address: input.address?.trim() || null,
          type: input.type,
          credit_limit: isCredit ? (input.credit_limit ?? 0) : 0,
          outstanding_debt: 0,
          created_at: new Date().toISOString(),
          segment: input.segment ?? "umum",
        };

        set((s) => ({ customers: [...s.customers, record] }));
        return { ok: true, customer: record };
      },

      updateCustomer: (id, input) => {
        const existing = get().findById(id);
        if (!existing) return { ok: false, error: "Pelanggan tidak ditemukan" };

        const nextType = input.type ?? existing.type;
        const isCredit = nextType === "credit";

        set((s) => ({
          customers: s.customers.map((c) => {
            if (c.id !== id) return c;
            return {
              ...c,
              name: input.name !== undefined ? input.name.trim() : c.name,
              phone: input.phone !== undefined ? input.phone : c.phone,
              address: input.address !== undefined ? input.address : c.address,
              type: nextType,
              credit_limit:
                input.credit_limit !== undefined
                  ? input.credit_limit
                  : isCredit
                    ? c.credit_limit
                    : 0,
              segment: input.segment ?? c.segment,
            };
          }),
        }));

        return { ok: true };
      },
    }),
    {
      name: "ses-customers",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (allowMockDataSeeding()) state?.seedIfEmpty();
      },
    },
  ),
);

/** Helper untuk modul yang belum subscribe ke store. */
export function getCustomerSegment(customerId: string): CustomerSegment | null {
  return useCustomersStore.getState().getSegment(customerId);
}

/** Daftar pelanggan mock tenant — dipakai cache offline & POS. */
export function getMockTenantCustomers(tenantId: string = MOCK_TENANT_ID): Customer[] {
  useCustomersStore.getState().seedIfEmpty();
  return useCustomersStore.getState().listForTenant(tenantId);
}
