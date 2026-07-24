import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { rupiah } from "@/lib/format";
import { PORTAL_PAYMENT_LABELS } from "@/lib/portal-utils";
import type {
  CustomerPortalAccount,
  CustomerPortalConfig,
  PortalCartItem,
  PortalPaymentMethod,
} from "@/types/customer-portal";
import type { Branch } from "@/types/database";

interface PortalCartSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: PortalCartItem[];
  cartTotal: number;
  account: CustomerPortalAccount | null;
  config: CustomerPortalConfig;
  activeBranch: Branch | null;
  canUseTempo: boolean;
  onUpdateQty: (productId: string, qty: number) => void;
  onRemove: (productId: string) => void;
  onRequireAuth: () => void;
  onSubmit: (
    deliveryAddress: string,
    notes: string,
    paymentMethod: PortalPaymentMethod,
  ) => { ok: boolean; error?: string; orderNumber?: string };
}

export function PortalCartSheet({
  open,
  onOpenChange,
  cart,
  cartTotal,
  account,
  config,
  activeBranch,
  canUseTempo,
  onUpdateQty,
  onRemove,
  onRequireAuth,
  onSubmit,
}: PortalCartSheetProps) {
  const [step, setStep] = useState<"cart" | "checkout">("cart");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PortalPaymentMethod>("transfer");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("cart");
      setError(null);
      setSuccess(null);
    }
  }, [open]);

  const handleCheckout = () => {
    if (!account) {
      onRequireAuth();
      return;
    }
    setStep("checkout");
    setError(null);
  };

  const handleSubmit = () => {
    const r = onSubmit(address, notes, paymentMethod);
    if (!r.ok) {
      setError(r.error ?? "Gagal mengirim pesanan");
      return;
    }
    setSuccess(`Pesanan ${r.orderNumber ?? ""} berhasil dikirim!`);
    setStep("cart");
    setAddress("");
    setNotes("");
    window.setTimeout(() => {
      setSuccess(null);
      onOpenChange(false);
    }, 2000);
  };

  const paymentOptions: PortalPaymentMethod[] = [];
  if (config.paymentMethods.transfer.enabled) paymentOptions.push("transfer");
  if (config.paymentMethods.gopay.enabled) paymentOptions.push("gopay");
  if (canUseTempo) paymentOptions.push("tempo");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>{step === "cart" ? "Keranjang" : "Checkout"}</SheetTitle>
        </SheetHeader>

        {success && (
          <div className="rounded-lg bg-success/15 text-success text-sm p-3">{success}</div>
        )}

        {step === "cart" ? (
          <>
            <div className="flex-1 overflow-y-auto space-y-3 py-2">
              {cart.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Keranjang kosong</p>
              ) : (
                cart.map((item) => (
                  <div key={item.productId} className="border rounded-lg p-3 space-y-2">
                    <div className="font-medium text-sm">{item.productName}</div>
                    <div className="text-xs text-muted-foreground">
                      {rupiah(item.sellingPrice)} / {item.unit}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onUpdateQty(item.productId, Math.max(1, item.qty - 1))}
                        >
                          −
                        </Button>
                        <span className="w-8 text-center text-sm">{item.qty}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onUpdateQty(item.productId, item.qty + 1)}
                        >
                          +
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {rupiah(item.sellingPrice * item.qty)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive h-7"
                          onClick={() => onRemove(item.productId)}
                        >
                          Hapus
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <SheetFooter className="flex-col gap-2 sm:flex-col border-t pt-4">
              <div className="flex justify-between w-full font-semibold">
                <span>Total</span>
                <span>{rupiah(cartTotal)}</span>
              </div>
              <Button
                className="w-full bg-gradient-primary"
                disabled={cart.length === 0}
                onClick={handleCheckout}
              >
                Lanjut Checkout
              </Button>
            </SheetFooter>
          </>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-3 py-2">
              {activeBranch && (
                <p className="text-xs text-muted-foreground">
                  Cabang: <strong>{activeBranch.name}</strong>
                  {activeBranch.address && <> · {activeBranch.address}</>}
                </p>
              )}
              <div className="space-y-1.5">
                <Label>Alamat pengiriman / proyek</Label>
                <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label>Catatan (opsional)</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Metode bayar</Label>
                {paymentOptions.map((m) => (
                  <label
                    key={m}
                    className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer text-sm ${
                      paymentMethod === m ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <input
                      type="radio"
                      checked={paymentMethod === m}
                      onChange={() => setPaymentMethod(m)}
                    />
                    {PORTAL_PAYMENT_LABELS[m]}
                  </label>
                ))}
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
                <div className="flex justify-between font-semibold text-sm">
                  <span>Total pesanan</span>
                  <span>{rupiah(cartTotal)}</span>
                </div>
                {paymentMethod === "transfer" && (
                  <p className="text-muted-foreground pt-1">
                    Setelah toko menyetujui, transfer ke{" "}
                    {config.paymentMethods.transfer.bankName}{" "}
                    {config.paymentMethods.transfer.accountNumber}
                  </p>
                )}
                {paymentMethod === "gopay" && (
                  <p className="text-muted-foreground pt-1">
                    Setelah disetujui, bayar ke GoPay {config.paymentMethods.gopay.merchantPhone}
                  </p>
                )}
                {paymentMethod === "tempo" && (
                  <p className="text-muted-foreground pt-1">
                    Pesanan langsung diproses — tagihan masuk piutang sesuai termin member.
                  </p>
                )}
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <SheetFooter className="flex-col gap-2 sm:flex-col border-t pt-4">
              <Button variant="outline" className="w-full" onClick={() => setStep("cart")}>
                Kembali
              </Button>
              <Button className="w-full bg-gradient-primary" onClick={handleSubmit}>
                Kirim Pesanan
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
