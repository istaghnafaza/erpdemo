// =============================================================================
// Neon RPC — createServerFn wrappers (client-safe module path)
// Server logic loaded via dynamic import inside handlers only.
// =============================================================================

import { createServerFn } from "@tanstack/react-start";
import type {
  AuthUser,
  AppProfile,
  CreateTenantUserInput,
  GoogleSignInResult,
  RegisterInput,
  TenantUserRecord,
  UpdateTenantUserInput,
} from "@/types/app";
import type {
  Branch,
  BranchInsert,
  BranchUpdate,
  Tenant,
  TenantInsert,
  TenantUpdate,
} from "@/types/database";

type BranchWithManager = Branch & {
  manager: { id: string; name: string; email: string } | null;
};

async function sessionHelpers() {
  const [session, requestSession] = await Promise.all([
    import("@/server/auth/session"),
    import("@/server/auth/request-session"),
  ]);
  return { ...session, ...requestSession };
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const neonSignIn = createServerFn({ method: "POST" })
  .validator((data: { username: string; password: string }) => data)
  .handler(async ({ data }): Promise<AuthUser> => {
    const { checkRateLimitAsync, clearRateLimit, getClientIp } = await import("@/server/rate-limit");
    const ip = await getClientIp();
    const limit = await checkRateLimitAsync(`sign-in:${ip}`, {
      maxAttempts: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!limit.allowed) {
      throw new Error(
        `Terlalu banyak percobaan login. Coba lagi dalam ${limit.retryAfterSec ?? 60} detik.`,
      );
    }

    const { validateLoginForm } = await import("@/lib/validation/login-form");
    const parsed = validateLoginForm(data);
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message ?? "Data login tidak valid");
    }

    const { signInWithPassword } = await import("@/server/services/auth");
    const { sessionCookieHeader } = await import("@/server/auth/session");
    const { setResponseHeader } = await import("@tanstack/react-start/server");

    let result: Awaited<ReturnType<typeof signInWithPassword>>;
    try {
      result = await signInWithPassword(parsed.data.username, parsed.data.password);
    } catch (err) {
      if (err instanceof Error && err.message === "EMAIL_NOT_VERIFIED") {
        throw new Error("Email belum diverifikasi. Cek inbox atau buka halaman verifikasi email.");
      }
      if (err instanceof Error && err.message === "TENANT_INACTIVE") {
        throw new Error(
          "Toko sudah nonaktif. Silakan daftar ulang — email yang sama bisa dipakai lagi.",
        );
      }
      throw err;
    }
    if (!result) throw new Error("Username atau PIN salah");

    clearRateLimit(`sign-in:${ip}`);
    setResponseHeader("Set-Cookie", sessionCookieHeader(result.token));
    return result.user;
  });

export const neonSignOut = createServerFn({ method: "POST" }).handler(async () => {
  const { clearSessionCookieHeader } = await import("@/server/auth/session");
  const { setResponseHeader } = await import("@tanstack/react-start/server");
  setResponseHeader("Set-Cookie", clearSessionCookieHeader());
  return null;
});

export const neonGetCurrentUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<AuthUser | null> => {
    const { getUserBySession } = await import("@/server/services/auth");
    const { getRequestSession } = await sessionHelpers();
    const session = await getRequestSession();
    if (!session) return null;
    return getUserBySession(session.sub);
  },
);

export const neonSignInWithPin = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; email: string; pin: string }) => data)
  .handler(async ({ data }): Promise<AppProfile> => {
    const { assertAuthRateLimit } = await import("@/server/server-fn-rate-limit");
    await assertAuthRateLimit("sign-in-pin");
    const { signInWithPin } = await import("@/server/services/auth");
    const profile = await signInWithPin(data.tenantId, data.email, data.pin);
    if (!profile) throw new Error("PIN tidak valid");
    return profile;
  });

export const neonRequestPasswordReset = createServerFn({ method: "POST" })
  .validator((data: { identifier: string; channel: "email" | "sms" }) => data)
  .handler(async ({ data }) => {
    const { assertAuthRateLimit } = await import("@/server/server-fn-rate-limit");
    await assertAuthRateLimit("password-reset");
    const { requestPasswordResetOtp } = await import("@/server/services/password-reset");
    return requestPasswordResetOtp(data);
  });

