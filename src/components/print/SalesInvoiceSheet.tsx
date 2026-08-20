import { rupiah, tanggal } from "@/lib/format";
import type { InvoiceDoc } from "@/lib/print-docs";
import { orderFulfillmentLabel } from "@/lib/sales-transaction-utils";
import { cn } from "@/lib/utils";

const PAYMENT_LABEL: Record<string, string> = {
  cash: "Tunai",
  card: "Kartu",
  qris_edc: "QRIS EDC",
  qris_gopay: "QRIS GoPay",
  qris_ovo: "QRIS OVO",
  qris_other: "QRIS Lainnya",
  transfer: "Transfer",
  credit: "Piutang",
};

export function SalesInvoiceSheet({
  doc,
  paper,
  className,
}: {
  doc: InvoiceDoc;
  paper: "a4" | "a5";
  className?: string;
}) {
  const remaining = doc.remainingBalance ?? 0;
  const compact = paper === "a5";

  return (
    <div
      className={cn(
        "invoice-print-root bg-white text-black font-sans",
        compact ? "text-[10px] leading-snug" : "text-[12px] leading-normal",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
        <div>
          <div className={cn("font-bold", compact ? "text-base" : "text-lg")}>
            {doc.storeName || doc.branchName}
          </div>
          <div className={cn("font-semibold", compact ? "text-[11px]" : "text-sm")}>{doc.branchName}</div>
          {doc.branchAddress ? <div className="mt-0.5">{doc.branchAddress}</div> : null}
          {doc.branchPhone ? <div>WA: {doc.branchPhone}</div> : null}
        </div>
        <div className="text-right shrink-0">
          <div className={cn("font-bold uppercase tracking-wide", compact ? "text-sm" : "text-base")}>
            Invoice
          </div>
          <div className="font-mono font-semibold mt-1">{doc.transactionNumber}</div>
          {doc.soNumber && doc.soNumber !== doc.transactionNumber ? (
            <div className="font-mono">SO: {doc.soNumber}</div>
          ) : null}
          <div>{tanggal(doc.createdAt, { withTime: true })}</div>
        </div>
      </div>

      <div className={cn("mt-3 grid gap-x-6 gap-y-1", compact ? "grid-cols-1" : "grid-cols-2")}>
        <div>
          <span className="text-neutral-600">Pelanggan: </span>
          {doc.customerName ?? "Pelanggan Umum"}
        </div>
        {doc.customerPhone ? (
          <div>
            <span className="text-neutral-600">HP: </span>
            {doc.customerPhone}
          </div>
        ) : null}
        <div>
          <span className="text-neutral-600">Kasir: </span>
          {doc.cashierName}
        </div>
        <div>
          <span className="text-neutral-600">Jenis order: </span>
          {orderFulfillmentLabel(doc.orderFulfillmentType ?? "cod")}
        </div>
        {doc.deliverySiteLabel ? (
          <div className="col-span-full">
            <span className="text-neutral-600">Proyek: </span>
            {doc.deliverySiteLabel}
          </div>
        ) : null}
        {doc.deliveryAddress ? (
          <div className="col-span-full">
            <span className="text-neutral-600">Alamat kirim: </span>
            {doc.deliveryAddress}
          </div>
        ) : null}
        {doc.dueDate ? (
          <div>
            <span className="text-neutral-600">Jatuh tempo: </span>
            {tanggal(doc.dueDate)}
          </div>
        ) : null}
      </div>

      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="border-y border-black">
            <th className="py-1 pr-1 text-left font-semibold w-7">No</th>
            <th className="py-1 pr-1 text-left font-semibold">Item</th>
            <th className="py-1 px-1 text-right font-semibold">Qty</th>
            <th className="py-1 px-1 text-left font-semibold">Sat</th>
            <th className="py-1 px-1 text-right font-semibold">Harga</th>
            <th className="py-1 px-1 text-right font-semibold">Diskon</th>
            <th className="py-1 pl-1 text-right font-semibold">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {doc.items.map((item, i) => (
            <tr key={`${item.product_id}-${i}`} className="border-b border-neutral-300 align-top">
              <td className="py-1 pr-1">{i + 1}</td>
              <td className="py-1 pr-1">
                {item.name}
                {item.is_so_line ? <span className="ml-1 text-neutral-500">(SO)</span> : null}
              </td>
              <td className="py-1 px-1 text-right whitespace-nowrap">
                {new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 }).format(item.qty)}
              </td>
              <td className="py-1 px-1">{item.unit}</td>
              <td className="py-1 px-1 text-right whitespace-nowrap">{rupiah(item.selling_price)}</td>
              <td className="py-1 px-1 text-right whitespace-nowrap">
                {item.discount ? rupiah(item.discount) : "—"}
              </td>
              <td className="py-1 pl-1 text-right whitespace-nowrap">{rupiah(item.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={cn("mt-3 ml-auto space-y-0.5", compact ? "w-full" : "w-[46%]")}>
        <Row label="Subtotal" value={rupiah(doc.subtotal)} />
        {doc.discountAmount > 0 ? (
          <Row label="Diskon" value={`−${rupiah(doc.discountAmount)}`} />
        ) : null}
        {(doc.returnOffsetAmount ?? 0) > 0 ? (
          <Row
            label={`Potong retur${doc.returnNumber ? ` (${doc.returnNumber})` : ""}`}
            value={`−${rupiah(doc.returnOffsetAmount!)}`}
          />
        ) : null}
        <Row label="Total" value={rupiah(doc.grandTotal)} strong />
        <Row
          label={`Dibayar (${PAYMENT_LABEL[doc.paymentMethod] ?? doc.paymentMethod})`}
          value={rupiah(doc.amountPaid)}
        />
        {doc.change > 0 ? <Row label="Kembalian" value={rupiah(doc.change)} /> : null}
        {remaining > 0 ? <Row label="Sisa piutang" value={rupiah(remaining)} strong /> : null}
      </div>

      {doc.notes ? <div className="mt-3 text-neutral-700">Catatan: {doc.notes}</div> : null}

      <div className={cn("mt-8 grid grid-cols-2 gap-8", compact ? "mt-6" : "mt-10")}>
        <div className="text-center">
          <div>Penerima</div>
          <div className="h-12" />
          <div className="border-t border-neutral-400 mx-4 pt-1">( ...................... )</div>
        </div>
        <div className="text-center">
          <div>Hormat kami</div>
          <div className="h-12" />
          <div className="border-t border-neutral-400 mx-4 pt-1">{doc.branchName}</div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", strong && "font-bold text-[1.05em] pt-1")}>
      <span>{label}</span>
      <span className="whitespace-nowrap">{value}</span>
    </div>
  );
}
