import { cn } from "@/lib/utils";

// -----------------------------------------------------------------------------
// StatusBadge — consistent status pill used across AR/AP/PO/transfer/session
// tables. Maps a small closed set of status keys to color + Indonesian label,
// so every module renders the same status the same way.
// -----------------------------------------------------------------------------

export type StatusKind =
  | "paid"
  | "unpaid"
  | "partial"
  | "overdue"
  | "draft"
  | "sent"
  | "confirmed"
  | "received"
  | "partial_received"
  | "cancelled"
  | "completed"
  | "voided"
  | "returned"
  | "open"
  | "closed"
  | "active"
  | "inactive"
  | "normal"
  | "low"
  | "critical"
  | "synced"
  | "syncing"
  | "pending"
  | "failed";

const STATUS_MAP: Record<StatusKind, { label: string; className: string }> = {
  paid: { label: "Lunas", className: "bg-success/15 text-success border-success/30" },
  unpaid: { label: "Belum Bayar", className: "bg-muted text-muted-foreground border-border" },
  partial: {
    label: "Sebagian",
    className: "bg-warning/15 text-warning-foreground border-warning/30",
  },
  overdue: {
    label: "Terlambat",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },

  draft: { label: "Draft", className: "bg-muted text-muted-foreground border-border" },
  sent: { label: "Terkirim", className: "bg-info/15 text-info border-info/30" },
  confirmed: { label: "Dikonfirmasi", className: "bg-info/15 text-info border-info/30" },
  received: { label: "Diterima", className: "bg-success/15 text-success border-success/30" },
  partial_received: {
    label: "Diterima Sebagian",
    className: "bg-warning/15 text-warning-foreground border-warning/30",
  },
  cancelled: {
    label: "Dibatalkan",
    className: "bg-destructive/10 text-destructive border-destructive/25",
  },

  completed: { label: "Selesai", className: "bg-success/15 text-success border-success/30" },
  voided: {
    label: "Dibatalkan",
    className: "bg-destructive/10 text-destructive border-destructive/25",
  },
  returned: {
    label: "Diretur",
    className: "bg-warning/15 text-warning-foreground border-warning/30",
  },

  open: { label: "Terbuka", className: "bg-info/15 text-info border-info/30" },
  closed: { label: "Ditutup", className: "bg-muted text-muted-foreground border-border" },

  active: { label: "Aktif", className: "bg-success/15 text-success border-success/30" },
  inactive: { label: "Nonaktif", className: "bg-muted text-muted-foreground border-border" },

  normal: { label: "Normal", className: "bg-success/15 text-success border-success/30" },
  low: { label: "Menipis", className: "bg-warning/15 text-warning-foreground border-warning/30" },
  critical: {
    label: "Kritis",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },

  synced: { label: "Tersinkron", className: "bg-success/15 text-success border-success/30" },
  syncing: { label: "Menyinkronkan", className: "bg-info/15 text-info border-info/30" },
  pending: {
    label: "Menunggu",
    className: "bg-warning/15 text-warning-foreground border-warning/30",
  },
  failed: { label: "Gagal", className: "bg-destructive/15 text-destructive border-destructive/30" },
};

export interface StatusBadgeProps {
  status: StatusKind;
  /** Override the default Indonesian label. */
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const cfg = STATUS_MAP[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        cfg.className,
        className,
      )}
    >
      {label ?? cfg.label}
    </span>
  );
}
