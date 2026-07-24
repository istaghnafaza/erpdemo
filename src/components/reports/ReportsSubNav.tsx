import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  ClipboardCheck,
  LayoutDashboard,
  PackageSearch,
  TrendingUp,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { cn } from "@/lib/utils";

const TABS = [
  {
    route: "/$tenantSlug/reports" as const,
    match: "/reports",
    exclude: ["/reports/sales", "/reports/profit-loss", "/reports/cashier-audit", "/reports/stock-opname"],
    label: "Ringkasan",
    icon: LayoutDashboard,
  },
  {
    route: "/$tenantSlug/reports/sales" as const,
    match: "/reports/sales",
    label: "Penjualan",
    icon: TrendingUp,
  },
  {
    route: "/$tenantSlug/reports/profit-loss" as const,
    match: "/reports/profit-loss",
    label: "Laba Rugi",
    icon: BarChart3,
  },
  {
    route: "/$tenantSlug/reports/cashier-audit" as const,
    match: "/reports/cashier-audit",
    label: "Audit Kasir",
    icon: ClipboardCheck,
  },
  {
    route: "/$tenantSlug/reports/stock-opname" as const,
    match: "/reports/stock-opname",
    label: "Selisih Opname",
    icon: PackageSearch,
  },
];

export function ReportsSubNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tenantSlug =
    useAuthStore((s) => s.currentTenant?.slug) ?? pathname.split("/")[1] ?? "";

  return (
    <nav className="flex flex-wrap gap-1 border-b border-border mb-6 pb-1" aria-label="Navigasi Laporan">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active =
          pathname.includes(tab.match) &&
          !(tab.exclude?.some((ex) => pathname.includes(ex)));
        return (
          <Link
            key={tab.route}
            to={tab.route}
            params={{ tenantSlug }}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors",
              active
                ? "border-violet-600 text-violet-700 dark:text-violet-400 bg-violet-600/5"
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
