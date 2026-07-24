import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AR_AP_STATUS_LABELS,
  type ArApStatus,
} from "@/lib/ar-ap-utils";

const VARIANT: Record<
  ArApStatus,
  { className: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  paid: {
    className: "bg-success/15 text-success hover:bg-success/15 border-0",
    variant: "default",
  },
  partial: {
    className: "bg-info/15 text-info hover:bg-info/15 border-0",
    variant: "default",
  },
  unpaid: {
    className: "",
    variant: "secondary",
  },
  overdue: {
    className: "bg-destructive/15 text-destructive hover:bg-destructive/15 border-0",
    variant: "destructive",
  },
};

interface ArApStatusBadgeProps {
  status: ArApStatus;
  className?: string;
}

export function ArApStatusBadge({ status, className }: ArApStatusBadgeProps) {
  const cfg = VARIANT[status];
  return (
    <Badge variant={cfg.variant} className={cn("text-xs", cfg.className, className)}>
      {AR_AP_STATUS_LABELS[status]}
    </Badge>
  );
}
