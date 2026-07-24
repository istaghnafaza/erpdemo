// =============================================================================
// Branch Store — active branch selection, consolidated view toggle
// Persisted to localStorage (remembers last active branch across sessions)
// =============================================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getActiveBranches } from "@/lib/api/branches";
import { isNeonBackend } from "@/lib/api/backend";
import { MOCK_BRANCH_ONBOARDING } from "@/lib/mock-ids";
import { MOCK_BRANCHES } from "@/stores/auth.store";
import { resolveEffectiveActiveBranch, resolveScopedBranchIds } from "@/lib/branch-scope";
import type { Branch } from "@/types/database";

function branchCodeFromName(name: string): string {
  const letters = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return (letters.slice(0, 3) || "CBG").padEnd(3, "X").slice(0, 3);
}

function mergeMockBranches(tenantId: string, onboardingBranches: Branch[]): Branch[] {
  const base = MOCK_BRANCHES.filter((b) => b.tenant_id === tenantId);
  const extra = onboardingBranches.filter((b) => b.tenant_id === tenantId);
  return [...base, ...extra];
}

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

interface BranchState {
  // State
  branches: Branch[];
  /** Cabang yang dibuat lewat wizard onboarding (demo/mock). */
  onboardingBranches: Branch[];
  activeBranch: Branch | null;
  isConsolidated: boolean; // owner only: view data from ALL branches at once
  isLoading: boolean;
  error: string | null;

