// =============================================================================
// OTP delivery — email (Resend / SMTP Hostinger) + SMS/WA (Twilio / Fonnte)
// =============================================================================

import { readEnv } from "@/server/env";

export type OtpChannel = "email" | "sms";
export type OtpPurpose = "reset-pin" | "registration";

function isProduction(): boolean {
  return readEnv("NODE_ENV") === "production";
}

export function isOtpDevEchoEnabled(): boolean {
  return !isProduction();
}

function isSmtpConfigured(): boolean {
  return (
    Boolean(readEnv("SMTP_HOST")) &&
    Boolean(readEnv("SMTP_USER")) &&
    Boolean(readEnv("SMTP_PASS"))
  );
}

export function isEmailOtpConfigured(): boolean {
  return Boolean(readEnv("RESEND_API_KEY")) || isSmtpConfigured();
}

export function isSmsOtpConfigured(): boolean {
  const twilio =
    Boolean(readEnv("TWILIO_ACCOUNT_SID")) &&
    Boolean(readEnv("TWILIO_AUTH_TOKEN")) &&
    Boolean(readEnv("TWILIO_FROM"));
  return twilio || Boolean(readEnv("FONNTE_TOKEN"));
}

export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return trimmed;
  if (digits.startsWith("62") && digits.length >= 11) return digits;
  if (digits.startsWith("0") && digits.length >= 10) return `62${digits.slice(1)}`;
  if (digits.startsWith("8") && digits.length >= 9) return `62${digits}`;
  return digits;
}

export function phoneLookupVariants(raw: string): string[] {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  const variants = new Set<string>([trimmed]);
  if (digits) variants.add(digits);
  if (digits.startsWith("0") && digits.length >= 10) {
    variants.add(`62${digits.slice(1)}`);
    variants.add(`+62${digits.slice(1)}`);
  }
  if (digits.startsWith("62") && digits.length >= 11) {
    variants.add(`0${digits.slice(2)}`);
    variants.add(`+${digits}`);
  }
  if (digits.startsWith("8") && digits.length >= 9) {
    variants.add(`0${digits}`);
    variants.add(`62${digits}`);
  }
  return [...variants].filter(Boolean);
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  const visible = local.slice(0, 1);
  return `${visible}***@${domain}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `****${digits.slice(-4)}`;
}

function otpEmailContent(purpose: OtpPurpose, code: string): { subject: string; text: string } {
  if (purpose === "registration") {
    return {
      subject: "Kode verifikasi email SEPS",
      text: `Kode verifikasi email SEPS Anda: ${code}\nBerlaku 10 menit. Masukkan kode ini untuk mengaktifkan akun Anda.\nJangan bagikan ke siapa pun.`,
    };
  }
  return {
    subject: "Kode reset PIN SEPS",
    text: `Kode OTP SEPS Anda: ${code}\nBerlaku 10 menit. Jangan bagikan ke siapa pun.`,
  };
}

function defaultFromEmail(): string {
  return (
    readEnv("SMTP_FROM") ??
    readEnv("RESEND_FROM_EMAIL") ??
    "SEPS <seps@fazagroup.id>"
  );
}

async function sendResendEmail(to: string, code: string, purpose: OtpPurpose): Promise<void> {
  const apiKey = readEnv("RESEND_API_KEY");
  if (!apiKey) throw new Error("RESEND_API_KEY belum diset");

  const from = defaultFromEmail();
  const { subject, text } = otpEmailContent(purpose, code);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gagal mengirim email OTP (${res.status})${body ? `: ${body.slice(0, 180)}` : ""}`);
  }
}

async function sendSmtpEmail(to: string, code: string, purpose: OtpPurpose): Promise<void> {
  const host = readEnv("SMTP_HOST");
  const user = readEnv("SMTP_USER");
  const pass = readEnv("SMTP_PASS");
  if (!host || !user || !pass) throw new Error("SMTP belum lengkap (SMTP_HOST, SMTP_USER, SMTP_PASS)");

  const port = Number(readEnv("SMTP_PORT") ?? "465");
  const secure = readEnv("SMTP_SECURE") !== "false";
  const from = defaultFromEmail();
  const { subject, text } = otpEmailContent(purpose, code);

  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  await transport.sendMail({ from, to, subject, text });
}

async function sendTwilioSms(toE164: string, code: string): Promise<void> {
  const sid = readEnv("TWILIO_ACCOUNT_SID");
  const token = readEnv("TWILIO_AUTH_TOKEN");
  const from = readEnv("TWILIO_FROM");
  if (!sid || !token || !from) throw new Error("Twilio belum lengkap");

  const to = toE164.startsWith("+") ? toE164 : `+${toE164}`;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const body = new URLSearchParams({
    To: to,
    From: from,
    Body: `SEPS: kode OTP reset PIN Anda ${code}. Berlaku 10 menit.`,
  });

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gagal mengirim SMS (${res.status})${text ? `: ${text.slice(0, 180)}` : ""}`);
  }
}

async function sendFonnte(toDigits: string, code: string): Promise<void> {
  const token = readEnv("FONNTE_TOKEN");
  if (!token) throw new Error("FONNTE_TOKEN belum diset");

  const body = new URLSearchParams({
    target: toDigits,
    message: `SEPS: kode OTP reset PIN Anda ${code}. Berlaku 10 menit. Jangan bagikan ke siapa pun.`,
  });

  const res = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: {
      Authorization: token,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gagal mengirim OTP HP (${res.status})${text ? `: ${text.slice(0, 180)}` : ""}`);
  }
}

export async function deliverOtp(
  channel: OtpChannel,
  destination: string,
  code: string,
  purpose: OtpPurpose = "reset-pin",
): Promise<{ delivered: boolean; via: "email" | "sms" | "log" }> {
  if (channel === "email") {
    if (readEnv("RESEND_API_KEY")) {
      await sendResendEmail(destination, code, purpose);
      return { delivered: true, via: "email" };
    }
    if (isSmtpConfigured()) {
      await sendSmtpEmail(destination, code, purpose);
      return { delivered: true, via: "email" };
    }
    if (isOtpDevEchoEnabled()) {
      console.info(`[SEPS OTP] email ${destination} → ${code} (${purpose})`);
      return { delivered: false, via: "log" };
    }
    throw new Error(
      "Pengiriman email belum dikonfigurasi. Set RESEND_API_KEY atau SMTP_HOST/SMTP_USER/SMTP_PASS di server.",
    );
  }

  const phone = normalizePhone(destination);
  if (readEnv("TWILIO_ACCOUNT_SID") && readEnv("TWILIO_AUTH_TOKEN") && readEnv("TWILIO_FROM")) {
    await sendTwilioSms(phone, code);
    return { delivered: true, via: "sms" };
  }
  if (readEnv("FONNTE_TOKEN")) {
    await sendFonnte(phone, code);
    return { delivered: true, via: "sms" };
  }
  if (isOtpDevEchoEnabled()) {
    console.info(`[SEPS OTP] sms ${phone} → ${code}`);
    return { delivered: false, via: "log" };
  }
  throw new Error("Pengiriman SMS belum dikonfigurasi. Set Twilio atau FONNTE_TOKEN di server.");
}
