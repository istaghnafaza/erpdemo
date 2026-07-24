// =============================================================================
// Auth Store — currentUser, currentTenant, login, logout
// Persisted to localStorage via zustand/middleware/persist
// =============================================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { signIn, signOut, getCurrentUser, signUp, signInWithGoogle, signInWithGoogleCode } from "@/lib/api/auth";
import { getTenant } from "@/lib/api/tenants";
import { isNeonBackend, isMockBackend } from "@/lib/api/backend";
import { useBranchStore } from "@/stores/branch.store";
import { useNotificationStore } from "@/stores/notification.store";
import { usePosStore } from "@/stores/pos.store";
import { MOCK_TENANT_ID } from "@/lib/mock-ids";
import { tenantUserToAuthUser } from "@/lib/mock-users";
import type { AuthUser, RegisterInput } from "@/types/app";
import type { Branch, Tenant } from "@/types/database";
import { useUsersStore } from "@/stores/users.store";

export { MOCK_TENANT_ID };

// ---------------------------------------------------------------------------
// Mock demo users — IDs match `supabase/migrations/003_seed_data.sql` exactly,
// so any downstream Supabase query (branches, notifications, reports, ...)
// keyed off these IDs resolves against real seeded rows instead of failing.
//
// NOTE: mock sessions never call supabase.auth.signIn(), so auth.uid() is
// NULL server-side and RLS silently filters out every row for these tenant/
// branch IDs even though they exist in the seeded database. Downstream code
// (branch.store, notification seeding) must special-case mock sessions and
// use the exported constants below directly instead of hitting the API.
// ---------------------------------------------------------------------------

export const MOCK_USER_ID_PREFIX = "33331111-";

const MOCK_BRANCH_SUDIRMAN = "22221111-0000-0000-0000-000000000001";
const MOCK_BRANCH_KEBONJERUK = "22221111-0000-0000-0000-000000000002";
const MOCK_BRANCH_BEKASI = "22221111-0000-0000-0000-000000000003";

export type MockRole = "owner" | "manager" | "cashier";

/** Gabungkan cabang dari wizard onboarding ke akses user (demo/localStorage). */
function withOnboardingBranchAccess(user: AuthUser): AuthUser {
  const onboardingIds = useBranchStore.getState().onboardingBranches.map((b) => b.id);
  if (onboardingIds.length === 0) return user;

  const allowedBranchIds = [...new Set([...user.allowedBranchIds, ...onboardingIds])];
  return {
    ...user,
    allowedBranchIds,
    activeBranchId: user.activeBranchId ?? onboardingIds[0] ?? null,
  };
}

