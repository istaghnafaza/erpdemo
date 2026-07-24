import { cn } from "@/lib/utils";
import { deliveryStatusLabel, DELIVERY_STATUS_KIND } from "@/lib/delivery-utils";
import type { DeliveryStatus } from "@/types/deliveries";

const KIND_CLASS: Record<(typeof DELIVERY_STATUS_KIND)[DeliveryStatus], string> = {
  pending: "bg-warning/15 text-warning-foreground border-warning/30",
  warning: "bg-warning/15 text-warning-foreground border-warning/30",
  info: "bg-info/15 text-info border-info/30",
  success: "bg-success/15 text-success border-success/30",
  danger: "bg-destructive/10 text-destructive border-destructive/25",
};

export function DeliveryStatusBadge({
  status,
  className,
}: {
  status: DeliveryStatus;
  className?: string;
}) {
  const kind = DELIVERY_STATUS_KIND[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        KIND_CLASS[kind],
        className,
      )}
    >
      {deliveryStatusLabel(status)}
    </span>
  );
}
