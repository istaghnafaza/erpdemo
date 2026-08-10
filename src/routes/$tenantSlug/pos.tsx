import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { usePos } from "@/hooks/usePos";
import { useIsMobile } from "@/hooks/use-mobile";
import { OpenShiftModal } from "@/components/pos/OpenShiftModal";
import { CloseShiftModal } from "@/components/pos/CloseShiftModal";
import { ProductCatalog } from "@/components/pos/ProductCatalog";
import { PosCartColumn } from "@/components/pos/PosCartColumn";
import { ReceiptModal } from "@/components/pos/ReceiptModal";
import { TakeoverModal } from "@/components/pos/TakeoverModal";
import { CustomerFormDialog } from "@/components/customers/CustomerFormDialog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { rupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requireAuth, requireRole } from "@/routes/$tenantSlug";
import { toast } from "sonner";

export const Route = createFileRoute("/$tenantSlug/pos")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireRole(params.tenantSlug, ["owner", "manager", "cashier"]);
  },
  head: () => ({
    meta: [
      { title: "POS Kasir — SEPS" },
      { name: "description", content: "Transaksi cepat, harga terkunci, struk otomatis tercetak." },
    ],
  }),
  component: POSPage,
});

function POSPage() {
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [showTakeover, setShowTakeover] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [cartBump, setCartBump] = useState(false);
  const isMobile = useIsMobile();

  const {
    user,
    isOnline,
    branch,
    activeSession,
    sessionLoading,
    sessionError,
    openSession,
    closeSession,
    catalog,
    catalogLoading,
    categories,
    customers,
    customerFormOpen,
    setCustomerFormOpen,
    customerSaving,
    customerTierOptions,
    openAddCustomer,
    handleCustomerFormSubmit,
    carts,
    activeCartIndex,
    activeCart,
    activeCartSubtotal,
    activeCartTotal,
    activeCartDiscountAmount,
    addCart,
    switchCart,
    holdActiveCart,
    clearActiveCart,
    heldCarts,
    takeover,
    addProductToCart,
    updateActiveItemQty,
    removeActiveItem,
    setActiveDiscount,
    setActiveCustomer,
    setActiveNotes,
    activeOrderFulfillmentType,
    setActiveOrderFulfillmentType,
    activeDeliverySites,
    customerSegment,
    lastUsedSiteId,
    setActiveDeliverySite,
    setActiveManualDeliveryAddress,
    saveNewDeliverySiteFromPos,
    activePartialShip,
    setActivePartialShipLine,
    toggleActiveItemSoLine,
    isProcessing,
    lastReceipt,
    pay,
    clearReceipt,
    setActiveReturnOffset,
    tenantId,
    branchId,
  } = usePos();

  const cartItemCount = useMemo(
    () => activeCart.items.reduce((sum, item) => sum + item.qty, 0),
    [activeCart.items],
  );

  async function handlePay(method: Parameters<typeof pay>[0], amountPaid: number) {
    const result = await pay(method, amountPaid);
    if (!result.success) {
      toast.error(result.error ?? "Pembayaran gagal");
      return result;
    }
    if (isMobile) {
      setMobileCartOpen(false);
    }
    return result;
  }

  function handleProductAdded() {
    if (isMobile) {
      setCartBump(true);
      window.setTimeout(() => setCartBump(false), 350);
    }
  }

  const cartColumnProps = {
    carts,
    activeCartIndex,
    activeCart,
    activeCartSubtotal,
    activeCartTotal,
    activeCartDiscountAmount,
    customers,
    heldCarts,
    isProcessing,
    isOnline,
    activeOrderFulfillmentType,
    partialShip: activePartialShip,
    activeDeliverySites,
    customerSegment,
    lastUsedSiteId,
    onSwitchCart: switchCart,
    onAddCart: addCart,
    onUpdateQty: updateActiveItemQty,
    onRemoveItem: removeActiveItem,
    onSetDiscount: setActiveDiscount,
    onSetCustomer: setActiveCustomer,
    onAddCustomer: openAddCustomer,
    onSetDeliverySite: setActiveDeliverySite,
    onManualDeliveryAddressChange: setActiveManualDeliveryAddress,
    onSaveNewDeliverySite: saveNewDeliverySiteFromPos,
    onSetNotes: setActiveNotes,
    onHold: holdActiveCart,
    onClear: clearActiveCart,
    onOpenTakeover: () => setShowTakeover(true),
    onOrderFulfillmentTypeChange: setActiveOrderFulfillmentType,
    onPartialShipLineChange: setActivePartialShipLine,
    onToggleItemSoLine: toggleActiveItemSoLine,
    onPay: handlePay,
    tenantId,
    branchId: branch?.id ?? branchId,
    onReturnOffsetChange: setActiveReturnOffset,
  };

  if (!user) return null;

  if (!branch) {
    return (
      <AppShell
        title="POS Kasir"
        subtitle="Sistem kasir terpadu — harga terkunci, transaksi tercatat"
      />
    );
  }

  const hasActiveCarts = carts.some((c) => c.items.length > 0 && !c.isHeld);

  const handleCloseShift = async (actualBalance: number, notes?: string) => {
    const ok = await closeSession(actualBalance, notes);
    if (ok) {
      setShowCloseShift(false);
      toast.success("Shift ditutup");
    } else {
      toast.error("Gagal menutup shift — pastikan tidak ada keranjang aktif");
    }
  };

  if (!activeSession) {
    return (
      <AppShell
        title="POS Kasir"
        subtitle="Sistem kasir terpadu — harga terkunci, transaksi tercatat"
      >
        <OpenShiftModal
          open
          cashierName={user.name}
          branchName={branch.name}
          isLoading={sessionLoading}
          error={sessionError}
          onConfirm={(balance) => void openSession(balance)}
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="POS Kasir"
      subtitle={`Shift aktif · Kas awal ${rupiah(activeSession.opening_cash_balance)}`}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={cn("lg:hidden relative gap-2", cartBump && "animate-pos-cart-bump")}
            onClick={() => setMobileCartOpen(true)}
          >
            <ShoppingCart className="h-4 w-4" />
            Keranjang
            {cartItemCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[1.125rem] h-[1.125rem] rounded-full bg-primary text-primary-foreground text-[10px] font-bold grid place-items-center px-1">
                {cartItemCount > 99 ? "99+" : cartItemCount}
              </span>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowCloseShift(true)}>
            Tutup Shift
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4 -mt-2">
        <ProductCatalog
          catalog={catalog}
          categories={categories}
          isLoading={catalogLoading}
          onAdd={(item, sellUnitId, asSoLine) =>
            addProductToCart(item, 1, sellUnitId, asSoLine)
          }
          onAdded={handleProductAdded}
        />

        <div className="hidden lg:flex flex-col gap-4">
          <PosCartColumn {...cartColumnProps} />
        </div>
      </div>

      <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <SheetContent
          side="bottom"
          className="lg:hidden h-[min(92vh,900px)] p-0 flex flex-col rounded-t-2xl [&>button]:top-3 [&>button]:right-3"
        >
          <SheetHeader className="px-4 pt-4 pb-2 border-b shrink-0 text-left">
            <SheetTitle className="flex items-center justify-between gap-3 pr-8">
              <span>Keranjang</span>
              {cartItemCount > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  {cartItemCount} item · {rupiah(activeCartTotal, { compact: true })}
                </span>
              )}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
            <PosCartColumn {...cartColumnProps} />
          </div>
        </SheetContent>
      </Sheet>

      <ReceiptModal receipt={lastReceipt} onClose={clearReceipt} onNewTransaction={clearReceipt} />

      <CustomerFormDialog
        open={customerFormOpen}
        onOpenChange={setCustomerFormOpen}
        editing={null}
        customerTierOptions={customerTierOptions}
        onSubmit={(values) => void handleCustomerFormSubmit(values)}
      />

      <TakeoverModal
        open={showTakeover}
        onOpenChange={setShowTakeover}
        heldCarts={heldCarts}
        onTakeover={(cart) => {
          const ok = takeover(cart);
          if (ok) {
            toast.success(`Keranjang diambil alih dari ${cart.cashierName}`);
            setShowTakeover(false);
          } else {
            toast.error("Semua slot keranjang penuh — hold atau selesaikan salah satu dulu");
          }
        }}
      />

      <CloseShiftModal
        open={showCloseShift}
        onOpenChange={setShowCloseShift}
        session={activeSession}
        isLoading={sessionLoading}
        hasActiveCarts={hasActiveCarts}
        onConfirm={handleCloseShift}
      />
    </AppShell>
  );
}
