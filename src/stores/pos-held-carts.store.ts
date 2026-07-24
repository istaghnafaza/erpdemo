// =============================================================================
// POS Held Carts — registry cabang (localStorage demo) untuk "Ambil Alih Pesanan".
// Saat kasir hold keranjang, snapshot disimpan di sini agar kasir lain bisa takeover.
// =============================================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartItem, Customer } from "@/types/database";

export interface BranchHeldCart {
  id: string;
  tenantId: string;
  branchId: string;
  cashierId: string;
  cashierName: string;
  label: string;
  customer: Customer | null;
  items: CartItem[];
  discount: number;
  notes: string;
  heldAt: string;
}

interface PosHeldCartsState {
  carts: BranchHeldCart[];
  publish: (cart: BranchHeldCart) => void;
  remove: (id: string) => void;
  listForBranch: (
    tenantId: string,
    branchId: string,
    excludeCashierId?: string,
  ) => BranchHeldCart[];
}

export const usePosHeldCartsStore = create<PosHeldCartsState>()(
  persist(
    (set, get) => ({
      carts: [],

      publish: (cart) => {
        set((s) => ({
          carts: [...s.carts.filter((c) => c.id !== cart.id), cart],
        }));
      },

      remove: (id) => {
        set((s) => ({
          carts: s.carts.filter((c) => c.id !== id),
        }));
      },

      listForBranch: (tenantId, branchId, excludeCashierId) =>
        get().carts.filter(
          (c) =>
            c.tenantId === tenantId &&
            c.branchId === branchId &&
            (!excludeCashierId || c.cashierId !== excludeCashierId),
        ),
    }),
    {
      name: "ses-pos-held-carts",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