export const neonConfirmPasswordReset = createServerFn({ method: "POST" })
  .validator((data: { challengeId: string; otp: string; newPin: string }) => data)
  .handler(async ({ data }) => {
    const { assertAuthRateLimit } = await import("@/server/server-fn-rate-limit");
    await assertAuthRateLimit("password-reset-confirm");
    const { confirmPasswordReset } = await import("@/server/services/password-reset");
    await confirmPasswordReset(data);
    return { ok: true as const };
  });

export const neonUpdateProfile = createServerFn({ method: "POST" })
  .validator(
    (data: { userId: string; updates: import("@/types/app").AccountProfileUpdates }) => data,
  )
  .handler(async ({ data }): Promise<AppProfile> => {
    const { updateUserProfile } = await import("@/server/services/auth");
    const { requireRequestSession } = await sessionHelpers();
    const session = await requireRequestSession();
    if (session.sub !== data.userId) throw new Error("Unauthorized");

    const updated = await updateUserProfile(data.userId, data.updates);
    if (!updated) throw new Error("Profil tidak ditemukan");
    return updated;
  });

// ---------------------------------------------------------------------------
// Tenants
// ---------------------------------------------------------------------------

export const neonGetTenant = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string }) => data)
  .handler(async ({ data }): Promise<Tenant> => {
    const { getTenantById } = await import("@/server/services/tenants");
    const { assertTenant, requireRequestSession } = await sessionHelpers();
    const session = await requireRequestSession();
    assertTenant(session, data.tenantId);
    const tenant = await getTenantById(data.tenantId);
    if (!tenant) throw new Error("Tenant tidak ditemukan");
    return tenant;
  });

export const neonGetAllTenants = createServerFn({ method: "GET" }).handler(
  async (): Promise<Tenant[]> => {
    const { listTenants } = await import("@/server/services/tenants");
    const { requirePlatformAdminSession } = await import("@/server/auth/platform-session");
    await requirePlatformAdminSession();
    return listTenants();
  },
);

export const neonCreateTenant = createServerFn({ method: "POST" })
  .validator((data: { payload: TenantInsert }) => data)
  .handler(async ({ data }): Promise<Tenant> => {
    const { createTenant } = await import("@/server/services/tenants");
    const { requireRequestSession } = await sessionHelpers();
    await requireRequestSession();
    return createTenant(data.payload);
  });

export const neonUpdateTenant = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; updates: TenantUpdate }) => data)
  .handler(async ({ data }): Promise<Tenant> => {
    const { updateTenant } = await import("@/server/services/tenants");
    const { assertTenantRoles, requireRequestSession } = await sessionHelpers();
    const session = await requireRequestSession();
    await assertTenantRoles(session, data.tenantId, ["owner"]);
    const tenant = await updateTenant(data.tenantId, data.updates);
    if (!tenant) throw new Error("Tenant tidak ditemukan");
    return tenant;
  });

export const neonGetTenantBySlug = createServerFn({ method: "POST" })
  .validator((data: { slug: string }) => data)
  .handler(async ({ data }): Promise<Tenant> => {
    const { getTenantBySlug } = await import("@/server/services/tenants");
    const tenant = await getTenantBySlug(data.slug);
    if (!tenant) throw new Error("Tenant tidak ditemukan");
    return tenant;
  });

export const neonCheckTenantSlugAvailable = createServerFn({ method: "POST" })
  .validator((data: { slug: string; tenantId?: string }) => data)
  .handler(async ({ data }): Promise<{ available: boolean }> => {
    const { isTenantSlugAvailable } = await import("@/server/services/tenants");
    const { requireRequestSession, assertTenant } = await sessionHelpers();
    const session = await requireRequestSession();
    if (data.tenantId) {
      assertTenant(session, data.tenantId);
    }
    const available = await isTenantSlugAvailable(data.slug, data.tenantId);
    return { available };
  });

// ---------------------------------------------------------------------------
// Indonesia wilayah (public — used on register before auth)
// ---------------------------------------------------------------------------

