import { rupiah } from "@/lib/format";
import type { PosReturnOffset, PosReturnOffsetLine } from "@/lib/pos-return-offset";

interface ReturnOffsetLinesProps {
  returnNumber: string;
  amount: number;
  items: PosReturnOffsetLine[];
  variant?: "panel" | "receipt";
}

export function ReturnOffsetLines({
  returnNumber,
  amount,
  items,
  variant = "panel",
}: ReturnOffsetLinesProps) {
  const isReceipt = variant === "receipt";

  return (
    <div className={isReceipt ? "space-y-1" : "space-y-2"}>
      <div
        className={
          isReceipt
            ? "flex justify-between text-[10px] text-emerald-700 font-medium"
            : "flex justify-between text-sm font-medium text-emerald-800 dark:text-emerald-300"
        }
      >
        <span>Potong retur ({returnNumber})</span>
        <span>−{rupiah(amount)}</span>
      </div>
      <div
        className={
          isReceipt
            ? "space-y-1 pl-2 border-l border-emerald-300/60"
            : "space-y-1.5 pl-2 border-l-2 border-emerald-300/60"
        }
      >
        {items.map((line, idx) => (
          <div
            key={`${line.sku}-${idx}`}
            className={isReceipt ? "text-[10px] text-muted-foreground" : "text-xs text-muted-foreground"}
          >
            <div className={isReceipt ? "" : "font-medium text-foreground"}>{line.productName}</div>
            <div className="flex justify-between gap-2">
              <span>
                {line.qty} × {rupiah(line.unitPrice)}
                {!isReceipt && line.sku ? ` · ${line.sku}` : ""}
              </span>
              <span className="shrink-0">−{rupiah(line.subtotal)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReturnOffsetSummary({ offset }: { offset: PosReturnOffset }) {
  return (
    <ReturnOffsetLines
      returnNumber={offset.returnNumber}
      amount={offset.amount}
      items={offset.items}
      variant="panel"
    />
  );
}
