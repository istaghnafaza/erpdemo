// =============================================================================
// Onboarding Store — wizard state + progress tracker (Fase 14).
// =============================================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { UserRole } from "@/types/app";

export type OnboardingPath = "new" | "no-records" | "book" | "excel";

export interface OnboardingUserDraft {
  id: string;
  name: string;
  email: string;
  pin: string;
  role: UserRole;
}

export interface OnboardingProductDraft {
  productId: string;
  sku: string;
  name: string;
  sellPrice: number;
  initialStock: number;
  selected: boolean;
}

export interface BookProductRow {
  id: string;
  name: string;
  category: string;
  unit: string;
  sellPrice: number;
  stock: number;
}

export interface ExcelImportRow {
  row: number;
  sku: string;
  name: string;
  sellPrice: number;
  stock: number;
  valid: boolean;
  error?: string;
}

export interface OnboardingSummary {
  productCount: number;
  branchCount: number;
  userCount: number;
}

interface OnboardingState {
  isComplete: boolean;
  dismissed: boolean;
  step: 1 | 2 | 3 | 4 | 5;
  path: OnboardingPath | null;
  storeName: string;
  storeSlug: string;
  storeAddress: string;
  storePhone: string;
  storeNpwp: string;
  branchName: string;
  branchAddress: string;
  /** Satu lokasi — nama & alamat cabang mengikuti toko (default). */
  singleBranchMode: boolean;
  users: OnboardingUserDraft[];
  products: OnboardingProductDraft[];
  legacyMode: boolean;
  bookRows: BookProductRow[];
  excelRows: ExcelImportRow[];
  skippedUsers: boolean;
  skippedProducts: boolean;
  /** Mode khusus: hanya form tambah cabang (dari link di wizard). */
  addBranchOnly: boolean;
  /** Izinkan wizard penuh meski onboarding_complete (setup toko baru / reaktivasi). */
  wizardResumeMode: boolean;

  setStep: (step: 1 | 2 | 3 | 4 | 5) => void;
  setPath: (path: OnboardingPath) => void;
  updateStoreInfo: (patch: Partial<Pick<OnboardingState, "storeName" | "storeSlug" | "storeAddress" | "storePhone" | "storeNpwp" | "branchName" | "branchAddress">>) => void;
  setSingleBranchMode: (v: boolean) => void;
  addUser: (user: Omit<OnboardingUserDraft, "id">) => void;
  removeUser: (id: string) => void;
  setSkippedUsers: (v: boolean) => void;
  setSkippedProducts: (v: boolean) => void;
  toggleProduct: (productId: string) => void;
  updateProduct: (productId: string, patch: Partial<Pick<OnboardingProductDraft, "sellPrice" | "initialStock">>) => void;
  setLegacyMode: (v: boolean) => void;
  setBookRows: (rows: BookProductRow[]) => void;
  addBookRow: () => void;
  updateBookRow: (id: string, patch: Partial<BookProductRow>) => void;
  setExcelRows: (rows: ExcelImportRow[]) => void;
  dismissTracker: () => void;
  completeOnboarding: () => void;
  resumeOnboarding: () => void;
  startWizardSetup: (prefill?: {
    storeName?: string;
    storeSlug?: string;
    storePhone?: string;
  }) => void;
  startAddBranchSetup: () => void;
  finishAddBranchSetup: () => void;
  finishWizardResume: () => void;
  resetOnboarding: () => void;
  getProgressPercent: () => number;
  getSummary: () => OnboardingSummary;
}

