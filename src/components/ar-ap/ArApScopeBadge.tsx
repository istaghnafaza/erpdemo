import { Building2, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ArApScopeBadgeProps {
  scopeLabel: string;
  isConsolidated: boolean;
}

export function ArApScopeBadge({ scopeLabel, isConsolidated }: ArApScopeBadgeProps) {
  return (
    <Badge variant="secondary" className="gap-1.5 mb-4">
      {isConsolidated ? <Layers className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
      {scopeLabel}
    </Badge>
  );
}
