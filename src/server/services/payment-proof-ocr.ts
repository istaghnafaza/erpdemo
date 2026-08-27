// =============================================================================
// Payment proof OCR — Gemini Flash (bukti transfer / QRIS)
// =============================================================================

import { parseIdrAmount, referenceInText } from "@/lib/plan-transfer-utils";
import { readEnv } from "@/server/env";

export interface OcrProofResult {
  amount: number | null;
  remark: string | null;
  bank: string | null;
  recipient: string | null;
  transactionAt: string | null;
  confidence: "high" | "medium" | "low";
  rawText: string;
}

function getGeminiApiKey(): string | null {
  return readEnv("GEMINI_API_KEY") ?? null;
}

export function isGeminiOcrConfigured(): boolean {
  return Boolean(getGeminiApiKey());
}

export async function ocrPaymentProofImage(
  imageBase64: string,
  mimeType: string,
): Promise<OcrProofResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum di-set di server");
  }

  const clean = imageBase64.replace(/^data:[^;]+;base64,/, "");
  const model = readEnv("GEMINI_OCR_MODEL") ?? "gemini-2.0-flash";

  const prompt = `Anda membaca bukti transfer bank Indonesia atau screenshot pembayaran QRIS.
Ekstrak JSON saja (tanpa markdown):
{
  "amount": number atau null (nominal IDR bulat, tanpa desimal),
  "remark": string atau null (berita transfer / keterangan),
  "bank": string atau null,
  "recipient": string atau null (nama penerima/rekening),
  "transactionAt": string atau null,
  "confidence": "high" | "medium" | "low",
  "rawText": string (teks penting yang terbaca)
}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType || "image/jpeg",
                  data: clean,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini OCR gagal (${res.status})${errText ? `: ${errText.slice(0, 200)}` : ""}`);
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    parsed = {};
  }

  const amount = parseIdrAmount(parsed.amount as string | number | null);
  return {
    amount,
    remark: typeof parsed.remark === "string" ? parsed.remark : null,
    bank: typeof parsed.bank === "string" ? parsed.bank : null,
    recipient: typeof parsed.recipient === "string" ? parsed.recipient : null,
    transactionAt:
      typeof parsed.transactionAt === "string" ? parsed.transactionAt : null,
    confidence:
      parsed.confidence === "high" || parsed.confidence === "medium"
        ? parsed.confidence
        : "low",
    rawText: typeof parsed.rawText === "string" ? parsed.rawText : text.slice(0, 500),
  };
}

export function ocrProofMatchesInvoice(input: {
  ocr: OcrProofResult;
  payAmount: number;
  paymentReference: string;
}): { perfect: boolean; amountMatch: boolean; referenceMatch: boolean } {
  const amountMatch = input.ocr.amount === input.payAmount;
  const searchText = [
    input.ocr.remark,
    input.ocr.rawText,
    input.ocr.recipient,
  ]
    .filter(Boolean)
    .join(" ");
  const referenceMatch = referenceInText(input.paymentReference, searchText);
  const perfect =
    amountMatch &&
    referenceMatch &&
    (input.ocr.confidence === "high" || input.ocr.confidence === "medium");
  return { perfect, amountMatch, referenceMatch };
}
