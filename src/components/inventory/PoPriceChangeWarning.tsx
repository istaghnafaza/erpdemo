import { hppDiffers } from "@/lib/po-costing";
import { cn } from "@/lib/utils";

export function shouldWarnPoPriceChange(hpp: number, lastPoPrice: number | null | undefined) {
  if (lastPoPrice == null || lastPoPrice <= 0) return false;
  return hppDiffers(hpp, lastPoPrice);
}

interface PoPriceChangeWarningProps {
  hpp: number;
  lastPoPrice: number | null | undefined;
  sellingPrice: number;
  poNumber?: string | null;
  showAmounts?: boolean;
  className?: string;
}

export function PoPriceChangeWarning({
  hpp,
  lastPoPrice,
  sellingPrice,
  poNumber,
  showAmounts = true,
  className,
}: PoPriceChangeWarningProps) {
  if (!shouldWarnPoPriceChange(hpp, lastPoPrice) || lastPoPrice == null) return null;

  const marginNow = sellingPrice - hpp;
  const marginIfPo = sellingPrice - lastPoPrice;

  return (
    <div
      className={cn(
        "text-[11px] text-amber-800 rounded bg-amber-50 border border-amber-200 px-1.5 py-1",
        className,
      )}
    >
      {showAmounts ? (
        <>
          Harga PO terbaru {hpp.toLocaleString("id-ID")} → {lastPoPrice.toLocaleString("id-ID")}
          {poNumber ? ` (${poNumber})` : ""}. Harga jual tetap {sellingPrice.toLocaleString("id-ID")}{" "}
          (margin {marginNow.toLocaleString("id-ID")} → {marginIfPo.toLocaleString("id-ID")}/unit
          jika HPP mengikuti harga PO). Sesuaikan harga jual di sini bila perlu.
        </>
      ) : (
        <>Harga beli PO terbaru berubah. Periksa dan sesuaikan harga jual bila perlu.</>
      )}
    </div>
  );
}
