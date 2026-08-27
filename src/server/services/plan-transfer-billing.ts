// =============================================================================
// Plan billing — transfer BCA + OCR/B matching + review queue
// =============================================================================

import { and, desc, eq, inArray } from "drizzle-orm";
import {
  getPlanCheckoutAmount,
  getPlanPeriodDays,
  isPaidPlan,
  type BillingCycle,
  type PaidTenantPlan,
} from "@/lib/plan-config";
import {
  makePaymentReference,
  makeUniquePayAmount,
} from "@/lib/plan-transfer-utils";
import { getWriteDb } from "@/server/db";
import { ensurePlanBillingSchema } from "@/server/db/ensure-plan-billing-schema";
import { planInvoices, tenants } from "@/server/db/schema";
import { readEnv } from "@/server/env";
import {
  bcaMutasiMatchesInvoice,
  parseBcaMutasiEmail,
  type BcaMutasiParseResult,
} from "@/server/services/bca-email-parser";
import {
  getPlanBankTransferConfig,
  notifyPlanActivated,
} from "@/server/services/plan-activation-notify";
import {
  ocrPaymentProofImage,
  ocrProofMatchesInvoice,
  type OcrProofResult,
} from "@/server/services/payment-proof-ocr";
import { sendPlanOpsTelegram } from "@/server/services/plan-ops-alert";
import { activatePaidPlanRecord } from "@/server/services/plan-billing-core";

const TRANSFER_EXPIRY_HOURS = 48;
const MAX_PROOF_BYTES = 4 * 1024 * 1024;

export interface PlanTransferCheckoutResult {
  orderId: string;
  amount: number;
  payAmount: number;
  paymentReference: string;
  plan: PaidTenantPlan;
  billingCycle: BillingCycle;
  bankName: string;
  accountNumber: string;
  accountName: string;
  qrisHint: string | null;
  expiresAt: string;
}

export interface PlanInvoiceReviewRow {
  orderId: string;
  tenantId: string;
  tenantName: string;
  plan: string;
  billingCycle: BillingCycle;
  payAmount: number;
  paymentReference: string;
  status: string;
  verificationStatus: string;
  createdAt: string;
  matchDetails: Record<string, unknown> | null;
  hasProof: boolean;
}

function makeOrderId(tenantId: string, plan: string, cycle: string): string {
  const short = tenantId.replace(/-/g, "").slice(0, 8);
  const rand = Math.random().toString(36).slice(2, 8);
  return `seps-${short}-${plan}-${cycle}-${Date.now()}-${rand}`.slice(0, 50);
}

function addHours(from: Date, hours: number): Date {
  return new Date(from.getTime() + hours * 60 * 60 * 1000);
}

type MatchDetails = {
  bca?: BcaMutasiParseResult & { perfect?: boolean; amountMatch?: boolean; referenceMatch?: boolean };
  ocr?: OcrProofResult & { perfect?: boolean; amountMatch?: boolean; referenceMatch?: boolean };
  lastCheckedAt?: string;
  autoActivated?: boolean;
};

async function getPendingTransferInvoice(orderId: string) {
  const db = getWriteDb();
  return db.query.planInvoices.findFirst({
    where: and(
      eq(planInvoices.midtransOrderId, orderId),
      eq(planInvoices.paymentMethod, "bank_transfer"),
    ),
  });
}

