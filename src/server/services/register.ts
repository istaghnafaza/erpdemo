// =============================================================================
// Registration service — email signup + Google OAuth (Neon)
// =============================================================================

import { and, eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { authUsers, branches, profiles, tenants, userBranches } from "@/server/db/schema";
import { verifyGoogleIdToken } from "@/server/auth/google";
import { hashPassword } from "@/server/auth/password";
import { createSessionToken } from "@/server/auth/session";
import { getUserBySession } from "@/server/services/auth";
import type { AuthUser, RegisterInput } from "@/types/app";

const TRIAL_DAYS = 14;

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
  email: string;
  name: string;
  businessName: string;
  phone?: string | null;
  passwordHash: string;
  googleSub?: string | null;
}

async function createTenantWithOwner(input: NewTenantBundle): Promise<{ user: AuthUser; token: string }> {
  const db = getDb();
  const slug = await ensureUniqueSlug(input.businessName);
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  await db.transaction(async (tx) => {
    await tx.insert(tenants).values({
      id: input.tenantId,
      name: input.businessName.trim(),
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
      address: null,
      phone: input.phone ?? null,
      isActive: true,
    });

    await tx.insert(authUsers).values({
      id: input.userId,
      email: input.email,
      passwordHash: input.passwordHash,
      googleSub: input.googleSub ?? null,
      tenantId: input.tenantId,
    });

    await tx.insert(profiles).values({
      id: input.userId,
      tenantId: input.tenantId,
      name: input.name.trim(),
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
): Promise<{ user: AuthUser; token: string }> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!input.name.trim()) throw new Error("Nama lengkap wajib diisi");
  if (!input.businessName.trim()) throw new Error("Nama bisnis wajib diisi");
  if (!email.includes("@")) throw new Error("Format email tidak valid");
  if (password.length < 8) throw new Error("Password minimal 8 karakter");
  if (password !== input.confirmPassword) throw new Error("Konfirmasi password tidak cocok");

  const db = getDb();
  const existing = await db.query.authUsers.findFirst({ where: eq(authUsers.email, email) });
  if (existing) throw new Error("Email sudah terdaftar. Silakan masuk.");

  const passwordHash = await hashPassword(password);

  return createTenantWithOwner({
    tenantId: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    branchId: crypto.randomUUID(),
    email,
    name: input.name,
    businessName: input.businessName,
    phone: input.phone,
    passwordHash,
  });
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
    const profileRow = await db.query.profiles.findFirst({
      where: and(eq(profiles.id, authRow.id), eq(profiles.isActive, true)),
    });
    if (!profileRow) throw new Error("Akun tidak aktif");

    const session = await sessionForUserId(authRow.id);
    return { ...session, isNewUser: false };
  }

  const passwordHash = await hashPassword(crypto.randomUUID());
  const displayName = google.name?.trim() || google.email.split("@")[0];
  const businessName = `Toko ${displayName}`;

  const session = await createTenantWithOwner({
    tenantId: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    branchId: crypto.randomUUID(),
    email: google.email,
    name: displayName,
    businessName,
    phone: null,
    passwordHash,
    googleSub: google.sub,
  });

  return { ...session, isNewUser: true };
}

export async function emailExists(email: string): Promise<boolean> {
  const db = getDb();
  const row = await db.query.authUsers.findFirst({
    where: eq(authUsers.email, email.trim().toLowerCase()),
  });
  return Boolean(row);
}
