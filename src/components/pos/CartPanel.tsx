import { useMemo, useState } from "react";
import {
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  UserCircle,
  Lock,
  RefreshCw,
  Percent,
  MapPin,
  Package,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { PosLinePricingBreakdown } from "@/components/pos/PosLinePricingBreakdown";
import { rupiah } from "@/lib/format";
import { cartTierDiscountTotal } from "@/lib/pos-line-pricing-display";
import { orderRequiresPhysicalDelivery } from "@/lib/sales-transaction-utils";
import { DeliverySiteSelector } from "@/components/pos/DeliverySiteSelector";
import type { ActiveCart } from "@/stores/pos.store";
import type { Customer } from "@/types/database";
import type {
  CustomerDeliverySite,
  CustomerSegment,
  DeliverySiteType,
} from "@/types/customer-delivery-sites";
import type { OrderFulfillmentType } from "@/types/sales-transactions";

// -----------------------------------------------------------------------------
// CartPanel — active cart line items + discount + customer + notes (middle
// panel, ~40%).
// -----------------------------------------------------------------------------

export interface CartPanelProps {
  cart: ActiveCart;
  subtotal: number;
  discountAmount: number;
  customers: Customer[];
  deliverySites: CustomerDeliverySite[];
  customerSegment: CustomerSegment | null;
  orderFulfillmentType: OrderFulfillmentType;
  lastUsedSiteId: string | null;
  heldCartCount: number;
  onUpdateQty: (itemIndex: number, qty: number) => void;
  onRemoveItem: (itemIndex: number) => void;
  onChangeSellUnit?: (itemIndex: number, sellUnitId: string) => void;
  onSetDiscount: (percent: number) => void;
  onSetCustomer: (customer: Customer | null) => void;
  onAddCustomer: () => void;
  onSetDeliverySite: (siteId: string) => void;
  onManualDeliveryAddressChange: (address: string) => void;
  onSaveNewDeliverySite: (payload: {
    label: string;
    address: string;
    siteType: DeliverySiteType;
  }) => void;
  onToggleItemSoLine: (itemIndex: number) => void;
  onSetNotes: (notes: string) => void;
  onHold: () => void;
  onClear: () => void;
  onOpenTakeover: () => void;
}

export function CartPanel({
  cart,
  subtotal,
  discountAmount,
  customers,
  deliverySites,
  customerSegment,
  orderFulfillmentType,
  lastUsedSiteId,
  heldCartCount,
  onUpdateQty,
  onRemoveItem,
  onChangeSellUnit,
  onSetDiscount,
  onSetCustomer,
  onAddCustomer,
  onSetDeliverySite,
  onManualDeliveryAddressChange,
  onSaveNewDeliverySite,
  onToggleItemSoLine,
  onSetNotes,
  onHold,
  onClear,
  onOpenTakeover,
}: CartPanelProps) {
  const [discountMode, setDiscountMode] = useState<"percent" | "amount">("percent");
  const [discountInput, setDiscountInput] = useState("");

  const tierDiscountTotal = useMemo(() => cartTierDiscountTotal(cart.items), [cart.items]);

  const customerOptions = useMemo(
    () => [
      { value: "walk-in", label: "Pelanggan Umum" },
      ...customers.map((c) => ({
        value: c.id,
        label: `${c.name}${c.type === "credit" ? " (Kredit)" : ""}`,
      })),
    ],
    [customers],
  );

  const handleDiscountChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    setDiscountInput(digits);
    const value = Number(digits) || 0;
    if (discountMode === "percent") {
      onSetDiscount(value);
    } else {
      const pct = subtotal > 0 ? Math.min(100, (value / subtotal) * 100) : 0;
      onSetDiscount(pct);
    }
  };

  return (
    <>
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center gap-2">
          <UserCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
          <SearchableCombobox
            value={cart.customer?.id ?? "walk-in"}
            options={customerOptions}
            placeholder="Pelanggan Umum"
            searchPlaceholder="Cari pelanggan..."
            emptyText="Pelanggan tidak ditemukan."
            className="h-9 flex-1"
            onChange={(v) =>
              onSetCustomer(v === "walk-in" ? null : (customers.find((c) => c.id === v) ?? null))
            }
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            title="Tambah pelanggan baru"
            onClick={onAddCustomer}
          >
            <UserPlus className="h-4 w-4" />
          </Button>
        </div>

        {cart.customer && (
          <DeliverySiteSelector
            sites={deliverySites}
            segment={customerSegment}
            lastUsedSiteId={lastUsedSiteId}
            selectedSiteId={cart.deliverySiteId}
            isManualMode={cart.isManualDeliveryAddress}
            manualAddress={cart.isManualDeliveryAddress ? (cart.deliveryAddress ?? "") : ""}
            resolvedAddress={cart.deliveryAddress}
            canSaveNewSite
            onSelectSite={onSetDeliverySite}
            onManualAddressChange={onManualDeliveryAddressChange}
            onSaveNewSite={onSaveNewDeliverySite}
          />
        )}

        {!cart.customer && orderRequiresPhysicalDelivery(orderFulfillmentType) && (
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              Alamat pengiriman
            </Label>
            <Textarea
              value={cart.deliveryAddress ?? ""}
              onChange={(e) => onManualDeliveryAddressChange(e.target.value)}
              placeholder="Ketik alamat tujuan kirim..."
              className="min-h-[60px] text-xs resize-none"
            />
            <p className="text-[10px] text-muted-foreground">
              Wajib untuk Pelanggan Umum dengan order Di Kirim
            </p>
          </div>
        )}

        {heldCartCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-xs"
            onClick={onOpenTakeover}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Ambil Alih Pesanan ({heldCartCount})
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px]">
        {cart.items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-10 text-muted-foreground">
            <ShoppingBag className="h-12 w-12 mb-3 opacity-30" />
            <div className="text-sm">Keranjang masih kosong</div>
            <div className="text-xs mt-1">Klik produk di katalog</div>
          </div>
        ) : (
          cart.items.map((item, i) => (
            <div
              key={`${item.product_id}-${item.stock_source}-${item.is_so_line ? "so" : "stk"}-${i}`}
              className={cn(
                "rounded-lg border p-2.5 group",
                item.is_so_line && "border-indigo-300/60 bg-indigo-50/40 dark:bg-indigo-950/20",
              )}
            >
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="text-sm font-medium leading-tight truncate">{item.name}</div>
                    {item.is_so_line && (
                      <Badge
                        variant="secondary"
                        className="text-[9px] px-1 py-0 shrink-0 bg-indigo-100 text-indigo-700"
                      >
                        SO
                      </Badge>
                    )}
                  </div>
                  <PosLinePricingBreakdown item={item} variant="cart" className="mt-1" />
                  {item.sell_unit_label && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Satuan jual: {item.sell_unit_label}
                      {item.qty_base != null && item.stock_unit
                        ? ` · potong stok ${item.qty_base} ${item.stock_unit}`
                        : ""}
                    </div>
                  )}
                  {item.is_so_line && (
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Kirim langsung / indent — stok toko tidak dipotong
                    </div>
                  )}
                </div>
                <div className="flex items-start gap-0.5 shrink-0">
                  <Button
                    type="button"
                    size="icon"
                    variant={item.is_so_line ? "default" : "outline"}
                    className={cn(
                      "h-7 w-7",
                      item.is_so_line && "bg-indigo-600 hover:bg-indigo-700",
                    )}
                    title={
                      item.is_so_line
                        ? "Batalkan Sales Order — ambil dari stok"
                        : "Tandai Sales Order (indent) — tidak kurangi stok sekarang"
                    }
                    onClick={() => onToggleItemSoLine(i)}
                  >
                    <Package className="h-3.5 w-3.5" />
                  </Button>
                  <button
                    type="button"
                    onClick={() => onRemoveItem(i)}
                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <div className="flex flex-col gap-1">
                  {(item.preset_qty?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.preset_qty!.map((p) => (
                        <Button
                          key={`${item.product_id}-preset-${p}`}
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 px-1.5 text-[10px]"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onUpdateQty(i, p);
                          }}
                        >
                          {p} {item.unit}
                        </Button>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      onClick={() =>
                        onUpdateQty(
                          i,
                          item.allow_fraction || item.sell_unit_id
                            ? Math.max(0.25, Math.round((item.qty - 0.25) * 100) / 100)
                            : item.qty - 1,
                        )
                      }
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={item.allow_fraction || item.sell_unit_id ? 0.01 : 1}
                      step={item.allow_fraction || item.sell_unit_id ? "0.25" : "1"}
                      max={
                        item.is_so_line
                          ? undefined
                          : item.factor_to_base && item.factor_to_base > 0
                            ? item.available_stock / item.factor_to_base
                            : item.available_stock
                      }
                      value={item.qty}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") return;
                        const v = Number(raw);
                        if (!Number.isFinite(v) || v <= 0) return;
                        onUpdateQty(i, v);
                      }}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        const allowFrac = Boolean(item.allow_fraction || item.sell_unit_id);
                        const maxSell =
                          item.factor_to_base && item.factor_to_base > 0
                            ? item.available_stock / item.factor_to_base
                            : item.available_stock;
                        if (!Number.isFinite(v) || v <= 0) {
                          onUpdateQty(i, allowFrac ? 0.25 : 1);
                        } else if (!item.is_so_line && v > maxSell) {
                          onUpdateQty(i, maxSell);
                        } else {
                          onUpdateQty(i, v);
                        }
                      }}
                      className="h-7 w-14 px-1 text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      aria-label={`Qty ${item.name}`}
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7"
                      disabled={
                        !item.is_so_line &&
                        (item.factor_to_base && item.factor_to_base > 0
                          ? item.qty_base ?? item.qty * item.factor_to_base
                          : item.qty) >= item.available_stock
                      }
                      onClick={() =>
                        onUpdateQty(
                          i,
                          item.allow_fraction || item.sell_unit_id
                            ? Math.round((item.qty + 0.25) * 100) / 100
                            : item.qty + 1,
                        )
                      }
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>
                  </div>
                </div>
                <div className="text-sm font-semibold">{rupiah(item.subtotal)}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t p-3 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border overflow-hidden shrink-0">
            <button
              onClick={() => setDiscountMode("percent")}
              className={`px-2 h-8 text-xs font-medium ${discountMode === "percent" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              <Percent className="h-3 w-3" />
            </button>
            <button
              onClick={() => setDiscountMode("amount")}
              className={`px-2 h-8 text-xs font-medium ${discountMode === "amount" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              Rp
            </button>
          </div>
          <Input
            placeholder={discountMode === "percent" ? "Diskon keranjang %" : "Diskon keranjang Rp"}
            inputMode="numeric"
            value={discountInput}
            onChange={(e) => handleDiscountChange(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <Textarea
          placeholder="Catatan order (opsional)"
          value={cart.notes}
          onChange={(e) => onSetNotes(e.target.value)}
          className="h-16 text-sm resize-none"
        />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={onHold} disabled={cart.items.length === 0}>
            <Lock className="h-3.5 w-3.5 mr-1.5" /> Hold
          </Button>
          <Button variant="outline" size="sm" onClick={onClear} disabled={cart.items.length === 0}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Kosongkan
          </Button>
        </div>
        {tierDiscountTotal > 0 && (
          <div className="flex justify-between text-xs text-destructive/90 pt-1">
            <span>Diskon tier barang</span>
            <span>−{rupiah(tierDiscountTotal)}</span>
          </div>
        )}
        {discountAmount > 0 && (
          <div className="flex justify-between text-xs text-destructive pt-1">
            <span>Diskon keranjang</span>
            <span>−{rupiah(discountAmount)}</span>
          </div>
        )}
      </div>
    </>
  );
}
