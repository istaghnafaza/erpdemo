import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { PortalAuthDialog } from "@/components/portal/PortalAuthDialog";
import { PortalCartSheet } from "@/components/portal/PortalCartSheet";
import { PortalBranchSelect, PortalShell } from "@/components/portal/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCustomerPortal } from "@/hooks/useCustomerPortal";
import { resolvePortalTenantBySlug } from "@/lib/portal-utils";
import { rupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/$tenantSlug/shop/")({
  component: PortalShopPage,
});

const STOCK_STYLES = {
  available: "bg-success/15 text-success",
  limited: "bg-warning/15 text-warning-foreground",
  out: "bg-muted text-muted-foreground",
};

function PortalShopPage() {
  const { tenantSlug } = Route.useParams();
  const tenant = resolvePortalTenantBySlug(tenantSlug);
  const [authOpen, setAuthOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const portal = useCustomerPortal(tenant!.id, tenantSlug);

  if (!tenant || !portal.config) {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center text-sm text-muted-foreground">
        Portal tidak tersedia. Coba refresh halaman atau hapus data localStorage key{" "}
        <code className="mx-1">ses-customer-portal</code>.
      </div>
    );
  }

  return (
    <PortalShell
      tenantSlug={tenantSlug}
      config={portal.config}
      account={portal.account}
      cartCount={portal.cartCount}
      onOpenCart={() => setCartOpen(true)}
      onOpenAuth={() => setAuthOpen(true)}
      onLogout={() => {
        portal.logout();
        toast.success("Logout berhasil");
      }}
    >
      <div className="space-y-5">
        <Card className="p-4 bg-gradient-to-r from-primary/5 to-transparent border-primary/20">
          <p className="text-sm">{portal.config.welcomeMessage}</p>
        </Card>

        <PortalBranchSelect
          branches={portal.branches}
          activeBranchId={portal.activeBranch?.id ?? null}
          onChange={portal.setBranch}
        />

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Cari produk..."
              value={portal.search}
              onChange={(e) => portal.setSearch(e.target.value)}
            />
          </div>
          <Select value={portal.category} onValueChange={portal.setCategory}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Kategori" />
            </SelectTrigger>
            <SelectContent>
              {portal.categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c === "all" ? "Semua kategori" : c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {portal.catalog.map((item) => (
            <Card key={item.productId} className="p-3 flex flex-col gap-2">
              <div className="font-medium text-sm leading-tight line-clamp-2">{item.name}</div>
              <div className="text-[11px] text-muted-foreground">{item.sku}</div>
              <div className="text-sm font-semibold">
                {rupiah(item.sellingPrice)}
                <span className="text-xs font-normal text-muted-foreground">/{item.unit}</span>
              </div>
              <Badge variant="secondary" className={cn("text-[10px] w-fit", STOCK_STYLES[item.stockLabel])}>
                {item.stockLabelText}
              </Badge>
              <Button
                size="sm"
                className="mt-auto"
                disabled={item.stockLabel === "out"}
                onClick={() => {
                  portal.addToCart(item);
                  toast.success(`${item.name} ditambahkan`);
                }}
              >
                {item.stockLabel === "out" ? "Beritahu Saya" : "+ Pesan"}
              </Button>
            </Card>
          ))}
        </div>

        {portal.catalog.length === 0 && (
          <p className="text-center text-muted-foreground py-12">Produk tidak ditemukan</p>
        )}
      </div>

      <PortalAuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        onLogin={(email, password) => {
          const r = portal.login(email, password);
          if (r.ok) toast.success(`Selamat datang, ${r.account?.name}`);
          return r;
        }}
        onRegister={(name, email, phone, password) => {
          const r = portal.register(name, email, phone, password);
          if (r.ok) toast.success("Akun berhasil dibuat — silakan pesan");
          return r;
        }}
      />

      <PortalCartSheet
        open={cartOpen}
        onOpenChange={setCartOpen}
        cart={portal.cart}
        cartTotal={portal.cartTotal}
        account={portal.account}
        config={portal.config}
        activeBranch={portal.activeBranch}
        canUseTempo={portal.canUseTempo}
        onUpdateQty={portal.updateCartQty}
        onRemove={portal.removeFromCart}
        onRequireAuth={() => {
          setCartOpen(false);
          setAuthOpen(true);
        }}
        onSubmit={(address, notes, method) => {
          const r = portal.submitOrderWithNumber(address, notes, method);
          if (r.ok) toast.success(`Pesanan ${r.orderNumber} dikirim`);
          else toast.error(r.error);
          return r;
        }}
      />
    </PortalShell>
  );
}