export const neonFetchIndonesiaWilayah = createServerFn({ method: "POST" })
  .validator((data: { path: string }) => data)
  .handler(async ({ data }): Promise<{ code: string; name: string }[]> => {
    const { fetchWilayahFromApi } = await import("@/server/services/indonesia-wilayah");
    return fetchWilayahFromApi(data.path);
  });

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

export const neonGetBranches = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string }) => data)
  .handler(async ({ data }): Promise<Branch[]> => {
    const { listBranches } = await import("@/server/services/branches");
    const { assertTenant, requireRequestSession } = await sessionHelpers();
    const session = await requireRequestSession();
    assertTenant(session, data.tenantId);
    return listBranches(data.tenantId);
  });

export const neonGetActiveBranches = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string }) => data)
  .handler(async ({ data }): Promise<Branch[]> => {
    const { listBranches } = await import("@/server/services/branches");
    const { assertTenant, requireRequestSession } = await sessionHelpers();
    const session = await requireRequestSession();
    assertTenant(session, data.tenantId);
    return listBranches(data.tenantId, true);
  });

export const neonGetBranchesWithManager = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string }) => data)
  .handler(async ({ data }): Promise<BranchWithManager[]> => {
    const { listBranchesWithManager } = await import("@/server/services/branches");
    const { assertTenant, requireRequestSession } = await sessionHelpers();
    const session = await requireRequestSession();
    assertTenant(session, data.tenantId);
    return listBranchesWithManager(data.tenantId);
  });

export const neonGetBranch = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; branchId: string }) => data)
  .handler(async ({ data }): Promise<Branch> => {
    const { getBranch } = await import("@/server/services/branches");
    const { assertTenant, requireRequestSession } = await sessionHelpers();
    const session = await requireRequestSession();
    assertTenant(session, data.tenantId);
    const branch = await getBranch(data.tenantId, data.branchId);
    if (!branch) throw new Error("Cabang tidak ditemukan");
    return branch;
  });

export const neonGetUserBranches = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; userId: string }) => data)
  .handler(async ({ data }): Promise<Branch[]> => {
    const { listUserBranches } = await import("@/server/services/branches");
    const { assertTenant, requireRequestSession } = await sessionHelpers();
    const session = await requireRequestSession();
    assertTenant(session, data.tenantId);
    return listUserBranches(data.tenantId, data.userId);
  });

export const neonCreateBranch = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; payload: Omit<BranchInsert, "tenant_id"> }) => data)
  .handler(async ({ data }): Promise<Branch> => {
    const { createBranch } = await import("@/server/services/branches");
    const { assertTenantRoles, requireRequestSession } = await sessionHelpers();
    const session = await requireRequestSession();
    await assertTenantRoles(session, data.tenantId, ["owner"]);
    try {
      return await createBranch(data.tenantId, data.payload);
    } catch (err) {
      throw err instanceof Error ? err : new Error("Gagal membuat cabang");
    }
  });

export const neonFinalizeOnboardingPrimaryBranch = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; payload: Omit<BranchInsert, "tenant_id"> }) => data)
  .handler(async ({ data }): Promise<Branch> => {
    const { finalizeOnboardingPrimaryBranch } = await import("@/server/services/branches");
    const { assertTenant, requireRequestSession } = await sessionHelpers();
    const session = await requireRequestSession();
    assertTenant(session, data.tenantId);
    return finalizeOnboardingPrimaryBranch(data.tenantId, data.payload);
  });

export const neonUpdateBranch = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; branchId: string; updates: BranchUpdate }) => data)
  .handler(async ({ data }): Promise<Branch> => {
    const { updateBranch } = await import("@/server/services/branches");
    const { assertTenantRoles, requireRequestSession } = await sessionHelpers();
    const session = await requireRequestSession();
    await assertTenantRoles(session, data.tenantId, ["owner"]);
    const branch = await updateBranch(data.tenantId, data.branchId, data.updates);
    if (!branch) throw new Error("Cabang tidak ditemukan");
    return branch;
  });

