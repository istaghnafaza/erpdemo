import { cn } from "@/lib/utils";
import { rupiah } from "@/lib/format";
import { getLinePricingDisplay } from "@/lib/pos-line-pricing-display";
import type { CartItem } from "@/types/database";

export interface PosLinePricingBreakdownProps {
  item: CartItem;
  variant?: "cart" | "review" | "receipt";
  showLineTotal?: boolean;
  className?: string;
}

export function PosLinePricingBreakdown({
  item,
  variant = "cart",
  showLineTotal = false,
  className,
}: PosLinePricingBreakdownProps) {
  const display = getLinePricingDisplay(item);
  const isReceipt = variant === "receipt";
  const textSize = isReceipt ? "text-[10px]" : "text-[11px]";

  return (
    <div className={cn("space-y-0.5", className)}>
      <div
        className={cn(
          textSize,
          isReceipt ? "text-muted-foreground" : "text-muted-foreground",
        )}
      >
        {item.qty} × {rupiah(display.baseUnitPrice)}
        {display.grossLineTotal > 0 && (
          <span className={isReceipt ? "" : " text-muted-foreground"}>
            {" "}
            ({rupiah(display.grossLineTotal)})
          </span>
        )}
      </div>
      {display.discountRows.map((row, idx) => (
        <div
          key={`${row.label}-${idx}`}
          className={cn(
            textSize,
            isReceipt ? "text-muted-foreground pl-2" : "text-destructive/90 pl-1",
          )}
        >
          {row.label} {row.percent > 0 ? `${row.percent}%` : ""} (−{rupiah(row.amount)})
        </div>
      ))}
      {display.clampedToFloor && display.discountRows.length > 0 && (
        <div
          className={cn(
            textSize,
            isReceipt ? "text-muted-foreground pl-2 italic" : "text-amber-700/90 pl-1 italic",
          )}
        >
          {item.pricing_margin_limited
            ? `Diskon dibatasi margin min — efektif ${display.effectiveDiscountPercent}%`
            : `Harga dasar (floor margin) — efektif ${display.effectiveDiscountPercent}%`}
        </div>
      )}
      {showLineTotal && (
        <div className={cn(textSize, "font-medium text-foreground pt-0.5")}>
          {rupiah(display.netLineTotal)}
        </div>
      )}
    </div>
  );
}
