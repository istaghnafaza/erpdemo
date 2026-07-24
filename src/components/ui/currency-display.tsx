import { cn } from "@/lib/utils";
import { rupiah } from "@/lib/format";

// -----------------------------------------------------------------------------
// CurrencyDisplay — format IDR konsisten dengan checkout POS (rupiah helper).
// -----------------------------------------------------------------------------

export interface CurrencyDisplayProps {
  value: number;
  /** Use compact notation, e.g. "Rp 1.2 jt" instead of "Rp 1.200.000". */
  compact?: boolean;
  /** Color the value green/red based on sign (useful for cash book, P&L). */
  colorBySign?: boolean;
  /** Prefix a +/- sign for signed amounts (only meaningful with colorBySign). */
  showSign?: boolean;
  className?: string;
}

export function CurrencyDisplay({
  value,
  compact,
  colorBySign,
  showSign,
  className,
}: CurrencyDisplayProps) {
  const formatted = rupiah(Math.abs(value), { compact });
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";

  return (
    <span
      className={cn(
        colorBySign && value > 0 && "text-success",
        colorBySign && value < 0 && "text-destructive",
        className,
      )}
    >
      {showSign && sign ? `${sign} ` : value < 0 && !colorBySign ? "-" : ""}
      {formatted}
    </span>
  );
}
