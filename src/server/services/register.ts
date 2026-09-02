// =============================================================================
// Registration service — email signup + Google OAuth (Neon)
// =============================================================================

import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { authUsers, branches, profiles, tenants, userBranches } from "@/server/db/schema";
import { verifyGoogleIdToken } from "@/server/auth/google";
import { hashPassword } from "@/server/auth/password";
import { createSessionToken } from "@/server/auth/session";
import { getUserBySession } from "@/server/services/auth";
import { PENDING_TENANT_DISPLAY_NAME } from "@/lib/tenant-placeholder";
import { formatIndonesiaAddress } from "@/lib/indonesia-wilayah";
import type { AuthUser, RegisterInput } from "@/types/app";

import { TRIAL_DAYS } from "@/lib/plan-config";
import {
  releaseInactiveTenantByEmail,
  releaseInactiveTenantByUsername,
} from "@/server/services/tenant-lifecycle";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "toko";
}

async function ensureUniqueSlug(base: string): Promise<string> {
  const db = getDb();
  let slug = slugify(base);
  let attempt = 0;

  while (attempt < 20) {
    const existing = await db.query.tenants.findFirst({ where: eq(tenants.slug, slug) });
    if (!existing) return slug;
    attempt += 1;
    slug = `${slugify(base).slice(0, 40)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  return `${slugify(base).slice(0, 32)}-${crypto.randomUUID().slice(0, 8)}`;
}

async function sessionForUserId(userId: string): Promise<{ user: AuthUser; token: string }> {
  const user = await getUserBySession(userId);
  if (!user) throw new Error("Gagal memuat profil pengguna");
  const token = await createSessionToken({
    sub: user.id,
    email: user.email,
    tenantId: user.tenantId,
  });
  return { user, token };
}

interface NewTenantBundle {
  tenantId: string;
  userId: string;
  branchId: string;
  username: string;
  email: string;
  ownerName: string;
  phone?: string | null;
  ownerAddress?: string | null;
  passwordHash: string;
  googleSub?: string | null;
  emailVerified?: boolean;
}

async function createTenantWithOwner(input: NewTenantBundle): Promise<{ user: AuthUser; token: string }> {
  const db = getDb();
  /** Slug dari username (unik) — nama toko sama boleh, diisi nanti di wizard setup. */
  const slug = await ensureUniqueSlug(input.username);
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  await db.transaction(async (tx) => {
    await tx.insert(tenants).values({
      id: input.tenantId,
      name: PENDING_TENANT_DISPLAY_NAME,
      slug,
      ownerEmail: input.email,
      phone: input.phone ?? null,
      plan: "trial",
      trialEndsAt,
      isActive: true,
      onboardingComplete: false,
      legacyModeActive: false,
    });

    await tx.insert(branches).values({
      id: input.branchId,
      tenantId: input.tenantId,
      code: "HQ",
      name: "Cabang Utama",
      address: input.ownerAddress ?? null,
      phone: input.phone ?? null,
      isActive: true,
    });

    await tx.insert(authUsers).values({
      id: input.userId,
      email: input.email,
      username: input.username,
      passwordHash: input.passwordHash,
      googleSub: input.googleSub ?? null,
      tenantId: input.tenantId,
      emailVerified: input.emailVerified ?? true,
      emailVerifiedAt: input.emailVerified === false ? null : new Date(),
    });

    await tx.insert(profiles).values({
      id: input.userId,
      tenantId: input.tenantId,
      name: input.ownerName.trim(),
      email: input.email,
      role: "owner",
      pin: null,
      isActive: true,
    });

    await tx.insert(userBranches).values({
      userId: input.userId,
      branchId: input.branchId,
      tenantId: input.tenantId,
    });
  });

  return sessionForUserId(input.userId);
}

export async function registerWithEmail(
  input: RegisterInput,
): Promise<import("@/server/services/registration-verify").RegistrationChallengeResult> {
  const { validateRegisterForm } = await import("@/lib/validation/register-form");
  const parsed = validateRegisterForm(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Data registrasi tidak valid");
  }

  const data = parsed.data;
  const username = data.username;
  const email = data.email;
  const password = data.password;

  const db = getDb();

  await releaseInactiveTenantByEmail(email);
  await releaseInactiveTenantByUsername(username);

  const existingUsername = await db.query.authUsers.findFirst({
    where: sql`lower(${authUsers.username}) = ${username}`,
  });
  if (existingUsername) throw new Error("Username sudah dipakai. Pilih username lain.");

  const existing = await db.query.authUsers.findFirst({ where: eq(authUsers.email, email) });
  if (existing) {
    if (!existing.emailVerified) {
      const { sendRegistrationVerificationOtp } = await import(
        "@/server/services/registration-verify"
      );
      return sendRegistrationVerificationOtp(existing.id);
    }
    throw new Error("Email sudah terdaftar. Silakan masuk.");
  }

  const passwordHash = await hashPassword(password);
  const ownerAddress = formatIndonesiaAddress({
    street: data.address.street,
    villageName: data.address.villageName,
    districtName: data.address.districtName,
    regencyName: data.address.regencyName,
    provinceName: data.address.provinceName,
  });

  const userId = crypto.randomUUID();
  await createTenantWithOwner({
    tenantId: crypto.randomUUID(),
    userId,
    branchId: crypto.randomUUID(),
    username,
    email,
    ownerName: data.name,
    phone: data.phone,
    ownerAddress,
    passwordHash,
    emailVerified: false,
  });

  const { sendRegistrationVerificationOtp } = await import("@/server/services/registration-verify");
  return sendRegistrationVerificationOtp(userId);
}

export async function signInWithGoogleCredential(
  credential: string,
): Promise<{ user: AuthUser; token: string; isNewUser: boolean }> {
  const google = await verifyGoogleIdToken(credential);
  return signInWithGoogleProfile(google);
}

export async function signInWithGoogleAuthCode(
  code: string,
  redirectUri: string,
): Promise<{ user: AuthUser; token: string; isNewUser: boolean }> {
  const { exchangeGoogleAuthCode } = await import("@/server/auth/google-oauth");
  const google = await exchangeGoogleAuthCode(code, redirectUri);
  return signInWithGoogleProfile(google);
}

async function signInWithGoogleProfile(
  google: Awaited<ReturnType<typeof verifyGoogleIdToken>>,
): Promise<{ user: AuthUser; token: string; isNewUser: boolean }> {
  const db = getDb();

  let authRow = await db.query.authUsers.findFirst({
    where: eq(authUsers.googleSub, google.sub),
  });

  if (!authRow) {
    authRow = await db.query.authUsers.findFirst({
      where: eq(authUsers.email, google.email),
    });

    if (authRow && !authRow.googleSub) {
      await db
        .update(authUsers)
        .set({ googleSub: google.sub })
        .where(eq(authUsers.id, authRow.id));
    }
  }

  if (authRow) {
    if (authRow.tenantId) {
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, authRow.tenantId),
      });
      if (tenant && !tenant.isActive) {
        await db.delete(tenants).where(eq(tenants.id, tenant.id));
        authRow = undefined;
      }
    }
  }

  if (authRow) {
    const profileRow = await db.query.profiles.findFirst({
      where: and(eq(profiles.id, authRow.id), eq(profiles.isActive, true)),
    });
    if (!profileRow) throw new Error("Akun tidak aktif");

    const session = await sessionForUserId(authRow.id);
    return { ...session, isNewUser: false };
  }

  const passwordHash = await hashPassword(crypto.randomUUID());
  const displayName = google.name?.trim() || google.email.split("@")[0];
  const googleUsername =
    google.email.split("@")[0]?.toLowerCase() || google.sub.slice(0, 12);

  const session = await createTenantWithOwner({
    tenantId: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    branchId: crypto.randomUUID(),
    username: googleUsername,
    email: google.email,
    ownerName: displayName,
    phone: null,
    passwordHash,
    googleSub: google.sub,
    emailVerified: google.emailVerified ?? true,
  });

  return { ...session, isNewUser: true };
}

export async function emailExists(email: string): Promise<boolean> {
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  const row = await db.query.authUsers.findFirst({
    where: eq(authUsers.email, normalized),
  });
  if (!row?.tenantId) return Boolean(row);

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, row.tenantId),
  });
  if (tenant && !tenant.isActive) return false;
  return Boolean(row);
}
