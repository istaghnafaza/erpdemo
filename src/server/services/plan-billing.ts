// =============================================================================
// Plan billing — Midtrans Snap checkout + webhook activation
// =============================================================================

import { and, eq, sql } from "drizzle-orm";
import {
  getPlanCheckoutAmount,
  getPlanPeriodDays,
  isPaidPlan,
  PLAN_LIMITS,
  type BillingCycle,
  type PaidTenantPlan,
} from "@/lib/plan-config";
import { getWriteDb } from "@/server/db";
import { ensurePlanBillingSchema } from "@/server/db/ensure-plan-billing-schema";
import { planInvoices, tenantSubscriptions, tenants } from "@/server/db/schema";
import { readEnv } from "@/server/env";
import {
  createMidtransSnapTransaction,
  getMidtransClientKey,
  getMidtransSnapJsUrl,
  isMidtransPaidStatus,
  mapMidtransFailureStatus,
  type MidtransNotificationBody,
  verifyMidtransSignature,
} from "@/server/services/midtrans";
import { sendPlanOpsTelegram } from "@/server/services/plan-ops-alert";
import { activatePaidPlanRecord } from "@/server/services/plan-billing-core";
import { notifyPlanActivated } from "@/server/services/plan-activation-notify";

export interface PlanCheckoutResult {
  orderId: string;
  snapToken: string;
  clientKey: string;
  snapJsUrl: string;
  amount: number;
  plan: PaidTenantPlan;
  billingCycle: BillingCycle;
}

function makeOrderId(tenantId: string, plan: string, cycle: string): string {
  const short = tenantId.replace(/-/g, "").slice(0, 8);
  const rand = Math.random().toString(36).slice(2, 8);
  return `seps-${short}-${plan}-${cycle}-${Date.now()}-${rand}`.slice(0, 50);
}

function addDays(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export async function createPlanCheckout(input: {
  tenantId: string;
  plan: string;
  billingCycle?: BillingCycle;
}): Promise<PlanCheckoutResult> {
  await ensurePlanBillingSchema();

  if (!isPaidPlan(input.plan)) {
    throw new Error("Paket tidak valid untuk checkout (pilih Basic, Pro, atau Enterprise)");
  }
  const plan = input.plan;
  const billingCycle: BillingCycle = input.billingCycle === "yearly" ? "yearly" : "monthly";
  const { getEffectivePlanPricing } = await import("@/server/services/platform-finance");
  const pricingMap = await getEffectivePlanPricing();
  const amount = getPlanCheckoutAmount(plan, billingCycle, pricingMap);

  const db = getWriteDb();
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, input.tenantId),
  });
  if (!tenant) throw new Error("Tenant tidak ditemukan");
  if (!tenant.isActive) throw new Error("Tenant nonaktif");

  const orderId = makeOrderId(tenant.id, plan, billingCycle);
  const itemName = `SEPS ${PLAN_LIMITS[plan].label} (${billingCycle === "yearly" ? "tahunan" : "bulanan"})`;

  const authUrl = readEnv("AUTH_URL") || readEnv("VITE_PUBLIC_APP_URL") || "";
  const finishRedirectUrl = authUrl
    ? `${authUrl.replace(/\/$/, "")}/${tenant.slug}/dashboard?plan_paid=1`
    : null;

  const snap = await createMidtransSnapTransaction({
    orderId,
    grossAmount: amount,
    itemName,
    customerName: tenant.name,
    customerEmail: tenant.ownerEmail,
    customerPhone: tenant.phone,
    finishRedirectUrl,
  });

  const now = new Date();
  await db.insert(planInvoices).values({
    tenantId: tenant.id,
    amount,
    plan,
    billingCycle,
    status: "pending",
    midtransOrderId: orderId,
    rawPayload: null,
    createdAt: now,
    updatedAt: now,
  });

  return {
    orderId,
    snapToken: snap.token,
    clientKey: getMidtransClientKey(),
    snapJsUrl: getMidtransSnapJsUrl(),
    amount,
    plan,
    billingCycle,
  };
}

