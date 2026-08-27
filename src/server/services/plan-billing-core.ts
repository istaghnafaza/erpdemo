// =============================================================================
// Plan billing core — aktivasi paket (shared Midtrans + transfer)
// =============================================================================

import { eq } from "drizzle-orm";
import {
  getPlanPeriodDays,
  type BillingCycle,
  type PaidTenantPlan,
} from "@/lib/plan-config";
import { getWriteDb } from "@/server/db";
import { planInvoices, tenantSubscriptions, tenants } from "@/server/db/schema";

function addDays(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export async function activatePaidPlanRecord(params: {
  tenantId: string;
  plan: PaidTenantPlan;
  billingCycle: BillingCycle;
  orderId: string;
  amount: number;
  rawPayload: unknown;
}): Promise<void> {
  const db = getWriteDb();
  const now = new Date();
  const periodEnd = addDays(now, getPlanPeriodDays(params.billingCycle));

  await db
    .update(planInvoices)
    .set({
      status: "paid",
      paidAt: now,
      verificationStatus: "matched",
      rawPayload: params.rawPayload as Record<string, unknown>,
      updatedAt: now,
    })
    .where(eq(planInvoices.midtransOrderId, params.orderId));

  const existing = await db.query.tenantSubscriptions.findFirst({
    where: eq(tenantSubscriptions.tenantId, params.tenantId),
  });

  if (existing) {
    await db
      .update(tenantSubscriptions)
      .set({
        plan: params.plan,
        status: "active",
        billingCycle: params.billingCycle,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        midtransOrderId: params.orderId,
        updatedAt: now,
      })
      .where(eq(tenantSubscriptions.tenantId, params.tenantId));
  } else {
    await db.insert(tenantSubscriptions).values({
      tenantId: params.tenantId,
      plan: params.plan,
      status: "active",
      billingCycle: params.billingCycle,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      midtransOrderId: params.orderId,
      createdAt: now,
      updatedAt: now,
    });
  }

  await db
    .update(tenants)
    .set({
      plan: params.plan,
      planRenewsAt: periodEnd,
      trialEndsAt: null,
      updatedAt: now,
    })
    .where(eq(tenants.id, params.tenantId));
}
