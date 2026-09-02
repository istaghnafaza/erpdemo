// =============================================================================
// Notifikasi aktivasi paket — email (Resend) + WA (Fonnte/Twilio)
// =============================================================================

import { PLAN_LIMITS } from "@/lib/plan-config";
import { normalizePhone } from "@/server/notify/otp-delivery";
import { readEnv } from "@/server/env";

async function sendActivationEmail(input: {
  to: string;
  tenantName: string;
  plan: string;
  periodEnd: Date;
  dashboardUrl: string;
}): Promise<boolean> {
  const apiKey = readEnv("RESEND_API_KEY");
  if (!apiKey) return false;

  const from = readEnv("RESEND_FROM_EMAIL") ?? "SEPS <noreply@fazagroup.id>";
  const planLabel = PLAN_LIMITS[input.plan as keyof typeof PLAN_LIMITS]?.label ?? input.plan;
  const end = input.periodEnd.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: `Paket ${planLabel} SEPS aktif — ${input.tenantName}`,
      text: `Halo,

Pembayaran paket ${planLabel} untuk ${input.tenantName} telah dikonfirmasi.

Akses dashboard: ${input.dashboardUrl}
Berlaku sampai: ${end}

Terima kasih menggunakan SEPS.`,
    }),
  });
  return res.ok;
}

async function sendActivationWa(input: {
  phone: string;
  tenantName: string;
  plan: string;
  dashboardUrl: string;
}): Promise<boolean> {
  const planLabel = PLAN_LIMITS[input.plan as keyof typeof PLAN_LIMITS]?.label ?? input.plan;
  const message = `SEPS: Paket ${planLabel} untuk ${input.tenantName} sudah aktif. Login: ${input.dashboardUrl}`;

  const fonnte = readEnv("FONNTE_TOKEN");
  if (fonnte) {
    const phone = normalizePhone(input.phone);
    const res = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { Authorization: fonnte },
      body: new URLSearchParams({ target: phone, message }),
    });
    return res.ok;
  }

  const sid = readEnv("TWILIO_ACCOUNT_SID");
  const token = readEnv("TWILIO_AUTH_TOKEN");
  const from = readEnv("TWILIO_FROM");
  if (sid && token && from) {
    const phone = normalizePhone(input.phone);
    const to = phone.startsWith("+") ? phone : `+${phone}`;
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: message }),
    });
    return res.ok;
  }

  return false;
}

export async function notifyPlanActivated(input: {
  tenantName: string;
  tenantSlug: string;
  ownerEmail: string;
  ownerPhone: string | null;
  plan: string;
  periodEnd: Date;
}): Promise<{ email: boolean; wa: boolean }> {
  const base =
    readEnv("AUTH_URL")?.replace(/\/$/, "") ??
    readEnv("VITE_PUBLIC_APP_URL")?.replace(/\/$/, "") ??
    "";
  const dashboardUrl = base ? `${base}/${input.tenantSlug}/dashboard?plan_paid=1` : "/dashboard";

  const [email, wa] = await Promise.all([
    sendActivationEmail({
      to: input.ownerEmail,
      tenantName: input.tenantName,
      plan: input.plan,
      periodEnd: input.periodEnd,
      dashboardUrl,
    }),
    input.ownerPhone
      ? sendActivationWa({
          phone: input.ownerPhone,
          tenantName: input.tenantName,
          plan: input.plan,
          dashboardUrl,
        })
      : Promise.resolve(false),
  ]);

  if (!email && !wa && readEnv("NODE_ENV") !== "production") {
    console.info("[SEPS plan activated]", input.tenantName, input.plan, dashboardUrl);
  }

  return { email, wa };
}
