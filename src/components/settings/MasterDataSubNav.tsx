import { Link, useRouterState } from "@tanstack/react-router";
import { Database, Tags } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { cn } from "@/lib/utils";

const TABS = [
  {
    route: "/$tenantSlug/settings/master-data/product-attributes" as const,
    match: "/settings/master-data/product-attributes",
    label: "Attribute Produk",
    icon: Tags,
  },
];

export function MasterDataSubNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tenantSlug =
    useAuthStore((s) => s.currentTenant?.slug) ?? pathname.split("/")[1] ?? "";

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <Database className="h-3.5 w-3.5" />
        Master Data
      </div>
      <nav
        className="flex flex-wrap gap-1 border-b border-border pb-1"
        aria-label="Navigasi Master Data"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = pathname.includes(tab.match);
          return (
            <Link
              key={tab.route}
              to={tab.route}
              params={{ tenantSlug }}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors",
                active
                  ? "border-slate-600 text-slate-700 dark:text-slate-300 bg-slate-600/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
