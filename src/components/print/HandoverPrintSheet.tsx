import { formatHandoverQty, type HandoverDoc } from "@/lib/handover-doc";
import { tanggal } from "@/lib/format";
import { orderFulfillmentLabel } from "@/lib/sales-transaction-utils";
import { cn } from "@/lib/utils";

export function HandoverPrintSheet({
  doc,
  className,
}: {
  doc: HandoverDoc;
  className?: string;
}) {
  const handoverCount = doc.lines.filter((l) => l.qtyHandover > 0).length;
  const indentCount = doc.lines.filter((l) => l.isSoLine).length;

  return (
    <div
      className={cn(
        "handover-print-root bg-white text-black font-sans text-[12px] leading-snug",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b-2 border-black pb-2">
        <div>
          <div className="text-[10px] uppercase tracking-wide">SEPS</div>
          <div className="text-base font-bold">{doc.storeName || doc.branchName}</div>
          {doc.branchAddress ? <div className="text-[11px]">{doc.branchAddress}</div> : null}
          {doc.branchPhone ? <div className="text-[11px]">WA: {doc.branchPhone}</div> : null}
        </div>
        <div className="text-right">
          <div className="text-sm font-bold uppercase">{doc.title}</div>
          <div className="font-mono text-[11px]">{doc.transactionNumber}</div>
          {doc.deliveryNumber ? (
            <div className="font-mono text-[11px]">DO: {doc.deliveryNumber}</div>
          ) : null}
          <div className="text-[11px]">{tanggal(doc.createdAt, { withTime: true })}</div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
        <div>
          <span className="text-neutral-600">Pelanggan: </span>
          {doc.customerName ?? "Pelanggan Umum"}
        </div>
        <div>
          <span className="text-neutral-600">HP: </span>
          {doc.customerPhone ?? "—"}
        </div>
        <div>
          <span className="text-neutral-600">Jenis: </span>
          {orderFulfillmentLabel(doc.orderFulfillmentType)}
        </div>
        <div>
          <span className="text-neutral-600">Kasir: </span>
          {doc.cashierName}
        </div>
        {doc.deliverySiteLabel ? (
          <div className="col-span-2">
            <span className="text-neutral-600">Proyek: </span>
            {doc.deliverySiteLabel}
          </div>
        ) : null}
        {doc.deliveryAddress ? (
          <div className="col-span-2">
            <span className="text-neutral-600">Alamat: </span>
            {doc.deliveryAddress}
          </div>
        ) : null}
        {doc.driverName || doc.vehiclePlate ? (
          <div className="col-span-2">
            <span className="text-neutral-600">Armada: </span>
            {[doc.driverName, doc.vehiclePlate].filter(Boolean).join(" · ") || "—"}
          </div>
        ) : null}
      </div>

      <table className="mt-3 w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-y border-black">
            <th className="w-7 py-1 text-left font-semibold">No</th>
            <th className="py-1 text-left font-semibold">Barang</th>
            <th className="w-16 py-1 text-right font-semibold">Order</th>
            <th className="w-16 py-1 text-right font-semibold">Serah</th>
            <th className="w-10 py-1 text-center font-semibold">Cek</th>
            <th className="w-24 py-1 text-left font-semibold">Ket.</th>
          </tr>
        </thead>
        <tbody>
          {doc.lines.map((line, i) => (
            <tr key={`${line.productId}-${i}`} className="border-b border-neutral-300">
              <td className="py-1.5 align-top">{i + 1}</td>
              <td className="py-1.5 align-top">
                <div className="font-medium">{line.name}</div>
                <div className="text-[10px] text-neutral-600">
                  {line.sku ? `SKU ${line.sku}` : "—"} · {line.unit}
                  {line.isSoLine ? " · INDENT/SO" : ""}
                </div>
              </td>
              <td className="py-1.5 text-right align-top font-mono">
                {formatHandoverQty(line.qtyOrdered)}
              </td>
              <td className="py-1.5 text-right align-top font-mono font-semibold">
                {formatHandoverQty(line.qtyHandover)}
              </td>
              <td className="py-1.5 text-center align-top">
                <span className="inline-block h-3.5 w-3.5 border border-black" />
              </td>
              <td className="py-1.5 align-top text-[10px]">
                {line.isSoLine
                  ? "Belum serah — indent"
                  : line.qtyHandover <= 0
                    ? "Tidak dikirim"
                    : line.qtyHandover < line.qtyOrdered
                      ? "Sebagian"
                      : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-2 text-[10px] text-neutral-700">
        Centang kolom Cek setelah barang dihitung bersama pelanggan. Serah sekarang: {handoverCount}{" "}
        item
        {indentCount > 0 ? ` · indent/SO: ${indentCount} item (tidak ikut serah)` : ""}.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-8 text-center text-[11px]">
        <div>
          <div className="h-12 border-b border-black" />
          <div className="mt-1 font-semibold">Pengirim / Gudang</div>
          <div className="text-[10px] text-neutral-600">Nama & paraf</div>
        </div>
        <div>
          <div className="h-12 border-b border-black" />
          <div className="mt-1 font-semibold">Penerima / Pelanggan</div>
          <div className="text-[10px] text-neutral-600">Nama & paraf</div>
        </div>
      </div>
    </div>
  );
}