const MOCK_USERS: Record<MockRole, AuthUser> = {
  owner: {
    id: "33331111-0000-0000-0000-000000000001",
    email: "budi@simetri.id",
    tenantId: MOCK_TENANT_ID,
    profile: {
      id: "33331111-0000-0000-0000-000000000001",
      tenantId: MOCK_TENANT_ID,
      name: "Budi Santoso",
      email: "budi@simetri.id",
      role: "owner",
      pin: "000000",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    activeBranchId: MOCK_BRANCH_SUDIRMAN,
    allowedBranchIds: [MOCK_BRANCH_SUDIRMAN, MOCK_BRANCH_KEBONJERUK, MOCK_BRANCH_BEKASI],
    isOwner: true,
    isManager: false,
    isCashier: false,
    isWarehouse: false,
    isAccountant: false,
  },
  manager: {
    id: "33331111-0000-0000-0000-000000000002",
    email: "siti@simetri.id",
    tenantId: MOCK_TENANT_ID,
    profile: {
      id: "33331111-0000-0000-0000-000000000002",
      tenantId: MOCK_TENANT_ID,
      name: "Siti Rahma",
      email: "siti@simetri.id",
      role: "manager",
      pin: "111111",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    activeBranchId: MOCK_BRANCH_SUDIRMAN,
    allowedBranchIds: [MOCK_BRANCH_SUDIRMAN, MOCK_BRANCH_KEBONJERUK],
    isOwner: false,
    isManager: true,
    isCashier: false,
    isWarehouse: false,
    isAccountant: false,
  },
  cashier: {
    id: "33331111-0000-0000-0000-000000000004",
    email: "andi@simetri.id",
    tenantId: MOCK_TENANT_ID,
    profile: {
      id: "33331111-0000-0000-0000-000000000004",
      tenantId: MOCK_TENANT_ID,
      name: "Andi Pratama",
      email: "andi@simetri.id",
      role: "cashier",
      pin: "222222",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    activeBranchId: MOCK_BRANCH_SUDIRMAN,
    allowedBranchIds: [MOCK_BRANCH_SUDIRMAN],
    isOwner: false,
    isManager: false,
    isCashier: true,
    isWarehouse: false,
    isAccountant: false,
  },
};

const MOCK_TENANT: Tenant = {
  id: MOCK_TENANT_ID,
  name: "Toko Bangunan Simetri",
  slug: "toko-simetri",
  owner_email: "budi@simetri.id",
  phone: "021-5551234",
  plan: "pro",
  trial_ends_at: null,
  is_active: true,
  onboarding_complete: true,
  legacy_mode_active: false,
  logo_url: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/** Branch rows for the mock demo tenant — mirrors `003_seed_data.sql` exactly. */
export const MOCK_BRANCHES: Branch[] = [
  {
    id: MOCK_BRANCH_SUDIRMAN,
    tenant_id: MOCK_TENANT_ID,
    code: "SDR",
    name: "Cabang Sudirman",
    address: "Jl. Jend. Sudirman No. 45, Jakarta Pusat",
    phone: "021-5551234",
    manager_id: null,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: MOCK_BRANCH_KEBONJERUK,
    tenant_id: MOCK_TENANT_ID,
    code: "KBJ",
    name: "Cabang Kebon Jeruk",
    address: "Jl. Kebon Jeruk No. 12, Jakarta Barat",
    phone: "021-5556789",
    manager_id: null,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: MOCK_BRANCH_BEKASI,
    tenant_id: MOCK_TENANT_ID,
    code: "BKS",
    name: "Cabang Bekasi",
    address: "Jl. Ahmad Yani No. 88, Bekasi",
    phone: "021-5559876",
    manager_id: null,
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

interface AuthState {
  // State
  currentUser: AuthUser | null;
  currentTenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login(email: string, password: string): Promise<boolean>;
  register(input: RegisterInput): Promise<boolean>;
  loginWithGoogle(credential: string): Promise<{ ok: boolean; isNewUser?: boolean }>;
  completeGoogleOAuth(code: string, redirectUri: string): Promise<{ ok: boolean; isNewUser?: boolean }>;
  /** Development/demo only — instantly signs in as a seeded demo user, no Supabase call. */
  loginAsMock(role: MockRole): void;
  /** Demo login dengan email + PIN pegawai (dari modul Users / onboarding). */
  loginWithMockCredentials(email: string, pin: string): boolean;
  logout(): Promise<void>;
  refreshUser(): Promise<void>;
  /** Demo: tambahkan cabang onboarding ke daftar cabang yang boleh diakses owner. */
  grantMockBranchAccess(branchId: string): void;
  /** Demo: aktifkan legacy stock & tandai onboarding selesai di tenant mock. */
  setMockTenantGoLiveFlags(flags: {
    legacyModeActive?: boolean;
    onboardingComplete?: boolean;
  }): void;
  clearError(): void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

function friendlyTenantLoadError(raw: string | null | undefined): string {
  if (!raw) return "Gagal memuat data bisnis.";
  if (raw.includes("logo_url") || raw.includes("Failed query")) {
    return "Database perlu migrasi terbaru. Jalankan: npm run neon:migrate";
  }
  return raw;
}

async function applyAuthSession(user: AuthUser): Promise<boolean> {
  let tenant = null as Awaited<ReturnType<typeof getTenant>>["data"];
  if (isNeonBackend()) {
    const tenantResult = await getTenant(user.tenantId);
    if (tenantResult.error || !tenantResult.data) {
      useAuthStore.setState({
        currentUser: null,
        currentTenant: null,
        isAuthenticated: false,
        isLoading: false,
        error: friendlyTenantLoadError(tenantResult.error),
      });
      return false;
    }
    tenant = tenantResult.data;
  }

  usePosStore.getState().clearSession();
  useAuthStore.setState({
    currentUser: user,
    currentTenant: tenant,
    isAuthenticated: true,
    isLoading: false,
    error: null,
  });
  return true;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // -----------------------------------------------------------------------
      // Initial state
      // -----------------------------------------------------------------------
      currentUser: null,
      currentTenant: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // -----------------------------------------------------------------------
      // login — authenticates with Supabase and loads tenant
      // -----------------------------------------------------------------------
      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const authResult = await signIn(email, password);
          if (authResult.error) {
            set({ error: authResult.error, isLoading: false });
            return false;
          }
          return applyAuthSession(authResult.data!);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Login gagal";
          set({ error: msg, isLoading: false });
          return false;
        }
      },

      register: async (input) => {
        set({ isLoading: true, error: null });
        try {
          const authResult = await signUp(input);
          if (authResult.error) {
            set({ error: authResult.error, isLoading: false });
            return false;
          }
          return applyAuthSession(authResult.data!);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Registrasi gagal";
          set({ error: msg, isLoading: false });
          return false;
        }
      },

      loginWithGoogle: async (credential) => {
        set({ isLoading: true, error: null });
        try {
          const authResult = await signInWithGoogle(credential);
          if (authResult.error) {
            set({ error: authResult.error, isLoading: false });
            return { ok: false };
          }
          const user = authResult.data!;
          const isNewUser = user.isNewUser;
          const applied = await applyAuthSession(user);
          if (!applied) return { ok: false };
          return { ok: true, isNewUser };
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Login Google gagal";
          set({ error: msg, isLoading: false });
          return { ok: false };
        }
      },

      completeGoogleOAuth: async (code, redirectUri) => {
        set({ isLoading: true, error: null });
        try {
          const authResult = await signInWithGoogleCode(code, redirectUri);
          if (authResult.error) {
            set({ error: authResult.error, isLoading: false });
            return { ok: false };
          }
          const user = authResult.data!;
          const isNewUser = user.isNewUser;
          const applied = await applyAuthSession(user);
          if (!applied) return { ok: false };
          return { ok: true, isNewUser };
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Login Google gagal";
          set({ error: msg, isLoading: false });
          return { ok: false };
        }
      },

      // -----------------------------------------------------------------------
      // loginAsMock — development/demo shortcut. Bypasses Supabase Auth
      // entirely and signs in as one of the seeded demo users (see
      // supabase/migrations/003_seed_data.sql). IDs match the seed data so
      // branch/notification queries downstream resolve against real rows.
      // -----------------------------------------------------------------------
      loginAsMock: (role) => {
        useUsersStore.getState().initForTenant(MOCK_TENANT_ID);
        const record = useUsersStore
          .getState()
          .listForTenant(MOCK_TENANT_ID)
          .find((u) => u.role === role && u.isActive);
        const authUser = withOnboardingBranchAccess(
          record ? tenantUserToAuthUser(record) : MOCK_USERS[role],
        );
        usePosStore.getState().clearSession();
        set({
          currentUser: authUser,
          currentTenant: MOCK_TENANT,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      },

      loginWithMockCredentials: (email, pin) => {
        useUsersStore.getState().initForTenant(MOCK_TENANT_ID);
        const record = useUsersStore.getState().findByEmailAndPin(MOCK_TENANT_ID, email, pin);
        if (!record) return false;
        usePosStore.getState().clearSession();
        set({
          currentUser: withOnboardingBranchAccess(tenantUserToAuthUser(record)),
          currentTenant: MOCK_TENANT,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        return true;
      },

      // -----------------------------------------------------------------------
      // logout — clears session and store
      // -----------------------------------------------------------------------
      logout: async () => {
        set({ isLoading: true });
        await signOut();
        useBranchStore.getState().clearBranches();
        useNotificationStore.getState().unsubscribe();
        useNotificationStore.getState().clearAll();
        usePosStore.getState().clearSession();
        set({
          currentUser: null,
          currentTenant: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      },

      // -----------------------------------------------------------------------
      // refreshUser — re-reads from Supabase session (called on app mount)
      // -----------------------------------------------------------------------
      refreshUser: async () => {
        // Mock demo session — no Supabase/Neon cookie to refresh
        if (
          isMockBackend() &&
          get().isAuthenticated &&
          get().currentUser?.id.startsWith("33331111-")
        ) {
          return;
        }

        if (!isNeonBackend()) {
          return;
        }

        try {
          const userResult = await getCurrentUser();
          if (userResult.error || !userResult.data) {
            set({
              currentUser: null,
              currentTenant: null,
              isAuthenticated: false,
            });
            return;
          }

          const user = userResult.data;

          const tenantResult = await getTenant(user.tenantId);
          const tenant = tenantResult.data ?? null;
          if (!tenant && tenantResult.error) {
            set({
              currentUser: user,
              currentTenant: null,
              isAuthenticated: true,
              error: friendlyTenantLoadError(tenantResult.error),
            });
            return;
          }

          set({
            currentUser: user,
            currentTenant: tenant,
            isAuthenticated: true,
            error: null,
          });
        } catch {
          // ignore — public pages stay usable on slow mobile networks
        }
      },

      clearError: () => set({ error: null }),

      grantMockBranchAccess: (branchId) => {
        const user = get().currentUser;
        if (!user || user.allowedBranchIds.includes(branchId)) return;
        const nextUser = {
          ...user,
          allowedBranchIds: [...user.allowedBranchIds, branchId],
          activeBranchId: branchId,
        };
        set({ currentUser: nextUser });

        const profile = useUsersStore.getState().findById(user.id);
        if (profile) {
          useUsersStore.getState().updateUser(user.id, {
            branchIds: [...new Set([...profile.branchIds, branchId])],
          });
        }
      },

      setMockTenantGoLiveFlags: (flags) => {
        const tenant = get().currentTenant;
        if (!tenant) return;
        set({
          currentTenant: {
            ...tenant,
            legacy_mode_active:
              flags.legacyModeActive ?? tenant.legacy_mode_active,
            onboarding_complete:
              flags.onboardingComplete ?? tenant.onboarding_complete,
            updated_at: new Date().toISOString(),
          },
        });
      },
    }),

    {
      name: "ses-auth",
      storage: createJSONStorage(() => localStorage),
      // Only persist what's needed to remember the session — not loading state
      partialize: (state) => ({
        currentUser: state.currentUser,
        currentTenant: state.currentTenant,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Selectors (use these in components — avoids re-renders on unrelated changes)
// ---------------------------------------------------------------------------

export const selectCurrentUser = (s: AuthState) => s.currentUser;
export const selectCurrentTenant = (s: AuthState) => s.currentTenant;
export const selectIsLoggedIn = (s: AuthState) => s.isAuthenticated && s.currentUser !== null;
export const selectUserRole = (s: AuthState) => s.currentUser?.profile.role ?? null;
export const selectTenantId = (s: AuthState) => s.currentUser?.tenantId ?? null;
export const selectIsOwner = (s: AuthState) => s.currentUser?.isOwner ?? false;
export const selectIsManager = (s: AuthState) => s.currentUser?.isManager ?? false;
export const selectIsCashier = (s: AuthState) => s.currentUser?.isCashier ?? false;
export const selectAuthLoading = (s: AuthState) => s.isLoading;
export const selectAuthError = (s: AuthState) => s.error;