async function activatePaidPlan(params: {
  tenantId: string;
  plan: PaidTenantPlan;
  billingCycle: BillingCycle;
  orderId: string;
  amount: number;
  rawPayload: unknown;
}): Promise<void> {
  await activatePaidPlanRecord(params);
}

export async function handleMidtransNotification(
  body: MidtransNotificationBody,
): Promise<{ ok: boolean; action: string }> {
  await ensurePlanBillingSchema();

  const orderId = String(body.order_id ?? "");
  const statusCode = String(body.status_code ?? "");
  const grossAmount = String(body.gross_amount ?? "");
  const signatureKey = String(body.signature_key ?? "");

  if (!orderId || !statusCode || !grossAmount || !signatureKey) {
    throw new Error("Payload Midtrans tidak lengkap");
  }

  if (
    !verifyMidtransSignature({
      orderId,
      statusCode,
      grossAmount,
      signatureKey,
    })
  ) {
    throw new Error("Signature Midtrans tidak valid");
  }

  const db = getWriteDb();
  const invoice = await db.query.planInvoices.findFirst({
    where: eq(planInvoices.midtransOrderId, orderId),
  });
  if (!invoice) {
    return { ok: true, action: "ignored_unknown_order" };
  }

  // Idempotent: already paid
  if (invoice.status === "paid") {
    return { ok: true, action: "already_paid" };
  }

  const txStatus = String(body.transaction_status ?? "");
  const fraudStatus = body.fraud_status != null ? String(body.fraud_status) : undefined;

  if (isMidtransPaidStatus(txStatus, fraudStatus)) {
    if (!isPaidPlan(invoice.plan)) {
      throw new Error("Invoice plan invalid");
    }
    await activatePaidPlan({
      tenantId: invoice.tenantId,
      plan: invoice.plan,
      billingCycle: invoice.billingCycle,
      orderId,
      amount: invoice.amount,
      rawPayload: body,
    });
    return { ok: true, action: "activated" };
  }

  const mapped = mapMidtransFailureStatus(txStatus);
  if (mapped === "pending") {
    await db
      .update(planInvoices)
      .set({
        rawPayload: body as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(planInvoices.midtransOrderId, orderId));
    return { ok: true, action: "pending" };
  }

  const now = new Date();
  await db
    .update(planInvoices)
    .set({
      status: mapped,
      rawPayload: body as Record<string, unknown>,
      updatedAt: now,
    })
    .where(eq(planInvoices.midtransOrderId, orderId));

  await db
    .update(tenantSubscriptions)
    .set({ status: "past_due", updatedAt: now })
    .where(
      and(
        eq(tenantSubscriptions.tenantId, invoice.tenantId),
        sql`${tenantSubscriptions.status} IN ('active', 'trialing', 'past_due')`,
      ),
    );

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, invoice.tenantId),
  });
  await sendPlanOpsTelegram(
    `[SEPS] Invoice ${mapped}\nToko: ${tenant?.name ?? invoice.tenantId}\nPlan: ${invoice.plan}\nOrder: ${orderId}\nStatus Midtrans: ${txStatus}`,
  );

  return { ok: true, action: mapped };
}

/** Platform admin: tandai lunas manual (transfer di luar Snap). */
export async function markPlanInvoicePaidManual(input: {
  orderId: string;
}): Promise<{ tenantId: string; plan: string }> {
  await ensurePlanBillingSchema();
  const db = getWriteDb();
  const invoice = await db.query.planInvoices.findFirst({
    where: eq(planInvoices.midtransOrderId, input.orderId),
  });
  if (!invoice) throw new Error("Invoice tidak ditemukan");
  if (invoice.status === "paid") {
    return { tenantId: invoice.tenantId, plan: invoice.plan };
  }
  if (!isPaidPlan(invoice.plan)) throw new Error("Plan invoice invalid");

  await activatePaidPlan({
    tenantId: invoice.tenantId,
    plan: invoice.plan,
    billingCycle: invoice.billingCycle,
    orderId: invoice.midtransOrderId,
    amount: invoice.amount,
    rawPayload: { manual: true, at: new Date().toISOString() },
  });

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, invoice.tenantId),
  });
  if (tenant && isPaidPlan(invoice.plan)) {
    const periodEnd = addDays(new Date(), getPlanPeriodDays(invoice.billingCycle));
    await notifyPlanActivated({
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      ownerEmail: tenant.ownerEmail,
      ownerPhone: tenant.phone,
      plan: invoice.plan,
      periodEnd,
    });
  }

  return { tenantId: invoice.tenantId, plan: invoice.plan };
}

