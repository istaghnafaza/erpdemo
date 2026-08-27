// =============================================================================
// BCA mutasi email / notifikasi — parser untuk kredit masuk
// =============================================================================

import { parseIdrAmount, referenceInText } from "@/lib/plan-transfer-utils";

export interface BcaMutasiParseResult {
  amount: number | null;
  remark: string | null;
  sender: string | null;
  transactionAt: string | null;
  rawExcerpt: string;
}

/** Parse isi email/notifikasi BCA (KR/edc/transfer masuk). */
export function parseBcaMutasiEmail(body: string, subject?: string): BcaMutasiParseResult {
  const combined = `${subject ?? ""}\n${body}`.replace(/\r/g, "");
  const excerpt = combined.slice(0, 4000);

  // Nominal: Rp1.234.567,00 atau Rp 1234567
  let amount: number | null = null;
  const amountPatterns = [
    /Rp\s*([\d.,]+)/gi,
    /IDR\s*([\d.,]+)/gi,
    /(?:senilai|nominal|amount|jumlah)[:\s]*Rp?\s*([\d.,]+)/gi,
  ];
  for (const re of amountPatterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(combined)) !== null) {
      const parsed = parseIdrAmount(m[1]);
      if (parsed != null && parsed >= 10_000) {
        amount = parsed;
        break;
      }
    }
    if (amount != null) break;
  }

  // Berita / keterangan
  let remark: string | null = null;
  const remarkPatterns = [
    /berita[:\s]+(.+?)(?:\n|$)/i,
    /keterangan[:\s]+(.+?)(?:\n|$)/i,
    /remark[:\s]+(.+?)(?:\n|$)/i,
    /catatan[:\s]+(.+?)(?:\n|$)/i,
  ];
  for (const re of remarkPatterns) {
    const m = combined.match(re);
    if (m?.[1]?.trim()) {
      remark = m[1].trim().slice(0, 200);
      break;
    }
  }
  if (!remark) {
    const seps = combined.match(/(SEPS[-\w]+)/i);
    if (seps) remark = seps[1];
  }

  let sender: string | null = null;
  const senderMatch = combined.match(/(?:dari|from|pengirim)[:\s]+(.+?)(?:\n|$)/i);
  if (senderMatch?.[1]) sender = senderMatch[1].trim().slice(0, 120);

  let transactionAt: string | null = null;
  const dateMatch = combined.match(
    /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}(?:\s+\d{1,2}:\d{2})?)/,
  );
  if (dateMatch) transactionAt = dateMatch[1];

  return { amount, remark, sender, transactionAt, rawExcerpt: excerpt };
}

export function bcaMutasiMatchesInvoice(input: {
  parsed: BcaMutasiParseResult;
  payAmount: number;
  paymentReference: string;
}): { perfect: boolean; amountMatch: boolean; referenceMatch: boolean } {
  const amountMatch = input.parsed.amount === input.payAmount;
  const referenceMatch =
    referenceInText(input.paymentReference, input.parsed.remark) ||
    referenceInText(input.paymentReference, input.parsed.rawExcerpt);
  return {
    perfect: amountMatch && referenceMatch,
    amountMatch,
    referenceMatch,
  };
}
