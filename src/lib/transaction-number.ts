/** Nomor transaksi POS — format: TRX-{KODE_CABANG}-{YYYYMMDD}-{SEQ} */
export function generateTransactionNumber(
  branchCode: string,
  date: Date,
  sequence: number,
): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const seq = String(sequence).padStart(4, "0");
  return `TRX-${branchCode}-${y}${m}${d}-${seq}`;
}
