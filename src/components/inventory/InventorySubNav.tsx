import { Link, useRouterState } from "@tanstack/react-router";
import { Package, ClipboardList, ArrowLeftRight } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { cn } from "@/lib/utils";

const TABS = [
  {
    route: "/$tenantSlug/inventory/products" as const,
    match: "/inventory/products",
    label: "Master Barang",
    icon: Package,
  },
  {
    route: "/$tenantSlug/inventory/stock-opname" as const,
    match: "/inventory/stock-opname",
    label: "Stock Opname",
    icon: ClipboardList,
  },
  {
    route: "/$tenantSlug/inventory/stock-transfer" as const,
    match: "/inventory/stock-transfer",
    label: "Transfer Stok",
    icon: ArrowLeftRight,
  },
];

export function InventorySubNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tenantSlug =
    useAuthStore((s) => s.currentTenant?.slug) ?? pathname.split("/")[1] ?? "";

  return (
    <nav
      className="flex flex-wrap gap-1 border-b border-border mb-6 pb-1"
      aria-label="Navigasi modul Inventory"
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
                ? "border-cyan-600 text-cyan-700 dark:text-cyan-400 bg-cyan-600/5"
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