export async function createPlanTransferCheckout(input: {
  tenantId: string;
  plan: string;
  billingCycle?: BillingCycle;
}): Promise<PlanTransferCheckoutResult> {
  await ensurePlanBillingSchema();

  if (!isPaidPlan(input.plan)) {
    throw new Error("Paket tidak valid untuk checkout (pilih Basic, Pro, atau Enterprise)");
  }
  const plan = input.plan;
  const billingCycle: BillingCycle = input.billingCycle === "yearly" ? "yearly" : "monthly";
  const { getEffectivePlanPricing } = await import("@/server/services/platform-finance");
  const pricingMap = await getEffectivePlanPricing();
  const amount = getPlanCheckoutAmount(plan, billingCycle, pricingMap);

  const bank = getPlanBankTransferConfig();
  if (!bank.accountNumber.trim()) {
    throw new Error(
      "Transfer bank belum dikonfigurasi (set PLAN_BCA_ACCOUNT_NUMBER di server)",
    );
  }

  const db = getWriteDb();
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, input.tenantId),
  });
  if (!tenant) throw new Error("Tenant tidak ditemukan");
  if (!tenant.isActive) throw new Error("Tenant nonaktif");

  const orderId = makeOrderId(tenant.id, plan, billingCycle);
  const payAmount = makeUniquePayAmount(amount, orderId);
  const paymentReference = makePaymentReference(orderId);
  const now = new Date();
  const expiresAt = addHours(now, TRANSFER_EXPIRY_HOURS);

  await db.insert(planInvoices).values({
    tenantId: tenant.id,
    amount,
    payAmount,
    plan,
    billingCycle,
    status: "pending",
    paymentMethod: "bank_transfer",
    paymentReference,
    verificationStatus: "awaiting_payment",
    midtransOrderId: orderId,
    expiresAt,
    matchDetails: null,
    proofPayload: null,
    rawPayload: null,
    createdAt: now,
    updatedAt: now,
  });

  return {
    orderId,
    amount,
    payAmount,
    paymentReference,
    plan,
    billingCycle,
    bankName: bank.bankName,
    accountNumber: bank.accountNumber,
    accountName: bank.accountName,
    qrisHint: bank.qrisHint,
    expiresAt: expiresAt.toISOString(),
  };
}

async function tryAutoActivateOrReview(orderId: string): Promise<{
  action: "activated" | "review" | "pending" | "already_paid";
}> {
  const db = getWriteDb();
  const invoice = await getPendingTransferInvoice(orderId);
  if (!invoice) return { action: "pending" };
  if (invoice.status === "paid") return { action: "already_paid" };
  if (invoice.status === "expired") return { action: "pending" };

  const payAmount = invoice.payAmount ?? invoice.amount;
  const paymentReference = invoice.paymentReference ?? makePaymentReference(orderId);
  const matchDetails = (invoice.matchDetails ?? {}) as MatchDetails;

  const bca = matchDetails.bca;
  const ocr = matchDetails.ocr;

  const bcaPerfect =
    Boolean(bca?.perfect) ||
    (bca?.amountMatch && bca?.referenceMatch && bca.amount === payAmount);
  const ocrPerfect =
    Boolean(ocr?.perfect) ||
    (ocr?.amountMatch && ocr?.referenceMatch && ocr.amount === payAmount);

  const now = new Date();

  if (bcaPerfect && ocrPerfect && isPaidPlan(invoice.plan)) {
    const periodEnd = new Date(now.getTime() + getPlanPeriodDays(invoice.billingCycle) * 86400000);
    await activatePaidPlanRecord({
      tenantId: invoice.tenantId,
      plan: invoice.plan,
      billingCycle: invoice.billingCycle,
      orderId,
      amount: invoice.amount,
      rawPayload: {
        transfer: true,
        matchDetails: { ...matchDetails, autoActivated: true, lastCheckedAt: now.toISOString() },
      },
    });

    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, invoice.tenantId),
    });
    if (tenant) {
      await notifyPlanActivated({
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        ownerEmail: tenant.ownerEmail,
        ownerPhone: tenant.phone,
        plan: invoice.plan,
        periodEnd,
      });
    }

    await sendPlanOpsTelegram(
      `[SEPS] Transfer auto-activated\nOrder: ${orderId}\nPlan: ${invoice.plan}\nNominal: ${payAmount}`,
    );

    return { action: "activated" };
  }

  const needsReview = bcaPerfect || ocrPerfect || Boolean(bca) || Boolean(ocr);
  if (needsReview && invoice.status !== "review") {
    await db
      .update(planInvoices)
      .set({
        status: "review",
        verificationStatus: bcaPerfect && !ocrPerfect ? "bca_only" : ocrPerfect && !bcaPerfect ? "ocr_only" : "partial",
        matchDetails: { ...matchDetails, lastCheckedAt: now.toISOString() },
        updatedAt: now,
      })
      .where(eq(planInvoices.midtransOrderId, orderId));

    await sendPlanOpsTelegram(
      `[SEPS] Transfer perlu review\nOrder: ${orderId}\nBCA: ${bcaPerfect ? "ok" : "?"}\nOCR: ${ocrPerfect ? "ok" : "?"}`,
    );
    return { action: "review" };
  }

  return { action: "pending" };
}

