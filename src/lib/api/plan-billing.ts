import { neonCall } from "@/lib/api/backend";
import {
  neonApprovePlanTransferReview,
  neonCreatePlanCheckout,
  neonCreatePlanTransferCheckout,
  neonGetPlanTransferStatus,
  neonIngestBcaMutasiPaste,
  neonListPlanTransferReview,
  neonMarkPlanInvoicePaidManual,
  neonRejectPlanTransferReview,
  neonSubmitPlanPaymentProof,
} from "@/lib/api/neon/plan-billing-fns";
import type { BillingCycle } from "@/lib/plan-config";
import type { ApiResponse } from "@/types/app";

export interface PlanCheckoutSession {
  orderId: string;
  snapToken: string;
  clientKey: string;
  snapJsUrl: string;
  amount: number;
  plan: string;
  billingCycle: BillingCycle;
}

export interface PlanTransferCheckoutSession {
  orderId: string;
  amount: number;
  payAmount: number;
  paymentReference: string;
  plan: string;
  billingCycle: BillingCycle;
  bankName: string;
  accountNumber: string;
  accountName: string;
  qrisHint: string | null;
  expiresAt: string;
}

export interface PlanTransferReviewRow {
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

export async function createPlanCheckout(input: {
  tenantId: string;
  plan: string;
  billingCycle?: BillingCycle;
}): Promise<ApiResponse<PlanCheckoutSession>> {
  const result = await neonCall(() =>
    neonCreatePlanCheckout({
      data: {
        tenantId: input.tenantId,
        plan: input.plan,
        billingCycle: input.billingCycle,
      },
    }),
  );
  if (result.error) return { data: null, error: result.error };
  if (!result.data) return { data: null, error: "Gagal membuat checkout" };
  return { data: result.data, error: null };
}

export async function createPlanTransferCheckout(input: {
  tenantId: string;
  plan: string;
  billingCycle?: BillingCycle;
}): Promise<ApiResponse<PlanTransferCheckoutSession>> {
  const result = await neonCall(() =>
    neonCreatePlanTransferCheckout({
      data: {
        tenantId: input.tenantId,
        plan: input.plan,
        billingCycle: input.billingCycle,
      },
    }),
  );
  if (result.error) return { data: null, error: result.error };
  if (!result.data) return { data: null, error: "Gagal membuat invoice transfer" };
  return { data: result.data, error: null };
}

export async function submitPlanPaymentProof(input: {
  tenantId: string;
  orderId: string;
  imageBase64: string;
  mimeType: string;
}): Promise<ApiResponse<{ action: string }>> {
  const result = await neonCall(() =>
    neonSubmitPlanPaymentProof({ data: input }),
  );
  if (result.error) return { data: null, error: result.error };
  if (!result.data) return { data: null, error: "Gagal mengunggah bukti" };
  return { data: { action: result.data.action }, error: null };
}

export async function getPlanTransferStatus(input: {
  tenantId: string;
  orderId: string;
}): Promise<ApiResponse<{ status: string; verificationStatus: string; paid: boolean }>> {
  const result = await neonCall(() => neonGetPlanTransferStatus({ data: input }));
  if (result.error) return { data: null, error: result.error };
  if (!result.data) return { data: null, error: "Status tidak ditemukan" };
  return { data: result.data, error: null };
}

export async function listPlanTransferReview(): Promise<ApiResponse<PlanTransferReviewRow[]>> {
  const result = await neonCall(() => neonListPlanTransferReview());
  if (result.error) return { data: null, error: result.error };
  return { data: result.data ?? [], error: null };
}

export async function approvePlanTransferReview(
  orderId: string,
): Promise<ApiResponse<{ tenantId: string; plan: string }>> {
  const result = await neonCall(() => neonApprovePlanTransferReview({ data: { orderId } }));
  if (result.error) return { data: null, error: result.error };
  if (!result.data) return { data: null, error: "Gagal menyetujui" };
  return { data: result.data, error: null };
}

export async function rejectPlanTransferReview(
  orderId: string,
  reason?: string,
): Promise<ApiResponse<{ ok: boolean }>> {
  const result = await neonCall(() =>
    neonRejectPlanTransferReview({ data: { orderId, reason } }),
  );
  if (result.error) return { data: null, error: result.error };
  return { data: { ok: true }, error: null };
}

export async function ingestBcaMutasiPaste(input: {
  body: string;
  subject?: string;
}): Promise<
  ApiResponse<{ matched: string[]; activated: string[]; review: string[] }>
> {
  const result = await neonCall(() => neonIngestBcaMutasiPaste({ data: input }));
  if (result.error) return { data: null, error: result.error };
  if (!result.data) return { data: null, error: "Gagal memproses mutasi" };
  return { data: result.data, error: null };
}

export async function markPlanInvoicePaidManual(
  orderId: string,
): Promise<ApiResponse<{ tenantId: string; plan: string }>> {
  const result = await neonCall(() =>
    neonMarkPlanInvoicePaidManual({ data: { orderId } }),
  );
  if (result.error) return { data: null, error: result.error };
  if (!result.data) return { data: null, error: "Gagal menandai lunas" };
  return { data: result.data, error: null };
}

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        options?: {
          onSuccess?: (result: unknown) => void;
          onPending?: (result: unknown) => void;
          onError?: (result: unknown) => void;
          onClose?: () => void;
        },
      ) => void;
    };
  }
}

export function loadMidtransSnap(snapJsUrl: string, clientKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Browser only"));
  if (window.snap) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-seps-midtrans="1"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Gagal memuat Snap.js")));
      return;
    }

    const script = document.createElement("script");
    script.src = snapJsUrl;
    script.setAttribute("data-client-key", clientKey);
    script.setAttribute("data-seps-midtrans", "1");
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Gagal memuat Snap.js"));
    document.head.appendChild(script);
  });
}

export async function openPlanSnapCheckout(
  session: PlanCheckoutSession,
): Promise<"success" | "pending" | "error" | "closed"> {
  await loadMidtransSnap(session.snapJsUrl, session.clientKey);
  if (!window.snap) throw new Error("Midtrans Snap tidak tersedia");

  return new Promise((resolve) => {
    window.snap!.pay(session.snapToken, {
      onSuccess: () => resolve("success"),
      onPending: () => resolve("pending"),
      onError: () => resolve("error"),
      onClose: () => resolve("closed"),
    });
  });
}