export const neonGetBranchCloseBlockers = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; branchId: string }) => data)
  .handler(async ({ data }) => {
    const { getBranchCloseBlockers } = await import("@/server/services/branches");
    const { assertTenantRoles, requireRequestSession } = await sessionHelpers();
    const session = await requireRequestSession();
    await assertTenantRoles(session, data.tenantId, ["owner"]);
    return getBranchCloseBlockers(data.tenantId, data.branchId);
  });

export const neonForceCloseAllOpenCashierSessionsForBranch = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; branchId: string }) => data)
  .handler(async ({ data }) => {
    const { forceCloseAllOpenSessionsForBranch } = await import(
      "@/server/services/transactions"
    );
    const { assertTenantRoles, requireRequestSession } = await sessionHelpers();
    const session = await requireRequestSession();
    await assertTenantRoles(session, data.tenantId, ["owner"]);
    return forceCloseAllOpenSessionsForBranch(data.tenantId, data.branchId);
  });

export const neonAssignUserToBranch = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; userId: string; branchId: string }) => data)
  .handler(async ({ data }) => {
    const { assignUserToBranch } = await import("@/server/services/branches");
    const { assertTenant, requireRequestSession } = await sessionHelpers();
    const session = await requireRequestSession();
    assertTenant(session, data.tenantId);
    await assignUserToBranch(data.tenantId, data.userId, data.branchId);
    return null;
  });

export const neonRemoveUserFromBranch = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; userId: string; branchId: string }) => data)
  .handler(async ({ data }) => {
    const { removeUserFromBranch } = await import("@/server/services/branches");
    const { assertTenant, requireRequestSession } = await sessionHelpers();
    const session = await requireRequestSession();
    assertTenant(session, data.tenantId);
    await removeUserFromBranch(data.tenantId, data.userId, data.branchId);
    return null;
  });

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const neonListTenantUsers = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string }) => data)
  .handler(async ({ data }): Promise<TenantUserRecord[]> => {
    const { listTenantUsers } = await import("@/server/services/users");
    const { assertTenant, requireRequestSession } = await sessionHelpers();
    const session = await requireRequestSession();
    assertTenant(session, data.tenantId);
    return listTenantUsers(data.tenantId);
  });

export const neonCreateTenantUser = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; input: CreateTenantUserInput }) => data)
  .handler(async ({ data }): Promise<TenantUserRecord> => {
    const { createTenantUser } = await import("@/server/services/users");
    const { assertTenant, requireRequestSession } = await sessionHelpers();
    const session = await requireRequestSession();
    assertTenant(session, data.tenantId);
    return createTenantUser(data.tenantId, data.input);
  });

export const neonUpdateTenantUser = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; userId: string; input: UpdateTenantUserInput }) => data)
  .handler(async ({ data }): Promise<TenantUserRecord> => {
    const { updateTenantUser } = await import("@/server/services/users");
    const { assertTenant, requireRequestSession } = await sessionHelpers();
    const session = await requireRequestSession();
    assertTenant(session, data.tenantId);
    const user = await updateTenantUser(data.tenantId, data.userId, data.input);
    if (!user) throw new Error("Pegawai tidak ditemukan");
    return user;
  });

export const neonSetTenantUserActive = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; userId: string; isActive: boolean }) => data)
  .handler(async ({ data }): Promise<TenantUserRecord> => {
    const { setTenantUserActive } = await import("@/server/services/users");
    const { assertTenant, requireRequestSession } = await sessionHelpers();
    const session = await requireRequestSession();
    assertTenant(session, data.tenantId);
    const user = await setTenantUserActive(data.tenantId, data.userId, data.isActive);
    if (!user) throw new Error("Pegawai tidak ditemukan");
    return user;
  });

export const neonGetTenantPlanUsage = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string }) => data)
  .handler(async ({ data }) => {
    const { getTenantPlanUsage } = await import("@/server/services/plan-limits");
    const { assertTenant, requireRequestSession } = await sessionHelpers();
    const session = await requireRequestSession();
    assertTenant(session, data.tenantId);
    const usage = await getTenantPlanUsage(data.tenantId);
    if (!usage) throw new Error("Tenant tidak ditemukan");
    return usage;
  });

// ---------------------------------------------------------------------------
// Health (Phase 6 cutover)
// ---------------------------------------------------------------------------

