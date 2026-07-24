import { Building2, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ReportScopeBadgeProps {
  scopeLabel: string;
  isConsolidated: boolean;
}

export function ReportScopeBadge({ scopeLabel, isConsolidated }: ReportScopeBadgeProps) {
  return (
    <Badge variant="secondary" className="gap-1.5">
      {isConsolidated ? <Layers className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
      {scopeLabel}
    </Badge>
  );
}