export async function submitPlanPaymentProof(input: {
  tenantId: string;
  orderId: string;
  imageBase64: string;
  mimeType: string;
}): Promise<{ action: string; ocr: OcrProofResult }> {
  await ensurePlanBillingSchema();

  if (input.imageBase64.length > MAX_PROOF_BYTES * 1.4) {
    throw new Error("Ukuran bukti terlalu besar (maks. 4 MB)");
  }

  const invoice = await getPendingTransferInvoice(input.orderId);
  if (!invoice) throw new Error("Invoice transfer tidak ditemukan");
  if (invoice.tenantId !== input.tenantId) throw new Error("Invoice bukan milik toko ini");
  if (invoice.status === "paid") throw new Error("Invoice sudah lunas");
  if (invoice.expiresAt && invoice.expiresAt < new Date()) {
    throw new Error("Invoice sudah kedaluwarsa — buat checkout baru");
  }

  const payAmount = invoice.payAmount ?? invoice.amount;
  const paymentReference =
    invoice.paymentReference ?? makePaymentReference(input.orderId);

  const ocr = await ocrPaymentProofImage(input.imageBase64, input.mimeType);
  const ocrMatch = ocrProofMatchesInvoice({ ocr, payAmount, paymentReference });

  const db = getWriteDb();
  const prev = (invoice.matchDetails ?? {}) as MatchDetails;
  const matchDetails: MatchDetails = {
    ...prev,
    ocr: { ...ocr, ...ocrMatch },
    lastCheckedAt: new Date().toISOString(),
  };

  await db
    .update(planInvoices)
    .set({
      verificationStatus: "proof_submitted",
      proofPayload: {
        mimeType: input.mimeType,
        submittedAt: new Date().toISOString(),
        ocrSummary: {
          amount: ocr.amount,
          remark: ocr.remark,
          confidence: ocr.confidence,
        },
      },
      matchDetails,
      updatedAt: new Date(),
    })
    .where(eq(planInvoices.midtransOrderId, input.orderId));

  const result = await tryAutoActivateOrReview(input.orderId);
  return { action: result.action, ocr };
}

export async function ingestBcaMutasiNotification(input: {
  body: string;
  subject?: string;
  secret?: string;
}): Promise<{ matched: string[]; activated: string[]; review: string[] }> {
  await ensurePlanBillingSchema();

  const expected = readEnv("PLAN_BCA_WEBHOOK_SECRET");
  if (expected && input.secret !== expected) {
    throw new Error("Webhook secret tidak valid");
  }

  const parsed = parseBcaMutasiEmail(input.body, input.subject);
  if (parsed.amount == null) {
    return { matched: [], activated: [], review: [] };
  }

  const db = getWriteDb();
  const pending = await db.query.planInvoices.findMany({
    where: and(
      eq(planInvoices.paymentMethod, "bank_transfer"),
      inArray(planInvoices.status, ["pending", "review"]),
    ),
    orderBy: desc(planInvoices.createdAt),
    limit: 50,
  });

  const matched: string[] = [];
  const activated: string[] = [];
  const review: string[] = [];

  for (const invoice of pending) {
    const payAmount = invoice.payAmount ?? invoice.amount;
    if (payAmount !== parsed.amount) continue;

    const paymentReference =
      invoice.paymentReference ?? makePaymentReference(invoice.midtransOrderId);
    const bcaMatch = bcaMutasiMatchesInvoice({
      parsed,
      payAmount,
      paymentReference,
    });

    if (!bcaMatch.amountMatch) continue;

    matched.push(invoice.midtransOrderId);
    const prev = (invoice.matchDetails ?? {}) as MatchDetails;
    const matchDetails: MatchDetails = {
      ...prev,
      bca: { ...parsed, ...bcaMatch },
      lastCheckedAt: new Date().toISOString(),
    };

    await db
      .update(planInvoices)
      .set({ matchDetails, updatedAt: new Date() })
      .where(eq(planInvoices.midtransOrderId, invoice.midtransOrderId));

    const result = await tryAutoActivateOrReview(invoice.midtransOrderId);
    if (result.action === "activated") activated.push(invoice.midtransOrderId);
    else if (result.action === "review") review.push(invoice.midtransOrderId);
  }

  return { matched, activated, review };
}