export const neonHealthCheck = createServerFn({ method: "GET" }).handler(async () => {
  const { getEnvDiagnostics, getDatabaseUrl } = await import("@/server/env");
  const env = getEnvDiagnostics();

  if (!env.databaseConfigured) {
    return {
      ok: false as const,
      status: "env_missing" as const,
      message:
        "DATABASE_URL belum terbaca di runtime. Cek Railway Variables pada service yang benar, lalu Redeploy.",
      env,
      database: null,
    };
  }

  try {
    const { getHealthReport } = await import("@/server/services/health");
    const database = await getHealthReport();
    return {
      ok: database.ok as boolean,
      status: "ok" as const,
      message: "SEPS OK",
      env,
      database,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false as const,
      status: "db_error" as const,
      message,
      env: {
        ...env,
        databaseConfigured: Boolean(getDatabaseUrl()),
      },
      database: null,
    };
  }
});

// ---------------------------------------------------------------------------
// Registration (Phase 6+)
// ---------------------------------------------------------------------------

export const neonRegister = createServerFn({ method: "POST" })
  .validator((data: RegisterInput) => data)
  .handler(async ({ data }) => {
    const { assertAuthRateLimit } = await import("@/server/server-fn-rate-limit");
    await assertAuthRateLimit("register");
    const { registerWithEmail } = await import("@/server/services/register");
    return registerWithEmail(data);
  });

export const neonConfirmRegistration = createServerFn({ method: "POST" })
  .validator((data: { challengeId: string; otp: string }) => data)
  .handler(async ({ data }): Promise<AuthUser> => {
    const { assertAuthRateLimit } = await import("@/server/server-fn-rate-limit");
    await assertAuthRateLimit("register-verify");
    const { confirmRegistrationVerification } = await import(
      "@/server/services/registration-verify"
    );
    const { sessionCookieHeader } = await import("@/server/auth/session");
    const { setResponseHeader } = await import("@tanstack/react-start/server");

    const result = await confirmRegistrationVerification(data);
    setResponseHeader("Set-Cookie", sessionCookieHeader(result.token));
    return result.user;
  });

export const neonResendRegistrationOtp = createServerFn({ method: "POST" })
  .validator((data: { email: string }) => data)
  .handler(async ({ data }) => {
    const { assertAuthRateLimit } = await import("@/server/server-fn-rate-limit");
    await assertAuthRateLimit("register-resend");
    const { resendRegistrationVerificationOtp } = await import(
      "@/server/services/registration-verify"
    );
    return resendRegistrationVerificationOtp(data.email);
  });

export const neonSignInWithGoogle = createServerFn({ method: "POST" })
  .validator((data: { credential: string }) => data)
  .handler(async ({ data }): Promise<GoogleSignInResult> => {
    const { signInWithGoogleCredential } = await import("@/server/services/register");
    const { sessionCookieHeader } = await import("@/server/auth/session");
    const { setResponseHeader } = await import("@tanstack/react-start/server");

    const result = await signInWithGoogleCredential(data.credential);
    setResponseHeader("Set-Cookie", sessionCookieHeader(result.token));
    return { ...result.user, isNewUser: result.isNewUser };
  });

export const neonGoogleOAuthCallback = createServerFn({ method: "POST" })
  .validator((data: { code: string; redirectUri: string }) => data)
  .handler(async ({ data }): Promise<GoogleSignInResult> => {
    const { signInWithGoogleAuthCode } = await import("@/server/services/register");
    const { sessionCookieHeader } = await import("@/server/auth/session");
    const { setResponseHeader } = await import("@tanstack/react-start/server");

    const result = await signInWithGoogleAuthCode(data.code, data.redirectUri);
    setResponseHeader("Set-Cookie", sessionCookieHeader(result.token));
    return { ...result.user, isNewUser: result.isNewUser };
  });

export const neonGetModuleNavCounts = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; branchId: string }) => data)
  .handler(async ({ data }) => {
    const { assertTenant, requireRequestSession } = await sessionHelpers();
    const session = await requireRequestSession();
    assertTenant(session, data.tenantId);
    const { getModuleNavCountsReport } = await import("@/server/services/nav-counts");
    return getModuleNavCountsReport(data.tenantId, data.branchId);
  });
