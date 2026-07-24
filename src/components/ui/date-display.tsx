import { cn } from "@/lib/utils";
import { tanggal } from "@/lib/format";

// -----------------------------------------------------------------------------
// DateDisplay — consistent Indonesian date formatting across the app.
// -----------------------------------------------------------------------------

export interface DateDisplayProps {
  /** ISO date/datetime string. */
  value: string;
  /** Use full month name, e.g. "1 Juli 2026" instead of "1 Jul 2026". */
  full?: boolean;
  /** Also render the time (HH:mm). */
  withTime?: boolean;
  className?: string;
}

export function DateDisplay({ value, full, withTime, className }: DateDisplayProps) {
  return (
    <span className={cn("whitespace-nowrap", className)}>{tanggal(value, { full, withTime })}</span>
  );
}
