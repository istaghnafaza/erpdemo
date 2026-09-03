// =============================================================================
// Email verification OTP — aktivasi akun setelah registrasi
// =============================================================================

import { randomInt } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/server/db";
import { authUsers, registrationVerificationOtps } from "@/server/db/schema";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSessionToken } from "@/server/auth/session";
import { getUserBySession } from "@/server/services/auth";
import { ensureRegistrationVerificationSchema } from "@/server/db/ensure-registration-verification-schema";
import {
  deliverOtp,
  isOtpDevEchoEnabled,
  maskEmail,
} from "@/server/notify/otp-delivery";
import type { AuthUser } from "@/types/app";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

export type RegistrationChallengeResult = {
  challengeId: string;
  destinationHint: string;
  expiresInSec: number;
  debugOtp?: string;
  otpDeliveryFailed?: boolean;
};

async function createAndSendOtp(userId: string, email: string): Promise<RegistrationChallengeResult> {
  const db = getDb();

  const recent = await db.query.registrationVerificationOtps.findFirst({
    where: and(
      eq(registrationVerificationOtps.userId, userId),
      isNull(registrationVerificationOtps.consumedAt),
      gt(registrationVerificationOtps.createdAt, new Date(Date.now() - RESEND_COOLDOWN_MS)),
    ),
  });
  if (recent) {
    throw new Error("Kode baru saja dikirim. Tunggu sekitar 1 menit sebelum meminta ulang.");
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = await hashPassword(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  const [row] = await db
    .insert(registrationVerificationOtps)
    .values({
      userId,
      codeHash,
      destination: email,
      expiresAt,
    })
    .returning({ id: registrationVerificationOtps.id });

  if (!row) throw new Error("Gagal membuat kode OTP");

  let sent: Awaited<ReturnType<typeof deliverOtp>> | null = null;
  let otpDeliveryFailed = false;
  try {
    sent = await deliverOtp("email", email, code, "registration");
  } catch (err) {
    otpDeliveryFailed = true;
    console.error("[SEPS OTP] registration email failed:", err);
  }

  const result: RegistrationChallengeResult = {
    challengeId: row.id,
    destinationHint: maskEmail(email),
    expiresInSec: Math.floor(OTP_TTL_MS / 1000),
    otpDeliveryFailed,
  };

  if (isOtpDevEchoEnabled() && sent?.via === "log") {
    result.debugOtp = code;
  }

  return result;
}

export async function sendRegistrationVerificationOtp(userId: string): Promise<RegistrationChallengeResult> {
  await ensureRegistrationVerificationSchema();

  const db = getDb();
  const user = await db.query.authUsers.findFirst({
    where: eq(authUsers.id, userId),
  });
  if (!user) throw new Error("Akun tidak ditemukan");
  if (user.emailVerified) throw new Error("Email sudah diverifikasi");

  return createAndSendOtp(user.id, user.email);
}

export async function resendRegistrationVerificationOtp(email: string): Promise<RegistrationChallengeResult> {
  await ensureRegistrationVerificationSchema();

  const normalized = email.trim().toLowerCase();
  const db = getDb();
  const user = await db.query.authUsers.findFirst({
    where: eq(authUsers.email, normalized),
  });

  if (!user || user.emailVerified) {
    return {
      challengeId: crypto.randomUUID(),
      destinationHint: maskEmail(normalized),
      expiresInSec: Math.floor(OTP_TTL_MS / 1000),
    };
  }

  return createAndSendOtp(user.id, user.email);
}

export async function confirmRegistrationVerification(input: {
  challengeId: string;
  otp: string;
}): Promise<{ user: AuthUser; token: string }> {
  await ensureRegistrationVerificationSchema();

  const otp = input.otp.trim();
  if (!/^\d{6}$/.test(otp)) {
    throw new Error("Kode OTP harus 6 digit angka");
  }

  const db = getDb();
  const challenge = await db.query.registrationVerificationOtps.findFirst({
    where: eq(registrationVerificationOtps.id, input.challengeId),
  });

  if (!challenge || challenge.consumedAt || challenge.expiresAt.getTime() < Date.now()) {
    throw new Error("Kode OTP tidak valid atau sudah kedaluwarsa");
  }

  if (challenge.attemptCount >= MAX_ATTEMPTS) {
    throw new Error("Terlalu banyak percobaan. Minta kode baru.");
  }

  const ok = await verifyPassword(otp, challenge.codeHash);
  if (!ok) {
    await db
      .update(registrationVerificationOtps)
      .set({ attemptCount: challenge.attemptCount + 1 })
      .where(eq(registrationVerificationOtps.id, challenge.id));
    throw new Error("Kode OTP salah");
  }

  const now = new Date();
  await db
    .update(authUsers)
    .set({ emailVerified: true, emailVerifiedAt: now, updatedAt: now })
    .where(eq(authUsers.id, challenge.userId));

  await db
    .update(registrationVerificationOtps)
    .set({ consumedAt: now })
    .where(eq(registrationVerificationOtps.id, challenge.id));

  const user = await getUserBySession(challenge.userId);
  if (!user) throw new Error("Gagal memuat profil pengguna");

  const token = await createSessionToken({
    sub: user.id,
    email: user.email,
    tenantId: user.tenantId,
  });

  return { user, token };
}