export interface RenewCheckResult {
  trialsExpiringSoon: number;
  subscriptionsPastDue: number;
  renewalsDueSoon: number;
  alertsSent: number;
}

/** Daily job: past_due + reminder Telegram (trial/renew ≤2 hari). */
export async function runPlanRenewCheck(): Promise<RenewCheckResult> {
  await ensurePlanBillingSchema();
  const db = getWriteDb();
  const now = new Date();
  let alertsSent = 0;

  // Mark active subs past period end as past_due
  const pastDueUpdate = await db.execute<{ id: string }>(sql`
    UPDATE tenant_subscriptions
    SET status = 'past_due', updated_at = ${now}
    WHERE status = 'active'
      AND current_period_end IS NOT NULL
      AND current_period_end < ${now}
    RETURNING id
  `);
  const pastDueRows = Array.isArray(pastDueUpdate)
    ? pastDueUpdate
    : ((pastDueUpdate as { rows?: { id: string }[] }).rows ?? []);
  const subscriptionsPastDue = pastDueRows.length;

  // Trials ending in ≤2 days (still trial plan)
  const trialsSoon = await db.execute<{
    id: string;
    name: string;
    trial_ends_at: Date | string;
  }>(sql`
    SELECT id, name, trial_ends_at
    FROM tenants
    WHERE plan = 'trial'
      AND is_active = true
      AND trial_ends_at IS NOT NULL
      AND trial_ends_at >= ${now}
      AND trial_ends_at <= ${addDays(now, 2)}
  `);
  const trialRows = Array.isArray(trialsSoon)
    ? trialsSoon
    : ((trialsSoon as { rows?: { id: string; name: string; trial_ends_at: Date | string }[] })
        .rows ?? []);

  for (const row of trialRows) {
    const sent = await sendPlanOpsTelegram(
      `[SEPS] Trial hampir habis\nToko: ${row.name}\nHabis: ${String(row.trial_ends_at)}`,
    );
    if (sent) alertsSent += 1;
  }

  // Paid renewals due in ≤7 days
  const renewSoon = await db.execute<{
    tenant_id: string;
    name: string;
    plan: string;
    current_period_end: Date | string;
  }>(sql`
    SELECT s.tenant_id, t.name, s.plan::text AS plan, s.current_period_end
    FROM tenant_subscriptions s
    JOIN tenants t ON t.id = s.tenant_id
    WHERE s.status IN ('active', 'past_due')
      AND s.current_period_end IS NOT NULL
      AND s.current_period_end >= ${now}
      AND s.current_period_end <= ${addDays(now, 7)}
  `);
  const renewRows = Array.isArray(renewSoon)
    ? renewSoon
    : ((
        renewSoon as {
          rows?: {
            tenant_id: string;
            name: string;
            plan: string;
            current_period_end: Date | string;
          }[];
        }
      ).rows ?? []);

  for (const row of renewRows) {
    const sent = await sendPlanOpsTelegram(
      `[SEPS] Jatuh tempo ≤7 hari\nToko: ${row.name}\nPlan: ${row.plan}\nHabis: ${String(row.current_period_end)}`,
    );
    if (sent) alertsSent += 1;
  }

  if (subscriptionsPastDue > 0) {
    const sent = await sendPlanOpsTelegram(
      `[SEPS] Past due hari ini: ${subscriptionsPastDue} langganan (periode lewat tanpa bayar ulang).`,
    );
    if (sent) alertsSent += 1;
  }

  return {
    trialsExpiringSoon: trialRows.length,
    subscriptionsPastDue,
    renewalsDueSoon: renewRows.length,
    alertsSent,
  };
}
