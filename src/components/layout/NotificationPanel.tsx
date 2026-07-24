import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Package,
  Receipt,
  Truck,
  RefreshCw,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  CheckCheck,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import {
  useNotificationStore,
  type AppNotification,
  type NotificationType,
} from "@/stores/notification.store";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { tanggal } from "@/lib/format";
import { cn } from "@/lib/utils";

// -----------------------------------------------------------------------------
// NotificationPanel — right-side sheet listing all active notifications.
// Clicking an item marks it read and navigates to the related module.
// -----------------------------------------------------------------------------

export const NOTIFICATION_TYPE_CONFIG: Record<
  NotificationType,
  { icon: typeof Package; dot: string; iconClass: string }
> = {
  stock_alert: {
    icon: Package,
    dot: "bg-destructive",
    iconClass: "bg-destructive/10 text-destructive",
  },
  ar_overdue: {
    icon: Receipt,
    dot: "bg-destructive",
    iconClass: "bg-destructive/10 text-destructive",
  },
  ap_due: { icon: Truck, dot: "bg-warning", iconClass: "bg-warning/15 text-warning-foreground" },
  reconciliation: {
    icon: AlertTriangle,
    dot: "bg-destructive",
    iconClass: "bg-destructive/10 text-destructive",
  },
  sync_failed: { icon: RefreshCw, dot: "bg-info", iconClass: "bg-info/10 text-info" },
  info: { icon: Info, dot: "bg-info", iconClass: "bg-info/10 text-info" },
  success: { icon: CheckCircle2, dot: "bg-success", iconClass: "bg-success/10 text-success" },
  warning: {
    icon: AlertTriangle,
    dot: "bg-warning",
    iconClass: "bg-warning/15 text-warning-foreground",
  },
  error: { icon: XCircle, dot: "bg-destructive", iconClass: "bg-destructive/10 text-destructive" },
};

export function entityRoute(n: AppNotification, tenantSlug: string): string | null {
  switch (n.entityType) {
    case "ar":
      return `/${tenantSlug}/receivables`;
    case "ap":
      return `/${tenantSlug}/payables`;
    case "branch_product":
      return `/${tenantSlug}/inventory`;
    case "reconciliation_alert":
      return `/${tenantSlug}/reports/cashier-audit`;
    case "offline_tx":
      return `/${tenantSlug}/pos`;
    default:
      return null;
  }
}

export interface NotificationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationPanel({ open, onOpenChange }: NotificationPanelProps) {
  const allNotifications = useNotificationStore((s) => s.notifications);
  const notifications = useMemo(
    () => allNotifications.filter((n) => !n.isDismissed),
    [allNotifications],
  );
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const currentTenant = useAuthStore((s) => s.currentTenant);
  const navigate = useNavigate();

  const handleClick = (n: AppNotification) => {
    markRead(n.id);
    const route = currentTenant ? entityRoute(n, currentTenant.slug) : null;
    if (route) {
      onOpenChange(false);
      navigate({ to: route });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-5 pb-3 border-b text-left">
          <div className="flex items-center justify-between">
            <SheetTitle>Notifikasi</SheetTitle>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => markAllRead()}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Tandai semua dibaca
              </Button>
            )}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Tidak ada notifikasi"
              description="Semua peringatan stok, piutang, dan hutang akan muncul di sini."
            />
          ) : (
            <div className="divide-y">
              {notifications.map((n) => {
                const cfg = NOTIFICATION_TYPE_CONFIG[n.type];
                const Icon = cfg.icon;
                const clickable = currentTenant
                  ? entityRoute(n, currentTenant.slug) !== null
                  : false;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    disabled={!clickable && n.isRead}
                    className={cn(
                      "w-full text-left flex items-start gap-3 px-5 py-3.5 hover:bg-muted/60 transition-colors",
                      !n.isRead && "bg-primary/[0.03]",
                    )}
                  >
                    <div
                      className={cn(
                        "h-9 w-9 rounded-lg grid place-items-center shrink-0",
                        cfg.iconClass,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{n.title}</span>
                        {!n.isRead && (
                          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)} />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {n.message}
                      </p>
                      <p className="text-[11px] text-muted-foreground/70 mt-1">
                        {tanggal(n.createdAt, { withTime: true })}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
