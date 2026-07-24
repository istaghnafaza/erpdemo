import { type ReactNode, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Wallet,
  Receipt,
  Truck,
  BarChart3,
  Bell,
  Search,
  ChevronDown,
  LogOut,
  Menu,
  X,
  Sparkles,
  Sun,
  Moon,
  FileText,
  Users,
  Globe,
  History,
  PackageCheck,
  ContactRound,
  Settings,
  Store,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useOnboardingStore } from "@/stores/onboarding.store";
import { useNotificationStore } from "@/stores/notification.store";
import { useThemeStore } from "@/stores/theme.store";
import { useBranchStore } from "@/stores/branch.store";
import { roleLabel, initials, type UserRole } from "@/types/app";
import { canAccess, type RbacFeature } from "@/lib/rbac";
import { STORE } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { isBranchSetupExemptPath, navigateToBranchSetup } from "@/lib/branch-setup-utils";
import { BranchSwitcher } from "@/components/layout/BranchSwitcher";
import { BranchSetupRequired } from "@/components/branches/BranchSetupRequired";
import { OfflineIndicator } from "@/components/layout/OfflineIndicator";
import { OnboardingProgressWidget } from "@/components/onboarding/OnboardingProgressWidget";
import { NotificationPanel } from "@/components/layout/NotificationPanel";
import { useModuleNavBadges } from "@/hooks/useModuleNavBadges";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface NavItem {
  suffix: string;
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  feature: RbacFeature;
  /** Per-module accent color, applied to the active nav item + icon (per PRD). */
  accent: string;
  /** Badge count di sidebar (pengingat modul). */
  badgeKey?: "deliveries" | "sales_orders" | "online_orders";
}

// Module color mapping per PRD "Visual Identity" table.
const NAV_DEFINITIONS: Omit<NavItem, "to">[] = [
  {
    suffix: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    feature: "dashboard",
    accent: "blue",
  },
  {
    suffix: "/pos",
    label: "POS Kasir",
    icon: ShoppingCart,
    feature: "pos",
    accent: "green",
  },
  {
    suffix: "/sales/transactions",
    label: "Histori Penjualan",
    icon: History,
    feature: "sales_history",
    accent: "teal",
  },
  {
    suffix: "/deliveries",
    label: "Pengiriman",
    icon: PackageCheck,
    feature: "deliveries",
    accent: "sky",
    badgeKey: "deliveries",
  },
  {
    suffix: "/customers",
    label: "Pelanggan",
    icon: ContactRound,
    feature: "customers",
    accent: "rose",
  },
  {
    suffix: "/online-orders",
    label: "Order Online",
    icon: Globe,
    feature: "online_orders",
    accent: "violet",
    badgeKey: "online_orders",
  },
  {
    suffix: "/inventory/products",
    label: "Inventory",
    icon: Package,
    feature: "inventory",
    accent: "cyan",
  },
  {
    suffix: "/sales-orders",
    label: "Sales Order",
    icon: FileText,
    feature: "sales_orders",
    accent: "indigo",
    badgeKey: "sales_orders",
  },
  {
    suffix: "/finance",
    label: "Keuangan",
    icon: Wallet,
    feature: "finance",
    accent: "emerald",
  },
  {
    suffix: "/receivables",
    label: "Piutang",
    icon: Receipt,
    feature: "receivables",
    accent: "amber",
  },
  {
    suffix: "/payables",
    label: "Hutang Supplier",
    icon: Receipt,
    feature: "payables",
    accent: "amber",
  },
  {
    suffix: "/purchasing/purchase-orders",
    label: "Pembelian",
    icon: Truck,
    feature: "purchasing",
    accent: "orange",
  },
  {
    suffix: "/reports",
    label: "Laporan",
    icon: BarChart3,
    feature: "reports",
    accent: "violet",
  },
  {
    suffix: "/users",
    label: "Pegawai",
    icon: Users,
    feature: "users",
    accent: "violet",
  },
  {
    suffix: "/toko-saya",
    label: "Toko Saya",
    icon: Store,
    feature: "toko_saya",
    accent: "orange",
  },
  {
    suffix: "/settings/master-data/product-attributes",
    label: "Pengaturan",
    icon: Settings,
    feature: "settings",
    accent: "slate",
  },
];

const ACCENT_ACTIVE_BG: Record<string, string> = {
  blue: "bg-blue-600",
  green: "bg-green-600",
  teal: "bg-teal-600",
  sky: "bg-sky-600",
  rose: "bg-rose-600",
  cyan: "bg-cyan-600",
  indigo: "bg-indigo-600",
  emerald: "bg-emerald-600",
  amber: "bg-amber-600",
  orange: "bg-orange-600",
  violet: "bg-violet-600",
  slate: "bg-slate-600",
};