export async function listPlanInvoicesForReview(): Promise<PlanInvoiceReviewRow[]> {
  await ensurePlanBillingSchema();
  const db = getWriteDb();
  const rows = await db.query.planInvoices.findMany({
    where: and(
      eq(planInvoices.paymentMethod, "bank_transfer"),
      inArray(planInvoices.status, ["pending", "review"]),
    ),
    orderBy: desc(planInvoices.createdAt),
    limit: 100,
  });

  const result: PlanInvoiceReviewRow[] = [];
  for (const row of rows) {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, row.tenantId),
    });
    result.push({
      orderId: row.midtransOrderId,
      tenantId: row.tenantId,
      tenantName: tenant?.name ?? row.tenantId,
      plan: row.plan,
      billingCycle: row.billingCycle,
      payAmount: row.payAmount ?? row.amount,
      paymentReference: row.paymentReference ?? makePaymentReference(row.midtransOrderId),
      status: row.status,
      verificationStatus: row.verificationStatus,
      createdAt: row.createdAt.toISOString(),
      matchDetails: (row.matchDetails as Record<string, unknown>) ?? null,
      hasProof: Boolean(row.proofPayload),
    });
  }
  return result;
}

export async function approvePlanTransferReview(orderId: string): Promise<{ tenantId: string; plan: string }> {
  await ensurePlanBillingSchema();
  const db = getWriteDb();
  const invoice = await getPendingTransferInvoice(orderId);
  if (!invoice) throw new Error("Invoice transfer tidak ditemukan");
  if (invoice.status === "paid") {
    return { tenantId: invoice.tenantId, plan: invoice.plan };
  }
  if (!isPaidPlan(invoice.plan)) throw new Error("Plan invoice invalid");

  const now = new Date();
  const periodEnd = new Date(now.getTime() + getPlanPeriodDays(invoice.billingCycle) * 86400000);

  await activatePaidPlanRecord({
    tenantId: invoice.tenantId,
    plan: invoice.plan,
    billingCycle: invoice.billingCycle,
    orderId: invoice.midtransOrderId,
    amount: invoice.amount,
    rawPayload: {
      manual_review: true,
      at: now.toISOString(),
      matchDetails: invoice.matchDetails,
    },
  });

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, invoice.tenantId),
  });
  if (tenant) {
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

export async function rejectPlanTransferReview(orderId: string, reason?: string): Promise<void> {
  await ensurePlanBillingSchema();
  const db = getWriteDb();
  const invoice = await getPendingTransferInvoice(orderId);
  if (!invoice) throw new Error("Invoice transfer tidak ditemukan");

  await db
    .update(planInvoices)
    .set({
      status: "failed",
      verificationStatus: "rejected",
      rawPayload: { rejected: true, reason: reason ?? null, at: new Date().toISOString() },
      updatedAt: new Date(),
    })
    .where(eq(planInvoices.midtransOrderId, orderId));
}

export async function getPlanTransferCheckoutStatus(input: {
  tenantId: string;
  orderId: string;
}): Promise<{
  status: string;
  verificationStatus: string;
  paid: boolean;
}> {
  await ensurePlanBillingSchema();
  const invoice = await getPendingTransferInvoice(input.orderId);
  if (!invoice || invoice.tenantId !== input.tenantId) {
    throw new Error("Invoice tidak ditemukan");
  }
  return {
    status: invoice.status,
    verificationStatus: invoice.verificationStatus,
    paid: invoice.status === "paid",
  };
}
