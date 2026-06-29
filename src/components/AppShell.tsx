import { type ReactNode, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, ShoppingCart, Package, Wallet, Receipt, Truck, BarChart3,
  Bell, Search, ChevronDown, LogOut, Building2, Menu, X, Sparkles,
} from "lucide-react";
import { useAuth, roleLabel } from "@/lib/auth";
import { BRANCHES, STORE, PRODUCTS, RECEIVABLES, stockStatus } from "@/lib/mock-data";
import { daysBetween } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Role } from "@/lib/mock-data";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: Role[];
}

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["owner", "manager"] },
  { to: "/pos", label: "POS Kasir", icon: ShoppingCart },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/finance", label: "Keuangan", icon: Wallet, roles: ["owner", "manager"] },
  { to: "/receivables", label: "Hutang & Piutang", icon: Receipt, roles: ["owner", "manager"] },
  { to: "/purchasing", label: "Pembelian", icon: Truck, roles: ["owner", "manager"] },
  { to: "/reports", label: "Laporan", icon: BarChart3, roles: ["owner", "manager"] },
];

export function AppShell({ children, title, subtitle, actions }: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [branch, setBranch] = useState(BRANCHES[0]);
  const [mobileOpen, setMobileOpen] = useState(false);

  const criticalCount = PRODUCTS.filter((p) => stockStatus(p) === "critical").length;
  const overdueCount = RECEIVABLES.filter(
    (r) => r.amount - r.paid > 0 && daysBetween(new Date().toISOString(), r.dueDate) > 0,
  ).length;
  const notifCount = criticalCount + overdueCount;

  if (!user) {
    // shouldn't normally happen — pages should redirect; guard anyway
    navigate({ to: "/login" });
    return null;
  }

  const visibleNav = NAV.filter((n) => !n.roles || n.roles.includes(user.role));

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar - desktop */}
      <aside className="hidden lg:flex w-64 flex-col bg-gradient-sidebar text-sidebar-foreground sticky top-0 h-screen">
        <SidebarContent nav={visibleNav} pathname={pathname} />
      </aside>

      {/* Sidebar - mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex w-64 flex-col bg-gradient-sidebar text-sidebar-foreground">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 p-1 rounded-md hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent nav={visibleNav} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top nav */}
        <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
          <div className="flex items-center gap-4 px-4 lg:px-8 h-16">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 -ml-2">
              <Menu className="h-5 w-5" />
            </button>

            {/* Branch switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 -ml-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <div className="text-left hidden sm:block">
                    <div className="text-xs text-muted-foreground leading-none">Cabang</div>
                    <div className="text-sm font-medium leading-tight">{branch.name}</div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Pilih cabang</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {BRANCHES.map((b) => (
                  <DropdownMenuItem key={b.id} onClick={() => setBranch(b)}>
                    <Building2 className="h-4 w-4 mr-2" />
                    {b.name}
                    {b.isMain && <Badge variant="secondary" className="ml-auto text-[10px]">Pusat</Badge>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Search */}
            <div className="hidden md:flex flex-1 max-w-md relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Cari produk, transaksi, pelanggan..."
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-muted border-0 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex-1 md:hidden" />

            {/* Notifications */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {notifCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                      {notifCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notifikasi</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {criticalCount > 0 && (
                  <DropdownMenuItem className="flex-col items-start py-3">
                    <div className="text-sm font-medium text-destructive">{criticalCount} barang stok kritis</div>
                    <div className="text-xs text-muted-foreground">Cat Tembok Putih sisa 3 kaleng</div>
                  </DropdownMenuItem>
                )}
                {overdueCount > 0 && (
                  <DropdownMenuItem className="flex-col items-start py-3">
                    <div className="text-sm font-medium text-destructive">{overdueCount} piutang terlambat</div>
                    <div className="text-xs text-muted-foreground">PT Abadi Jaya - Rp 12.000.000</div>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-muted">
                  <div className="h-8 w-8 rounded-full bg-gradient-primary text-primary-foreground grid place-items-center text-xs font-semibold">
                    {user.avatar}
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-sm font-medium leading-none">{user.name}</div>
                    <div className="text-[11px] text-muted-foreground leading-none mt-1">{roleLabel(user.role)}</div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { logout(); navigate({ to: "/login" }); }}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page header */}
        <div className="px-4 lg:px-8 pt-6 pb-4 flex flex-wrap items-end gap-4 justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>

        <main className="flex-1 px-4 lg:px-8 pb-8">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  nav, pathname, onNavigate,
}: {
  nav: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="px-5 py-5 border-b border-white/10">
        <Link to="/dashboard" className="flex items-center gap-2.5" onClick={onNavigate}>
          <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-base font-bold leading-tight">Simetri ERP</div>
            <div className="text-[11px] text-sidebar-foreground/70 leading-tight">{STORE.name}</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {nav.map((item) => {
          const active = pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                active
                  ? "bg-gradient-primary text-white shadow-glow"
                  : "text-sidebar-foreground/80 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" style={{ width: 18, height: 18 }} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/10">
        <div className="rounded-xl bg-white/5 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary-glow" />
            <span className="text-xs font-semibold">Demo MVP</span>
          </div>
          <p className="text-[11px] text-sidebar-foreground/70 leading-relaxed">
            Mode presentasi calon klien — data simulasi.
          </p>
        </div>
      </div>
    </>
  );
}