export function AppShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const startWizardSetup = useOnboardingStore((s) => s.startWizardSetup);
  const needsBranchSetup = useBranchStore((s) => !s.isLoading && s.branches.length === 0);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const currentTenant = useAuthStore((s) => s.currentTenant);
  const tenantSlug = currentTenant?.slug ?? pathname.split("/")[1] ?? "";
  const [mobileOpen, setMobileOpen] = useState(false);

  const isOwner = currentUser?.profile.role === "owner";
  const showBranchSetupGate =
    needsBranchSetup && !isBranchSetupExemptPath(pathname, tenantSlug);

  const goToBranchSetup = () => {
    navigateToBranchSetup({
      navigate,
      tenant: currentTenant,
      startWizardSetup,
    });
  };

  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const notifOpen = useNotificationStore((s) => s.isPanelOpen);
  const setNotifOpen = useNotificationStore((s) => s.setPanelOpen);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const user = currentUser!.profile;

  const visibleNav: NavItem[] = NAV_DEFINITIONS.filter((n) =>
    canAccess(user.role, n.feature),
  ).map((n) => ({ ...n, to: `/${tenantSlug}${n.suffix}` }));

  const moduleBadges = useModuleNavBadges();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar - desktop */}
      <aside className="hidden lg:flex w-64 flex-col bg-gradient-sidebar text-sidebar-foreground sticky top-0 h-screen">
        <SidebarContent
          nav={visibleNav}
          pathname={pathname}
          logoHref={`/${tenantSlug}/dashboard`}
          moduleBadges={moduleBadges}
          needsBranchSetup={needsBranchSetup}
          isOwner={isOwner}
          onBranchSetup={goToBranchSetup}
        />
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
            <SidebarContent
              nav={visibleNav}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
              logoHref={`/${tenantSlug}/dashboard`}
              moduleBadges={moduleBadges}
              needsBranchSetup={needsBranchSetup}
              isOwner={isOwner}
              onBranchSetup={goToBranchSetup}
            />
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

            {/* Logo (mobile only, sidebar hidden) */}
            <div className="lg:hidden flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-primary grid place-items-center shadow-glow">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
            </div>

            {/* Branch switcher */}
            <BranchSwitcher />

            {/* Search */}
            <div className="hidden md:flex flex-1 max-w-md relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                placeholder="Cari produk, transaksi, pelanggan..."
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-muted border-0 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex-1 md:hidden" />

            {/* Dark mode toggle */}
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Ganti tema">
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            {/* Notifications */}
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => setNotifOpen(true)}
              aria-label="Notifikasi"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-4 min-w-4 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
            <NotificationPanel open={notifOpen} onOpenChange={setNotifOpen} />

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-muted">
                  <div className="h-8 w-8 rounded-full bg-gradient-primary text-primary-foreground grid place-items-center text-xs font-semibold">
                    {initials(user.name)}
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-sm font-medium leading-none">{user.name}</div>
                    <div className="text-[11px] text-muted-foreground leading-none mt-1">
                      {roleLabel(user.role)}
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>{user.name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={goToBranchSetup}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {needsBranchSetup ? "Wizard Setup Toko" : "Lanjutkan Setup"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    await logout();
                    navigate({ to: "/login", replace: true });
                  }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <OfflineIndicator />

        {/* Page header */}
        <div className="px-4 lg:px-8 pt-6 pb-4 flex flex-wrap items-end gap-4 justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">{title}</h1>
            {subtitle && !showBranchSetupGate && (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          {actions && !showBranchSetupGate && <div className="flex gap-2">{actions}</div>}
        </div>

        <main className="flex-1 px-4 lg:px-8 pb-8">
          {showBranchSetupGate ? (
            <BranchSetupRequired
              isOwner={isOwner}
              onboardingComplete={currentTenant?.onboarding_complete ?? false}
              onSetup={goToBranchSetup}
            />
          ) : (
            children
          )}
        </main>
        <OnboardingProgressWidget />
      </div>
    </div>
  );
}

function SidebarContent({
  nav,
  pathname,
  onNavigate,
  logoHref,
  moduleBadges,
  needsBranchSetup,
  isOwner,
  onBranchSetup,
}: {
  nav: NavItem[];
  pathname: string;
  onNavigate?: () => void;
  logoHref?: string;
  moduleBadges: { deliveries: number; sales_orders: number; online_orders: number };
  needsBranchSetup?: boolean;
  isOwner?: boolean;
  onBranchSetup?: () => void;
}) {
  return (
    <>
      <div className="px-5 py-5 border-b border-white/10">
        <Link to={logoHref ?? "/"} className="flex items-center gap-2.5" onClick={onNavigate}>
          <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-base font-bold leading-tight">SEPS</div>
            <div className="text-[11px] text-sidebar-foreground/70 leading-tight">{STORE.name}</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {needsBranchSetup && (
          <div className="mb-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
            <p className="text-xs font-semibold text-amber-100 mb-1">Belum ada toko aktif</p>
            <p className="text-[11px] text-sidebar-foreground/70 leading-relaxed mb-2">
              {isOwner
                ? "Setup cabang/toko dulu sebelum modul operasional dapat dipakai."
                : "Hubungi owner untuk menambahkan atau mengaktifkan toko."}
            </p>
            {isOwner && onBranchSetup && (
              <button
                type="button"
                onClick={() => {
                  onBranchSetup();
                  onNavigate?.();
                }}
                className="w-full rounded-lg bg-gradient-primary text-white text-xs font-semibold py-2 px-3 hover:opacity-90 transition-opacity"
              >
                Wizard Setup Toko
              </button>
            )}
          </div>
        )}
        {nav.map((item) => {
          const active = pathname.startsWith(item.to);
          const Icon = item.icon;
          const badgeCount = item.badgeKey ? moduleBadges[item.badgeKey] : 0;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                active
                  ? cn(ACCENT_ACTIVE_BG[item.accent], "text-white shadow-glow")
                  : "text-sidebar-foreground/80 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" style={{ width: 18, height: 18 }} />
              <span className="flex-1 truncate">{item.label}</span>
              {badgeCount > 0 && (
                <span
                  className={cn(
                    "min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-bold flex items-center justify-center",
                    active
                      ? "bg-white/25 text-white"
                      : "bg-amber-500 text-white",
                  )}
                >
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
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
