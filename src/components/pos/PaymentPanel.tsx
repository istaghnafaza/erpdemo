import { useEffect, useState } from "react";

import { Banknote, CreditCard, QrCode, ArrowRightLeft, Receipt as ReceiptIcon } from "lucide-react";

import { Card } from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { rupiah } from "@/lib/format";

import { cn } from "@/lib/utils";

import { validatePartialShipment } from "@/lib/pos-partial-shipment";

import { orderRequiresPhysicalDelivery } from "@/lib/sales-transaction-utils";

import { hasCartSoLines } from "@/lib/pos-so-checkout";

import type { PartialShipLine } from "@/lib/pos-partial-shipment";

import { PartialShipmentPanel } from "@/components/pos/PartialShipmentPanel";
import { CheckoutReviewDialog } from "@/components/pos/CheckoutReviewDialog";
import { ReturnOffsetPicker } from "@/components/pos/ReturnOffsetPicker";
import { ReturnOffsetSummary } from "@/components/pos/ReturnOffsetLines";
import { cartReturnOffsetAmount } from "@/stores/pos.store";
import type { PosReturnOffset } from "@/lib/pos-return-offset";

import type { ActiveCart } from "@/stores/pos.store";

import type { PaymentMethod } from "@/types/app";

import type { OrderFulfillmentType } from "@/types/sales-transactions";



export interface PaymentPanelProps {

  cart: ActiveCart;

  subtotal: number;

  discountAmount: number;

  total: number;

  isProcessing: boolean;

  isOnline: boolean;

  orderFulfillmentType: OrderFulfillmentType;

  onOrderFulfillmentTypeChange: (type: OrderFulfillmentType) => void;

  partialShip: PartialShipLine[];

  onPartialShipLineChange: (

    itemIndex: number,

    patch: { selected?: boolean; shipQty?: number },

  ) => void;

  onPay: (
    method: PaymentMethod,
    amountPaid: number,
  ) => void | Promise<{ success: boolean; error?: string }>;
  tenantId?: string;
  branchId?: string;
  onReturnOffsetChange?: (offset: PosReturnOffset | null) => void;
}



const ORDER_TYPES: { value: OrderFulfillmentType; label: string }[] = [

  { value: "cod", label: "COD" },

  { value: "shipped", label: "Di Kirim" },

  { value: "partial_shipped", label: "Di Kirim Sebagian" },

];



const METHODS: { m: PaymentMethod; label: string; icon: typeof Banknote }[] = [

  { m: "cash", label: "Tunai", icon: Banknote },

  { m: "card", label: "Kartu", icon: CreditCard },

  { m: "qris_edc", label: "QRIS", icon: QrCode },

  { m: "transfer", label: "Transfer", icon: ArrowRightLeft },

  { m: "credit", label: "Piutang", icon: ReceiptIcon },

];



const QRIS_PROVIDERS: { value: PaymentMethod; label: string }[] = [

  { value: "qris_edc", label: "EDC" },

  { value: "qris_gopay", label: "GoPay" },

  { value: "qris_ovo", label: "OVO" },

  { value: "qris_other", label: "Lainnya" },

];



const QUICK_CASH = [50000, 100000, 200000];



