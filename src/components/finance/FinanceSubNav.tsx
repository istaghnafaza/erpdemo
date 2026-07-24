import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, LayoutDashboard } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { cn } from "@/lib/utils";

const TABS = [
  {
    route: "/$tenantSlug/finance" as const,
    match: "/finance",
    exclude: "/finance/cash-book",
    label: "Ringkasan",
    icon: LayoutDashboard,
  },
  {
    route: "/$tenantSlug/finance/cash-book" as const,
    match: "/finance/cash-book",
    label: "Buku Kas",
    icon: BookOpen,
  },
];

export function FinanceSubNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tenantSlug =
    useAuthStore((s) => s.currentTenant?.slug) ?? pathname.split("/")[1] ?? "";

  return (
    <nav
      className="flex flex-wrap gap-1 border-b border-border mb-6 pb-1"
      aria-label="Navigasi modul Keuangan"
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active =
          pathname.includes(tab.match) &&
          !(tab.exclude && pathname.includes(tab.exclude));
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
