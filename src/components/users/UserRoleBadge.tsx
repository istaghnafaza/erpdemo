import { Badge } from "@/components/ui/badge";
import { roleLabel, type UserRole } from "@/types/app";
import { cn } from "@/lib/utils";

const ROLE_STYLES: Record<UserRole, string> = {
  owner: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  manager: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  cashier: "bg-green-500/15 text-green-700 dark:text-green-300",
  warehouse: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  accountant: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
};

export function UserRoleBadge({ role, className }: { role: UserRole; className?: string }) {
  return (
    <Badge variant="secondary" className={cn("font-normal", ROLE_STYLES[role], className)}>
      {roleLabel(role)}
    </Badge>
  );
}
