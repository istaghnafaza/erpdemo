// =============================================================================
// Password / PIN reset via email or SMS OTP
// =============================================================================

import { randomInt } from "node:crypto";
import { and, eq, gt, isNull, inArray } from "drizzle-orm";
import { getDb } from "@/server/db";
import { authUsers, passwordResetOtps, profiles } from "@/server/db/schema";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { ensurePasswordResetSchema } from "@/server/db/ensure-password-reset-schema";
import {
  deliverOtp,
  isOtpDevEchoEnabled,
  maskEmail,
  maskPhone,
  phoneLookupVariants,
  type OtpChannel,
} from "@/server/notify/otp-delivery";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

export type RequestResetResult = {
  challengeId: string;
  channel: OtpChannel;
  destinationHint: string;
  expiresInSec: number;
  debugOtp?: string;
};

const GENERIC_HINT = "akun Anda";

function looksLikeEmail(value: string): boolean {
  return value.includes("@");
}

function looksLikePhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 9 && /^\+?[0-9\s()-]+$/.test(value.trim());
}

async function findAuthUserByIdentifier(identifier: string) {
  const db = getDb();
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  if (looksLikeEmail(trimmed)) {
    return (
      (await db.query.authUsers.findFirst({
        where: eq(authUsers.email, trimmed.toLowerCase()),
      })) ?? null
    );
  }

  if (looksLikePhone(trimmed)) {
    const variants = phoneLookupVariants(trimmed);
    const profileRow = await db.query.profiles.findFirst({
      where: inArray(profiles.phone, variants),
    });
    if (profileRow) {
      return (
        (await db.query.authUsers.findFirst({
          where: eq(authUsers.id, profileRow.id),
        })) ?? null
      );
    }
  }

  return (
    (await db.query.authUsers.findFirst({
      where: eq(authUsers.username, trimmed),
    })) ?? null
  );
}

function fakeChallengeId(): string {
  return crypto.randomUUID();
}

export async function requestPasswordResetOtp(input: {
  identifier: string;
  channel: OtpChannel;
}): Promise<RequestResetResult> {
  await ensurePasswordResetSchema();

  const identifier = input.identifier.trim();
  const channel = input.channel;
  const user = await findAuthUserByIdentifier(identifier);

  if (!user) {
    return {
      challengeId: fakeChallengeId(),
      channel,
      destinationHint: looksLikeEmail(identifier)
        ? maskEmail(identifier.toLowerCase())
        : looksLikePhone(identifier)
          ? maskPhone(identifier)
          : GENERIC_HINT,
      expiresInSec: Math.floor(OTP_TTL_MS / 1000),
    };
  }

  const db = getDb();
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, user.id),
  });

  let destination: string;
  if (channel === "email") {
    destination = user.email;
  } else {
    const phone = profile?.phone?.trim();
    if (!phone) {
      throw new Error("Nomor HP belum terdaftar pada akun ini. Gunakan kirim ke email.");
    }
    destination = phone;
  }

  const recent = await db.query.passwordResetOtps.findFirst({
    where: and(
      eq(passwordResetOtps.userId, user.id),
      eq(passwordResetOtps.channel, channel),
      isNull(passwordResetOtps.consumedAt),
      gt(passwordResetOtps.createdAt, new Date(Date.now() - RESEND_COOLDOWN_MS)),
    ),
  });
  if (recent) {
    throw new Error("Kode baru saja dikirim. Tunggu sekitar 1 menit sebelum meminta ulang.");
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = await hashPassword(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  const [row] = await db
    .insert(passwordResetOtps)
    .values({
      userId: user.id,
      channel,
      codeHash,
      destination,
      expiresAt,
    })
    .returning({ id: passwordResetOtps.id });

  if (!row) throw new Error("Gagal membuat kode OTP");

  let sent: Awaited<ReturnType<typeof deliverOtp>>;
  try {
    sent = await deliverOtp(channel, destination, code);
  } catch (err) {
    await db.delete(passwordResetOtps).where(eq(passwordResetOtps.id, row.id));
    throw err;
  }
  const result: RequestResetResult = {
    challengeId: row.id,
    channel,
    destinationHint: channel === "email" ? maskEmail(destination) : maskPhone(destination),
    expiresInSec: Math.floor(OTP_TTL_MS / 1000),
  };

  if (isOtpDevEchoEnabled() && sent.via === "log") {
    result.debugOtp = code;
  }

  return result;
}

export async function confirmPasswordReset(input: {
  challengeId: string;
  otp: string;
  newPin: string;
}): Promise<void> {
  await ensurePasswordResetSchema();

  const otp = input.otp.trim();
  if (!/^\d{6}$/.test(otp)) {
    throw new Error("Kode OTP harus 6 digit angka");
  }
  if (!/^\d{6}$/.test(input.newPin)) {
    throw new Error("PIN baru harus 6 digit angka");
  }

  const db = getDb();
  const challenge = await db.query.passwordResetOtps.findFirst({
    where: eq(passwordResetOtps.id, input.challengeId),
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
      .update(passwordResetOtps)
      .set({ attemptCount: challenge.attemptCount + 1 })
      .where(eq(passwordResetOtps.id, challenge.id));
    throw new Error("Kode OTP salah");
  }

  const passwordHash = await hashPassword(input.newPin);
  const now = new Date();

  await db
    .update(authUsers)
    .set({ passwordHash, updatedAt: now })
    .where(eq(authUsers.id, challenge.userId));

  await db
    .update(profiles)
    .set({ pin: input.newPin, updatedAt: now })
    .where(eq(profiles.id, challenge.userId));

  await db
    .update(passwordResetOtps)
    .set({ consumedAt: now })
    .where(eq(passwordResetOtps.id, challenge.id));
}