export function PaymentPanel({

  cart,

  subtotal,

  discountAmount,

  total,

  isProcessing,

  isOnline,

  orderFulfillmentType,

  onOrderFulfillmentTypeChange,

  partialShip,

  onPartialShipLineChange,

  onPay,

  tenantId,

  branchId,

  onReturnOffsetChange,

}: PaymentPanelProps) {

  const [method, setMethod] = useState<PaymentMethod>("cash");

  const [cashGiven, setCashGiven] = useState("");

  const [creditDp, setCreditDp] = useState("");

  const [reviewOpen, setReviewOpen] = useState(false);

  const isCartEmpty = cart.items.length === 0;

  const hasSoLines = hasCartSoLines(cart.items);

  const soLineCount = cart.items.filter((i) => i.is_so_line).length;

  const returnOffsetAmount = cartReturnOffsetAmount(cart);



  useEffect(() => {

    setCashGiven("");

    setCreditDp("");

  }, [isCartEmpty]);



  useEffect(() => {

    if (hasSoLines && orderFulfillmentType === "cod") {

      onOrderFulfillmentTypeChange("shipped");

    }

  }, [hasSoLines, orderFulfillmentType, onOrderFulfillmentTypeChange]);



  const isQrisMethod = method.startsWith("qris_");

  const cashGivenNum = Number(cashGiven) || 0;

  const creditDpNum = Number(creditDp) || 0;

  const change = cashGivenNum - total;

  const creditDebt = Math.max(0, total - creditDpNum);



  const creditAvailable = cart.customer

    ? cart.customer.credit_limit - cart.customer.outstanding_debt

    : 0;



  const partialShipmentOk =

    orderFulfillmentType !== "partial_shipped" ||

    validatePartialShipment(cart.items, partialShip).ok;



  const shippingAddressOk =

    !orderRequiresPhysicalDelivery(orderFulfillmentType) ||

    !!cart.deliveryAddress?.trim();



  const canPay =

    cart.items.length > 0 &&

    total > 0 &&

    partialShipmentOk &&

    shippingAddressOk &&

    (method === "cash" ? cashGivenNum >= total : true) &&

    (method === "credit"

      ? !!cart.customer &&

        cart.customer.type === "credit" &&

        creditDpNum >= 0 &&

        creditDpNum <= total &&

        creditDebt <= creditAvailable

      : true);



  const amountPaid =
    method === "cash" ? cashGivenNum : method === "credit" ? creditDpNum : total;

  const handleOpenReview = () => {
    if (!canPay) return;
    setReviewOpen(true);
  };

  const handleConfirmPay = async () => {
    if (!canPay) return;
    const result = await onPay(method, amountPaid);
    if (!result || result.success) {
      setReviewOpen(false);
      setCashGiven("");
      setCreditDp("");
    }
  };



  return (

    <Card className="p-4 space-y-4 lg:sticky lg:top-20">

      <div className="space-y-1 text-sm rounded-lg border p-3 bg-muted/20">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{rupiah(subtotal)}</span>
        </div>

        {discountAmount > 0 && (
          <div className="flex justify-between text-destructive">
            <span>Diskon keranjang</span>
            <span>−{rupiah(discountAmount)}</span>
          </div>
        )}

        {returnOffsetAmount > 0 && cart.returnOffset && (
          <ReturnOffsetSummary offset={cart.returnOffset} />
        )}

        <div className="flex justify-between font-bold text-base pt-2 border-t">
          <span>Total Tagihan</span>
          <span>{rupiah(total)}</span>
        </div>
      </div>

      {tenantId && branchId && onReturnOffsetChange && (
        <ReturnOffsetPicker
          tenantId={tenantId}
          branchId={branchId}
          selected={cart.returnOffset}
          onSelect={onReturnOffsetChange}
        />
      )}

      <div>

        <div className="rounded-lg bg-warning/15 text-warning-foreground text-xs p-2.5">

          Mode offline aktif — transaksi akan disimpan lokal dan disinkronkan otomatis saat online

          kembali.

        </div>

      )}



      <div>

        <Label className="text-xs">Keterangan Order</Label>

        <div className="grid grid-cols-1 gap-2 mt-2">

          {ORDER_TYPES.map(({ value, label }) => {

            const codBlocked = value === "cod" && hasSoLines;

            return (

              <button

                key={value}

                type="button"

                disabled={isCartEmpty || codBlocked}

                onClick={() => onOrderFulfillmentTypeChange(value)}

                className={cn(

                  "rounded-lg border px-3 py-2 text-left text-sm transition-colors",

                  orderFulfillmentType === value

                    ? "border-primary bg-primary/10 text-primary font-medium"

                    : "border-border hover:bg-muted/50 text-muted-foreground",

                  (isCartEmpty || codBlocked) && "opacity-50 cursor-not-allowed",

                )}

                title={codBlocked ? "Tidak tersedia jika ada barang Sales Order" : undefined}

              >

                {label}

                {codBlocked && (

                  <span className="block text-[10px] text-muted-foreground font-normal mt-0.5">

                    Tidak untuk barang SO

                  </span>

                )}

              </button>

            );

          })}

        </div>

      </div>



      {orderFulfillmentType === "partial_shipped" && !isCartEmpty && (

        <PartialShipmentPanel

          items={cart.items}

          partialShip={partialShip}

          onLineChange={onPartialShipLineChange}

        />

      )}



      {soLineCount > 0 && (

        <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 dark:bg-indigo-950/30 px-3 py-2 text-xs text-indigo-900 dark:text-indigo-100">

          <span className="font-medium">{soLineCount} barang</span> masuk Sales Order setelah

          checkout — satu struk, fulfillment di modul SO.

        </div>

      )}



      {orderRequiresPhysicalDelivery(orderFulfillmentType) && !shippingAddressOk && !isCartEmpty && (

        <p className="text-xs text-destructive">

          Isi alamat pengiriman di panel keranjang (lokasi/proyek atau alamat manual).

        </p>

      )}



      <div>

        <Label className="text-xs">Metode Pembayaran</Label>

        <div className="grid grid-cols-3 gap-2 mt-2">

          {METHODS.map(({ m, label, icon: I }) => {

            const active =

              m === "credit"

                ? method === "credit"

                : m === method || (m === "qris_edc" && isQrisMethod);

            return (

              <button

                key={m}

                onClick={() => setMethod(m)}

                className={cn(

                  "flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-medium transition-all",

                  active ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted",

                )}

              >

                <I className="h-4 w-4" />

                {label}

              </button>

            );

          })}

        </div>

      </div>



      {isQrisMethod && (

        <div className="grid grid-cols-4 gap-1.5">

          {QRIS_PROVIDERS.map((p) => (

            <button

              key={p.value}

              onClick={() => setMethod(p.value)}

              className={cn(

                "py-1.5 rounded-md text-[11px] font-medium border transition-all",

                method === p.value ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted",

              )}

            >

              {p.label}

            </button>

          ))}

        </div>

      )}



      {isQrisMethod && (

        <div className="bg-muted rounded-lg p-4 text-center">

          <div className="h-24 w-24 mx-auto bg-white rounded-lg grid place-items-center border-2 border-dashed">

            <QrCode className="h-12 w-12 text-muted-foreground" />

          </div>

          <p className="text-xs text-muted-foreground mt-2">Scan QR untuk membayar</p>

        </div>

      )}



      {method === "cash" && (

        <div className="space-y-2">

          <Label className="text-xs">Uang Diterima (Rp)</Label>

          <Input

            inputMode="numeric"

            value={cashGiven ? Number(cashGiven).toLocaleString("id-ID") : ""}

            onChange={(e) => setCashGiven(e.target.value.replace(/\D/g, ""))}

            placeholder="0"

            className="text-lg h-11"

          />

          <div className="flex gap-2 flex-wrap">

            {QUICK_CASH.map((v) => (

              <button

                key={v}

                onClick={() => setCashGiven(String(Math.ceil((cashGivenNum + v) / 1000) * 1000))}

                className="px-2.5 py-1 text-xs rounded-md bg-muted hover:bg-primary hover:text-primary-foreground"

              >

                +{rupiah(v, { compact: true })}

              </button>

            ))}

            <button

              onClick={() => setCashGiven(String(total))}

              className="px-2.5 py-1 text-xs rounded-md bg-muted hover:bg-primary hover:text-primary-foreground"

            >

              Uang Pas

            </button>

          </div>

          {cashGivenNum > 0 && (

            <div

              className={cn(

                "rounded-lg p-3 flex justify-between items-center",

                change >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",

              )}

            >

              <span className="text-sm font-medium">{change >= 0 ? "Kembalian" : "Kurang"}</span>

              <span className="text-lg font-bold">{rupiah(Math.abs(change))}</span>

            </div>

          )}

        </div>

      )}



      {method === "credit" && (

        <div className="space-y-3">

          <div className="rounded-lg bg-muted p-3 text-xs space-y-1">

            {!cart.customer ? (

              <p className="text-destructive">

                Pilih pelanggan kredit di panel keranjang terlebih dahulu.

              </p>

            ) : cart.customer.type !== "credit" ? (

              <p className="text-destructive">Pelanggan ini bukan tipe kredit.</p>

            ) : (

              <>

                <div className="flex justify-between">

                  <span className="text-muted-foreground">Limit Kredit</span>

                  <span className="font-medium">{rupiah(cart.customer.credit_limit)}</span>

                </div>

                <div className="flex justify-between">

                  <span className="text-muted-foreground">Terpakai</span>

                  <span className="font-medium">{rupiah(cart.customer.outstanding_debt)}</span>

                </div>

                <div className="flex justify-between">

                  <span className="text-muted-foreground">Sisa Limit</span>

                  <span

                    className={cn(

                      "font-semibold",

                      creditAvailable < creditDebt ? "text-destructive" : "text-success",

                    )}

                  >

                    {rupiah(creditAvailable)}

                  </span>

                </div>

              </>

            )}

          </div>



          {cart.customer?.type === "credit" && (

            <div className="space-y-2">

              <Label className="text-xs">Down Payment / DP (Rp)</Label>

              <Input

                inputMode="numeric"

                value={creditDp ? Number(creditDp).toLocaleString("id-ID") : ""}

                onChange={(e) => setCreditDp(e.target.value.replace(/\D/g, ""))}

                placeholder="0 — kosongkan jika tanpa DP"

                className="text-lg h-11"

              />

              <div className="flex gap-2 flex-wrap">

                <button

                  type="button"

                  onClick={() => setCreditDp("0")}

                  className="px-2.5 py-1 text-xs rounded-md bg-muted hover:bg-primary hover:text-primary-foreground"

                >

                  Tanpa DP

                </button>

                <button

                  type="button"

                  onClick={() => setCreditDp(String(Math.round(total * 0.5)))}

                  className="px-2.5 py-1 text-xs rounded-md bg-muted hover:bg-primary hover:text-primary-foreground"

                >

                  50%

                </button>

                <button

                  type="button"

                  onClick={() => setCreditDp(String(total))}

                  className="px-2.5 py-1 text-xs rounded-md bg-muted hover:bg-primary hover:text-primary-foreground"

                >

                  Lunas (DP penuh)

                </button>

              </div>

              <div className="rounded-lg border p-3 text-xs space-y-1">

                <div className="flex justify-between">

                  <span className="text-muted-foreground">DP diterima</span>

                  <span className="font-medium">{rupiah(creditDpNum)}</span>

                </div>

                <div className="flex justify-between font-semibold">

                  <span>Sisa piutang</span>

                  <span>{rupiah(creditDebt)}</span>

                </div>

              </div>

            </div>

          )}

        </div>

      )}



      <Button

        onClick={handleOpenReview}

        disabled={!canPay || isProcessing}

        className="w-full bg-gradient-primary hover:opacity-90 shadow-glow h-12 text-base"

      >

        {isProcessing ? "Memproses..." : "Review Transaksi"}

      </Button>

      <CheckoutReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        cart={cart}
        subtotal={subtotal}
        discountAmount={discountAmount}
        total={total}
        orderFulfillmentType={orderFulfillmentType}
        paymentMethod={method}
        amountPaid={amountPaid}
        change={change}
        creditDebt={creditDebt}
        isProcessing={isProcessing}
        onConfirm={handleConfirmPay}
      />

    </Card>

  );

}