  // Actions
  loadBranches(
    tenantId: string,
    allowedBranchIds?: string[],
    includeOnboardingForOwner?: boolean,
  ): Promise<void>;
  applyOnboardingBranch(input: {
    tenantId: string;
    name: string;
    address: string;
    phone?: string;
  }): Branch;
  setBranches(branches: Branch[]): void;
  setActiveBranch(branch: Branch | null): void;
  /**
   * Toggle consolidated view.
   * Pass the current user's role — only 'owner' may enable this.
   * Calling setConsolidated(true) with any other role is silently ignored.
   */
  setConsolidated(value: boolean, role: string): void;
  clearBranches(): void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useBranchStore = create<BranchState>()(
  persist(
    (set, get) => ({
      // -----------------------------------------------------------------------
      // Initial state
      // -----------------------------------------------------------------------
      branches: [],
      onboardingBranches: [],
      activeBranch: null,
      isConsolidated: false,
      isLoading: false,
      error: null,

      // -----------------------------------------------------------------------
      // loadBranches — fetches from API and sets activeBranch to first allowed
      // -----------------------------------------------------------------------
      loadBranches: async (tenantId, allowedBranchIds, includeOnboardingForOwner = false) => {
        set({ isLoading: true, error: null });

        // Demo/mock session shortcut: mock users have no real Supabase Auth
        // session, so RLS blocks the query below and returns an empty set.
        // Use the in-memory seed mirror instead — see auth.store.ts.
        const isMockTenant =
          !isNeonBackend() && MOCK_BRANCHES.some((b) => b.tenant_id === tenantId);
        if (isMockTenant) {
          const { onboardingBranches } = get();
          let branches = mergeMockBranches(tenantId, onboardingBranches).filter(
            (b) => b.is_active,
          );
          if (allowedBranchIds && allowedBranchIds.length > 0) {
            branches = branches.filter(
              (b) =>
                allowedBranchIds.includes(b.id) ||
                (includeOnboardingForOwner &&
                  onboardingBranches.some((ob) => ob.id === b.id)),
            );
          }
          const { activeBranch, isConsolidated } = get();
          const nextActive = resolveEffectiveActiveBranch(branches, activeBranch);
          set({
            branches,
            activeBranch: nextActive,
            isConsolidated: isConsolidated && branches.length > 0,
            isLoading: false,
          });
          return;
        }

        try {
          const result = await getActiveBranches(tenantId);
          if (result.error) {
            set({ error: result.error, isLoading: false });
            return;
          }

          let branches = result.data ?? [];

          // Non-owner: filter to only assigned branches
          if (allowedBranchIds && allowedBranchIds.length > 0) {
            branches = branches.filter((b) => allowedBranchIds.includes(b.id));
          }

          const { activeBranch, isConsolidated } = get();

          const nextActive = resolveEffectiveActiveBranch(branches, activeBranch);

          set({
            branches,
            activeBranch: nextActive,
            isConsolidated: isConsolidated && branches.length > 0,
            isLoading: false,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Gagal memuat cabang";
          set({ error: msg, isLoading: false });
        }
      },

      applyOnboardingBranch: (input) => {
        const branch: Branch = {
          id: MOCK_BRANCH_ONBOARDING,
          tenant_id: input.tenantId,
          code: branchCodeFromName(input.name),
          name: input.name.trim() || "Cabang Utama",
          address: input.address.trim() || null,
          phone: input.phone?.trim() || null,
          manager_id: null,
          is_active: true,
          created_at: new Date().toISOString(),
        };

        set((s) => {
          const onboardingBranches = [
            ...s.onboardingBranches.filter((b) => b.id !== branch.id),
            branch,
          ];
          const branches = mergeMockBranches(input.tenantId, onboardingBranches);
          return {
            onboardingBranches,
            branches,
            activeBranch: branch,
            isConsolidated: false,
          };
        });

        return branch;
      },

      // -----------------------------------------------------------------------
      // setBranches — direct setter (used when data already fetched elsewhere)
      // -----------------------------------------------------------------------
      setBranches: (branches) => {
        const activeOnly = branches.filter((b) => b.is_active);
        const { activeBranch, isConsolidated } = get();
        set({
          branches: activeOnly,
          activeBranch: resolveEffectiveActiveBranch(activeOnly, activeBranch),
          isConsolidated: isConsolidated && activeOnly.length > 0,
        });
      },

      // -----------------------------------------------------------------------
      // setActiveBranch — also turns off consolidated mode
      // -----------------------------------------------------------------------
      setActiveBranch: (branch) => {
        set({ activeBranch: branch, isConsolidated: false });
      },

      // -----------------------------------------------------------------------
      // setConsolidated — only owner role can enable
      // -----------------------------------------------------------------------
      setConsolidated: (value, role) => {
        if (value && role !== "owner") return; // silent guard
        set({ isConsolidated: value });
      },

      clearBranches: () =>
        set((s) => ({
          branches: [],
          activeBranch: null,
          isConsolidated: false,
          // onboardingBranches tetap di localStorage — cabang dari wizard setup
        })),
    }),

    {
      name: "ses-branch",
      storage: createJSONStorage(() => localStorage),
      // Persist branch selections — but not loading/error state
      partialize: (state) => ({
        activeBranch: state.activeBranch,
        isConsolidated: state.isConsolidated,
        onboardingBranches: state.onboardingBranches,
      }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectBranches = (s: BranchState) => s.branches;
export const selectActiveBranch = (s: BranchState) => s.activeBranch;
export const selectActiveBranchId = (s: BranchState): string | null => {
  if (s.isConsolidated) return null;
  return resolveEffectiveActiveBranch(s.branches, s.activeBranch)?.id ?? null;
};
export const selectIsConsolidated = (s: BranchState) => s.isConsolidated;
export const selectBranchLoading = (s: BranchState) => s.isLoading;
export const selectNeedsBranchSetup = (s: BranchState) => !s.isLoading && s.branches.length === 0;

/** Returns list of branch IDs to filter queries by (hanya cabang aktif di store). */
export const selectQueryBranchIds = (s: BranchState): string[] =>
  resolveScopedBranchIds({
    branches: s.branches,
    activeBranch: s.activeBranch,
    isConsolidated: s.isConsolidated,
    // Konsolidasi hanya bisa di-set owner; flag store cukup sebagai proxy role.
    isOwner: s.isConsolidated,
  });
