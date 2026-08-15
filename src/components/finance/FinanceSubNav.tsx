import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, LayoutDashboard, Landmark, LineChart, Package } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { canAccess, type RbacFeature } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const TABS: Array<{
  route:
    | "/$tenantSlug/finance"
    | "/$tenantSlug/finance/cash-book"
    | "/$tenantSlug/finance/forecast"
    | "/$tenantSlug/finance/cash-lock"
    | "/$tenantSlug/finance/owner-capital";
  match: string;
  label: string;
  icon: typeof LayoutDashboard;
  feature?: RbacFeature;
}> = [
  {
    route: "/$tenantSlug/finance" as const,
    match: "ringkasan",
    label: "Ringkasan",
    icon: LayoutDashboard,
  },
  {
    route: "/$tenantSlug/finance/cash-book" as const,
    match: "/finance/cash-book",
    label: "Buku Kas",
    icon: BookOpen,
  },
  {
    route: "/$tenantSlug/finance/forecast" as const,
    match: "/finance/forecast",
    label: "Forecast Kas",
    icon: LineChart,
  },
  {
    route: "/$tenantSlug/finance/cash-lock" as const,
    match: "/finance/cash-lock",
    label: "Cash Lock",
    icon: Package,
  },
  {
    route: "/$tenantSlug/finance/owner-capital" as const,
    match: "/finance/owner-capital",
    label: "Prive / Setoran",
    icon: Landmark,
    feature: "owner_capital",
  },
];

export function FinanceSubNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tenantSlug =
    useAuthStore((s) => s.currentTenant?.slug) ?? pathname.split("/")[1] ?? "";
  const role = useAuthStore((s) => s.currentUser?.profile.role);

  const isRingkasan =
    pathname.includes("/finance") &&
    !pathname.includes("/finance/cash-book") &&
    !pathname.includes("/finance/forecast") &&
    !pathname.includes("/finance/cash-lock") &&
    !pathname.includes("/finance/owner-capital");

  return (
    <nav
      className="flex flex-wrap gap-1 border-b border-border mb-6 pb-1"
      aria-label="Navigasi modul Keuangan"
    >
      {TABS.filter((tab) => !tab.feature || canAccess(role, tab.feature)).map((tab) => {
        const Icon = tab.icon;
        const active =
          tab.match === "ringkasan" ? isRingkasan : pathname.includes(tab.match);
        return (
          <Link
            key={tab.route}
            to={tab.route}
            params={{ tenantSlug }}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors",
              active
                ? "border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-600/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