const INITIAL_PRODUCTS: OnboardingProductDraft[] = [
  { productId: "p0", sku: "BRG-001", name: "Semen Portland 50kg", sellPrice: 65000, initialStock: 0, selected: false },
  { productId: "p1", sku: "BRG-002", name: "Bata Merah", sellPrice: 1100, initialStock: 0, selected: false },
  { productId: "p2", sku: "BRG-003", name: "Cat Tembok 25kg", sellPrice: 185000, initialStock: 0, selected: false },
  { productId: "p3", sku: "BRG-005", name: "Keramik 40x40 Putih", sellPrice: 78000, initialStock: 0, selected: false },
  { productId: "p4", sku: "BRG-007", name: "Besi Hollow 4x4", sellPrice: 105000, initialStock: 0, selected: false },
  { productId: "p5", sku: "BRG-009", name: "Triplek 9mm", sellPrice: 120000, initialStock: 0, selected: false },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      isComplete: false,
      dismissed: false,
      step: 1,
      path: null,
      storeName: "",
      storeSlug: "",
      storeAddress: "",
      storePhone: "",
      storeNpwp: "",
      branchName: "",
      branchAddress: "",
      singleBranchMode: true,
      users: [],
      products: INITIAL_PRODUCTS,
      legacyMode: false,
      bookRows: [
        { id: "b1", name: "", category: "Semen & Mortar", unit: "sak", sellPrice: 0, stock: 0 },
        { id: "b2", name: "", category: "Cat & Finishing", unit: "kaleng", sellPrice: 0, stock: 0 },
      ],
      excelRows: [],
      skippedUsers: false,
      skippedProducts: false,
      addBranchOnly: false,
      wizardResumeMode: false,

      setStep: (step) => set({ step }),
      setPath: (path) =>
        set((s) => ({
          path,
          legacyMode: path === "no-records" ? true : s.legacyMode,
        })),

      updateStoreInfo: (patch) => {
        set((s) => {
          const next = { ...s, ...patch };
          const slugTouched = patch.storeSlug !== undefined;
          if (patch.storeName !== undefined && !slugTouched) {
            next.storeSlug = slugify(patch.storeName);
          }
          if (s.singleBranchMode) {
            if (patch.storeName !== undefined) next.branchName = patch.storeName;
            if (patch.storeAddress !== undefined) next.branchAddress = patch.storeAddress;
          }
          return next;
        });
      },

      setSingleBranchMode: (v) =>
        set((s) => {
          if (v) {
            return {
              singleBranchMode: true,
              branchName: s.storeName,
              branchAddress: s.storeAddress,
            };
          }
          return {
            singleBranchMode: false,
            branchName: s.branchName || s.storeName,
            branchAddress: s.branchAddress || s.storeAddress,
          };
        }),

      addUser: (user) =>
        set((s) => ({
          users: [...s.users, { ...user, id: `u-${Date.now()}` }],
        })),

      removeUser: (id) =>
        set((s) => ({ users: s.users.filter((u) => u.id !== id) })),

      setSkippedUsers: (v) => set({ skippedUsers: v }),

      setSkippedProducts: (v) => set({ skippedProducts: v }),

      toggleProduct: (productId) =>
        set((s) => ({
          products: s.products.map((p) =>
            p.productId === productId ? { ...p, selected: !p.selected } : p,
          ),
        })),

      updateProduct: (productId, patch) =>
        set((s) => ({
          products: s.products.map((p) => (p.productId === productId ? { ...p, ...patch } : p)),
        })),

      setLegacyMode: (v) => set({ legacyMode: v }),

      setBookRows: (rows) => set({ bookRows: rows }),

      addBookRow: () =>
        set((s) => ({
          bookRows: [
            ...s.bookRows,
            {
              id: `b-${Date.now()}`,
              name: "",
              category: "Lainnya",
              unit: "pcs",
              sellPrice: 0,
              stock: 0,
            },
          ],
        })),

      updateBookRow: (id, patch) =>
        set((s) => ({
          bookRows: s.bookRows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),

      setExcelRows: (rows) => set({ excelRows: rows }),

      dismissTracker: () => set({ dismissed: true }),

      completeOnboarding: () =>
        set({ isComplete: true, dismissed: true, step: 5, wizardResumeMode: false }),

      resumeOnboarding: () =>
        set((s) => ({
          isComplete: false,
          dismissed: false,
          addBranchOnly: false,
          wizardResumeMode: true,
          step: s.isComplete ? 1 : s.step,
        })),

      startWizardSetup: (prefill) => {
        const storeName = prefill?.storeName?.trim() || "";
        const storeSlug = prefill?.storeSlug?.trim() || "";
        const storePhone = prefill?.storePhone?.trim() || "";
        set({
          isComplete: false,
          dismissed: false,
          addBranchOnly: false,
          wizardResumeMode: true,
          step: 1,
          path: null,
          storeName,
          storeSlug,
          storeAddress: "",
          storePhone,
          storeNpwp: "",
          branchName: storeName,
          branchAddress: "",
          singleBranchMode: true,
          users: [],
          products: INITIAL_PRODUCTS.map((p) => ({ ...p, selected: false })),
          legacyMode: false,
          bookRows: [
            {
              id: "b1",
              name: "",
              category: "Semen & Mortar",
              unit: "sak",
              sellPrice: 0,
              stock: 0,
            },
            {
              id: "b2",
              name: "",
              category: "Cat & Finishing",
              unit: "kaleng",
              sellPrice: 0,
              stock: 0,
            },
          ],
          excelRows: [],
          skippedUsers: false,
          skippedProducts: false,
        });
      },

      startAddBranchSetup: () =>
        set({
          addBranchOnly: true,
          wizardResumeMode: false,
          isComplete: false,
          dismissed: false,
          singleBranchMode: false,
          branchName: "",
          branchAddress: "",
          step: 2,
        }),

      finishAddBranchSetup: () => set({ addBranchOnly: false }),

      finishWizardResume: () => set({ wizardResumeMode: false }),

      resetOnboarding: () =>
        set({
          isComplete: false,
          dismissed: false,
          addBranchOnly: false,
          wizardResumeMode: false,
          step: 1,
          path: null,
          storeName: "",
          storeSlug: "",
          storeAddress: "",
          storePhone: "",
          storeNpwp: "",
          branchName: "",
          branchAddress: "",
          singleBranchMode: true,
          users: [],
          products: INITIAL_PRODUCTS.map((p) => ({ ...p, selected: false })),
          legacyMode: false,
          bookRows: [
            { id: "b1", name: "", category: "Semen & Mortar", unit: "sak", sellPrice: 0, stock: 0 },
            { id: "b2", name: "", category: "Cat & Finishing", unit: "kaleng", sellPrice: 0, stock: 0 },
          ],
          excelRows: [],
          skippedUsers: false,
          skippedProducts: false,
        }),

      getProgressPercent: () => {
        const s = get();
        if (s.isComplete) return 100;
        let done = 0;
        if (s.path) done++;
        if (s.storeName.trim() && (s.singleBranchMode || s.branchName.trim())) done++;
        if (s.skippedUsers || s.users.length > 0) done++;
        if (s.skippedProducts) done++;
        else if (s.path === "new" && s.products.some((p) => p.selected)) done++;
        else if (s.path === "no-records") done++;
        else if (s.path === "book" && s.bookRows.some((r) => r.name.trim())) done++;
        else if (s.path === "excel" && s.excelRows.some((r) => r.valid)) done++;
        return Math.round((done / 4) * 100);
      },

      getSummary: () => {
        const s = get();
        let productCount = 0;
        if (!s.skippedProducts) {
          if (s.path === "new") productCount = s.products.filter((p) => p.selected).length;
          else if (s.path === "book") productCount = s.bookRows.filter((r) => r.name.trim()).length;
          else if (s.path === "excel") productCount = s.excelRows.filter((r) => r.valid).length;
          else if (s.path === "no-records") productCount = s.bookRows.filter((r) => r.name.trim()).length;
        }

        return {
          productCount,
          branchCount: 1,
          userCount: s.skippedUsers ? 1 : Math.max(1, s.users.length),
        };
      },
    }),
    {
      name: "ses-onboarding",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
