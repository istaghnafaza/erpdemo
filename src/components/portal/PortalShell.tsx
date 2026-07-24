import { Link } from "@tanstack/react-router";
import { Globe, LogOut, Package, ShoppingCart, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { portalAccountStatusLabel } from "@/lib/portal-utils";
import type { CustomerPortalAccount, CustomerPortalConfig } from "@/types/customer-portal";
import type { Branch } from "@/types/database";

interface PortalShellProps {
  tenantSlug: string;
  config: CustomerPortalConfig;
  account: CustomerPortalAccount | null;
  cartCount: number;
  onOpenCart: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export function PortalShell({
  tenantSlug,
  config,
  account,
  cartCount,
  onOpenCart,
  onOpenAuth,
  onLogout,
  children,
}: PortalShellProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-gradient-primary grid place-items-center shrink-0">
              <Globe className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{config.storeDisplayName}</div>
              <div className="text-[10px] text-muted-foreground">Order Online</div>
            </div>
          </div>

          <nav className="hidden sm:flex items-center gap-1 text-sm">
            <Link
              to="/$tenantSlug/shop"
              params={{ tenantSlug }}
              className="px-3 py-1.5 rounded-md hover:bg-muted font-medium"
            >
              Katalog
            </Link>
            {account && (
              <Link
                to="/$tenantSlug/shop/orders"
                params={{ tenantSlug }}
                className="px-3 py-1.5 rounded-md hover:bg-muted font-medium flex items-center gap-1"
              >
                <Package className="h-3.5 w-3.5" />
                Pesanan Saya
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="relative" onClick={onOpenCart}>
              <ShoppingCart className="h-4 w-4" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[1.125rem] h-[1.125rem] rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center px-1">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Button>

            {account ? (
              <div className="flex items-center gap-2">
                <div className="hidden md:block text-right">
                  <div className="text-xs font-medium">{account.name}</div>
                  <Badge variant="secondary" className="text-[10px]">
                    {portalAccountStatusLabel(account.status)}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" onClick={onLogout} title="Keluar">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={onOpenAuth}>
                <User className="h-4 w-4 mr-1.5" />
                Login
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Portal pelanggan · {config.storeDisplayName}
        <div className="mt-1">
          <Link to="/login" className="underline hover:text-foreground">
            Login staff ERP
          </Link>
        </div>
      </footer>
    </div>
  );
}

export interface PortalBranchSelectProps {
  branches: Branch[];
  activeBranchId: string | null;
  onChange: (branchId: string) => void;
}

export function PortalBranchSelect({
  branches,
  activeBranchId,
  onChange,
}: PortalBranchSelectProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Cabang:</span>
      {branches.map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={() => onChange(b.id)}
          className={`px-3 py-1 rounded-full border text-xs transition-colors ${
            activeBranchId === b.id
              ? "border-primary bg-primary/10 text-primary font-medium"
              : "hover:bg-muted"
          }`}
        >
          {b.name}
        </button>
      ))}
    </div>
  );
}
