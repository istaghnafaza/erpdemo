import { neonCall } from "@/lib/api/backend";
import {
  neonCreatePlanCheckout,
  neonMarkPlanInvoicePaidManual,
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
