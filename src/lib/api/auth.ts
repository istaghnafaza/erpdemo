// =============================================================================
// Auth API — login, logout, session, current user profile
// =============================================================================

import { ok, fail, isNeonBackend } from "./client";
import { neonCall } from "./backend";
import {
  neonGetCurrentUser,
  neonRegister,
  neonSignIn,
  neonSignInWithGoogle,
  neonGoogleOAuthCallback,
  neonSignInWithPin,
  neonSignOut,
  neonUpdateProfile,
} from "@/lib/api/neon/fns";
import type { ApiResponse, AuthUser, AppProfile, GoogleSignInResult, RegisterInput, AccountProfileUpdates } from "@/types/app";
import type { Profile } from "@/types/database";
import { isMockTenantId } from "@/lib/mock-session";
import { useUsersStore } from "@/stores/users.store";
import { useAuthStore } from "@/stores/auth.store";

// ---------------------------------------------------------------------------
// signInWithPassword
// ---------------------------------------------------------------------------
export async function signIn(
  loginId: string,
  password: string,
): Promise<ApiResponse<AuthUser>> {
  if (isNeonBackend()) {
    const result = await neonCall(() => neonSignIn({ data: { username: loginId, password } }));
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Login gagal");
    return ok(result.data);
  }

  return fail("Backend auth tidak aktif. Set VITE_DATA_BACKEND=neon atau gunakan demo login.");
}

// ---------------------------------------------------------------------------
// signUp — register new tenant + owner account
// ---------------------------------------------------------------------------
export async function signUp(input: RegisterInput): Promise<ApiResponse<AuthUser>> {
  if (isNeonBackend()) {
    const result = await neonCall(() => neonRegister({ data: input }));
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Registrasi gagal");
    return ok(result.data);
  }
  return fail("Registrasi memerlukan VITE_DATA_BACKEND=neon");
}

// ---------------------------------------------------------------------------
// signInWithGoogle — Google OAuth credential
// ---------------------------------------------------------------------------
export async function signInWithGoogle(
  credential: string,
): Promise<ApiResponse<GoogleSignInResult>> {
  if (isNeonBackend()) {
    const result = await neonCall(() => neonSignInWithGoogle({ data: { credential } }));
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Login Google gagal");
    return ok(result.data);
  }
  return fail("Login Google memerlukan VITE_DATA_BACKEND=neon");
}

// ---------------------------------------------------------------------------
// signInWithGoogleCode — OAuth redirect callback (authorization code)
// ---------------------------------------------------------------------------
export async function signInWithGoogleCode(
  code: string,
  redirectUri: string,
): Promise<ApiResponse<GoogleSignInResult>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGoogleOAuthCallback({ data: { code, redirectUri } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Login Google gagal");
    return ok(result.data);
  }
  return fail("Login Google memerlukan VITE_DATA_BACKEND=neon");
}

// ---------------------------------------------------------------------------
// signOut
// ---------------------------------------------------------------------------
export async function signOut(): Promise<ApiResponse<null>> {
  if (isNeonBackend()) {
    const result = await neonCall(() => neonSignOut());
    if (result.error) return fail(result.error);
    return ok(null);
  }
  return ok(null);
}

// ---------------------------------------------------------------------------
// getCurrentUser
// ---------------------------------------------------------------------------
export async function getCurrentUser(): Promise<ApiResponse<AuthUser | null>> {
  if (isNeonBackend()) {
    const result = await neonCall(() => neonGetCurrentUser());
    if (result.error) return fail(result.error);
    return ok(result.data);
  }
  return ok(null);
}

// ---------------------------------------------------------------------------
// signInWithPin
// ---------------------------------------------------------------------------
export async function signInWithPin(
  tenantId: string,
  email: string,
  pin: string,
): Promise<ApiResponse<AppProfile>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonSignInWithPin({ data: { tenantId, email, pin } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("PIN tidak valid");
    return ok(result.data);
  }

  return fail("PIN login memerlukan VITE_DATA_BACKEND=neon");
}

// ---------------------------------------------------------------------------
// updateProfile
// ---------------------------------------------------------------------------
export async function updateProfile(
  userId: string,
  updates: AccountProfileUpdates,
): Promise<ApiResponse<AppProfile>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonUpdateProfile({ data: { userId, updates } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Profil tidak ditemukan");
    return ok(result.data);
  }

  const currentUser = useAuthStore.getState().currentUser;
  if (!currentUser || currentUser.id !== userId) {
    return fail("Sesi tidak valid");
  }
  if (isMockTenantId(currentUser.tenantId)) {
    useUsersStore.getState().initForTenant(currentUser.tenantId);
    const storeResult = useUsersStore.getState().updateUser(userId, {
      name: updates.name,
      phone: updates.phone,
      address: updates.address,
      dateOfBirth: updates.dateOfBirth,
      pin: updates.pin,
    });
    if (!storeResult.ok) return fail(storeResult.error ?? "Gagal menyimpan profil");
    const record = useUsersStore.getState().findById(userId);
    if (!record) return fail("Profil tidak ditemukan");
    const profile: AppProfile = {
      id: record.id,
      tenantId: record.tenantId,
      name: record.name,
      email: record.email,
      role: record.role,
      pin: record.pin,
      phone: record.phone,
      address: record.address,
      dateOfBirth: record.dateOfBirth,
      isActive: record.isActive,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
    useAuthStore.setState({
      currentUser: {
        ...currentUser,
        profile,
      },
    });
    return ok(profile);
  }

  return fail("Update profil memerlukan VITE_DATA_BACKEND=neon");
}

// ---------------------------------------------------------------------------
// onAuthStateChange — Neon: no realtime; poll via getCurrentUser instead
// ---------------------------------------------------------------------------
export function subscribeToAuthChanges(
  callback: (user: AuthUser | null) => void,
) {
  if (!isNeonBackend()) {
    callback(null);
    return { data: { subscription: { unsubscribe: () => {} } } };
  }

  let active = true;
  const poll = async () => {
    if (!active) return;
    const result = await getCurrentUser();
    callback(result.data ?? null);
  };
  void poll();
  const interval = setInterval(() => void poll(), 60_000);

  return {
    data: {
      subscription: {
        unsubscribe: () => {
          active = false;
          clearInterval(interval);
        },
      },
    },
  };
}
