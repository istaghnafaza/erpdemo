// =============================================================================
// Midtrans Snap — create charge + notification signature
// =============================================================================

import { createHash } from "node:crypto";
import { readEnv } from "@/server/env";

export function isMidtransProduction(): boolean {
  const raw = readEnv("MIDTRANS_IS_PRODUCTION")?.toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

export function getMidtransServerKey(): string {
  const key = readEnv("MIDTRANS_SERVER_KEY");
  if (!key) throw new Error("MIDTRANS_SERVER_KEY belum di-set");
  return key;
}

export function getMidtransClientKey(): string {
  const key = readEnv("MIDTRANS_CLIENT_KEY");
  if (!key) throw new Error("MIDTRANS_CLIENT_KEY belum di-set");
  return key;
}

export function getMidtransSnapJsUrl(): string {
  return isMidtransProduction()
    ? "https://app.midtrans.com/snap/snap.js"
    : "https://app.sandbox.midtrans.com/snap/snap.js";
}

function snapApiBase(): string {
  return isMidtransProduction()
    ? "https://app.midtrans.com"
    : "https://app.sandbox.midtrans.com";
}

function basicAuthHeader(serverKey: string): string {
  return `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`;
}

export interface MidtransSnapCreateInput {
  orderId: string;
  grossAmount: number;
  itemName: string;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  finishRedirectUrl?: string | null;
}

export interface MidtransSnapCreateResult {
  token: string;
  redirectUrl: string | null;
}

export async function createMidtransSnapTransaction(
  input: MidtransSnapCreateInput,
): Promise<MidtransSnapCreateResult> {
  const serverKey = getMidtransServerKey();
  const body: Record<string, unknown> = {
    transaction_details: {
      order_id: input.orderId,
      gross_amount: input.grossAmount,
    },
    item_details: [
      {
        id: "seps-plan",
        price: input.grossAmount,
        quantity: 1,
        name: input.itemName.slice(0, 50),
      },
    ],
    customer_details: {
      first_name: (input.customerName || "Owner SEPS").slice(0, 50),
      email: input.customerEmail || undefined,
      phone: input.customerPhone || undefined,
    },
  };

  if (input.finishRedirectUrl) {
    body.callbacks = { finish: input.finishRedirectUrl };
  }

  const res = await fetch(`${snapApiBase()}/snap/v1/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: basicAuthHeader(serverKey),
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => ({}))) as {
    token?: string;
    redirect_url?: string;
    error_messages?: string[];
    status_message?: string;
  };

  if (!res.ok || !json.token) {
    const detail =
      json.error_messages?.join("; ") ||
      json.status_message ||
      `HTTP ${res.status}`;
    throw new Error(`Midtrans Snap gagal: ${detail}`);
  }

  return {
    token: json.token,
    redirectUrl: json.redirect_url ?? null,
  };
}

/** Midtrans notification signature: SHA512(order_id + status_code + gross_amount + serverKey) */
export function verifyMidtransSignature(params: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
}): boolean {
  const serverKey = getMidtransServerKey();
  const payload = `${params.orderId}${params.statusCode}${params.grossAmount}${serverKey}`;
  const expected = createHash("sha512").update(payload).digest("hex");
  return expected === params.signatureKey;
}

export type MidtransNotificationBody = {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
  transaction_status?: string;
  fraud_status?: string;
  payment_type?: string;
  transaction_id?: string;
  [key: string]: unknown;
};

export function isMidtransPaidStatus(
  transactionStatus: string | undefined,
  fraudStatus: string | undefined,
): boolean {
  if (transactionStatus === "settlement") return true;
  if (transactionStatus === "capture" && (fraudStatus === "accept" || !fraudStatus)) {
    return true;
  }
  return false;
}

export function mapMidtransFailureStatus(
  transactionStatus: string | undefined,
): "failed" | "expired" | "pending" {
  if (transactionStatus === "expire") return "expired";
  if (
    transactionStatus === "deny" ||
    transactionStatus === "cancel" ||
    transactionStatus === "failure"
  ) {
    return "failed";
  }
  return "pending";
}
