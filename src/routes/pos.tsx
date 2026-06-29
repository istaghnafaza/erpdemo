import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { PRODUCTS, CATEGORIES, CUSTOMERS, stockStatus, type Product, type PaymentMethod } from "@/lib/mock-data";
import { rupiah, tanggal } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Plus, Minus, Trash2, Banknote, QrCode, ArrowRightLeft, Receipt as ReceiptIcon,
  X, ShoppingBag, UserCircle, Printer, Package2, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/pos")({
  head: () => ({
    meta: [
      { title: "POS Kasir — Simetri ERP" },
      { name: "description", content: "Transaksi cepat, harga terkunci, struk otomatis tercetak." },
    ],
  }),
  component: POSPage,
});

interface CartItem {
  sku: string;
  qty: number;
  discount: number; // percent
}

interface Cart {
  id: string;
  name: string;
  items: CartItem[];
  customerId?: string;
  totalDiscount: number; // percent
}

const newCart = (n: number): Cart => ({ id: `c${Date.now()}-${n}`, name: `Keranjang ${n}`, items: [], totalDiscount: 0 });

function POSPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!user) navigate({ to: "/login" }); }, [user, navigate]);

  const [shiftOpen, setShiftOpen] = useState(false);
  const [showShiftDialog, setShowShiftDialog] = useState(true);
  const [shiftCash, setShiftCash] = useState("500000");

  const [carts, setCarts] = useState<Cart[]>([newCart(1)]);
  const [activeCartId, setActiveCartId] = useState(carts[0].id);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("Semua");
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Tunai");
  const [cashGiven, setCashGiven] = useState("");
  const [lastReceipt, setLastReceipt] = useState<{ items: { name: string; qty: number; price: number }[]; total: number; method: PaymentMethod; change: number; invoice: string } | null>(null);

  if (!user) return null;

  const activeCart = carts.find((c) => c.id === activeCartId)!;

  const filteredProducts = useMemo(() => {
    return PRODUCTS.filter((p) => {
      if (category !== "Semua" && p.category !== category) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [search, category]);

  const updateCart = (fn: (c: Cart) => Cart) => {
    setCarts((cs) => cs.map((c) => (c.id === activeCartId ? fn(c) : c)));
  };

  const addToCart = (p: Product) => {
    updateCart((c) => {
      const existing = c.items.find((i) => i.sku === p.sku);
      if (existing) {
        return { ...c, items: c.items.map((i) => (i.sku === p.sku ? { ...i, qty: i.qty + 1 } : i)) };
      }
      return { ...c, items: [...c.items, { sku: p.sku, qty: 1, discount: 0 }] };
    });
  };

  const updateQty = (sku: string, delta: number) => {
    updateCart((c) => ({
      ...c,
      items: c.items
        .map((i) => (i.sku === sku ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0),
    }));
  };

  const removeItem = (sku: string) => {
    updateCart((c) => ({ ...c, items: c.items.filter((i) => i.sku !== sku) }));
  };

  const itemRows = activeCart.items.map((i) => {
    const p = PRODUCTS.find((x) => x.sku === i.sku)!;
    const subtotal = p.sellPrice * i.qty * (1 - i.discount / 100);
    return { ...i, product: p, subtotal };
  });

  const subtotal = itemRows.reduce((s, r) => s + r.subtotal, 0);
  const totalDiscountAmount = subtotal * (activeCart.totalDiscount / 100);
  const total = subtotal - totalDiscountAmount;
  const cashGivenNum = Number(cashGiven.replace(/\D/g, "")) || 0;
  const change = cashGivenNum - total;

  const handleAddCart = () => {
    const n = carts.length + 1;
    const c = newCart(n);
    setCarts([...carts, c]);
    setActiveCartId(c.id);
  };

  const handleCloseCart = (id: string) => {
    if (carts.length === 1) {
      setCarts([newCart(1)]);
      setActiveCartId(carts[0].id);
      return;
    }
    const idx = carts.findIndex((c) => c.id === id);
    const next = carts.filter((c) => c.id !== id);
    setCarts(next);
    if (id === activeCartId) setActiveCartId(next[Math.max(0, idx - 1)].id);
  };

  const handleCheckout = () => {
    if (itemRows.length === 0) return toast.error("Keranjang kosong");
    setShowCheckout(true);
    setPaymentMethod("Tunai");
    setCashGiven("");
  };

  const handleConfirmPayment = () => {
    if (paymentMethod === "Tunai" && cashGivenNum < total) {
      return toast.error("Uang tunai kurang");
    }
    const invoice = `TRX-2026-${String(1047 + Math.floor(Math.random() * 999)).padStart(4, "0")}`;
    setLastReceipt({
      items: itemRows.map((r) => ({ name: r.product.name, qty: r.qty, price: r.product.sellPrice })),
      total,
      method: paymentMethod,
      change: paymentMethod === "Tunai" ? Math.max(0, change) : 0,
      invoice,
    });
    setShowCheckout(false);
    updateCart((c) => ({ ...c, items: [], totalDiscount: 0 }));
    toast.success(`Transaksi ${invoice} berhasil`);
  };

  if (!shiftOpen && showShiftDialog) {
    return (
      <AppShell title="POS Kasir" subtitle="Sistem kasir terpadu — harga terkunci, transaksi tercatat">
        <Dialog open={showShiftDialog} onOpenChange={setShowShiftDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Buka Shift Kasir</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="rounded-lg bg-muted p-4 space-y-1.5">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Kasir</span><span className="font-medium">{user.name}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Mulai</span><span className="font-medium">{tanggal(new Date().toISOString(), { withTime: true })}</span></div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cash">Saldo kas awal (Rp)</Label>
                <Input id="cash" value={shiftCash} onChange={(e) => setShiftCash(e.target.value.replace(/\D/g, ""))} />
                <p className="text-xs text-muted-foreground">Total uang tunai di laci kasir saat ini.</p>
              </div>
            </div>
            <DialogFooter>
              <Button className="bg-gradient-primary w-full" onClick={() => { setShiftOpen(true); setShowShiftDialog(false); toast.success("Shift dibuka"); }}>
                Buka Shift
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="POS Kasir"
      subtitle={`Shift aktif · Kas awal ${rupiah(Number(shiftCash) || 0)}`}
      actions={
        <Button variant="outline" size="sm" onClick={() => { setShiftOpen(false); setShowShiftDialog(true); toast.info("Shift ditutup"); }}>
          Tutup Shift
        </Button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4 -mt-2">
        {/* Catalog */}
        <div className="space-y-4 min-w-0">
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nama atau kode produk..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-11"
                />
              </div>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-11 sm:w-52"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Semua">Semua Kategori</SelectItem>
                  {CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredProducts.map((p) => {
              const status = stockStatus(p);
              return (
                <button
                  key={p.sku}
                  onClick={() => addToCart(p)}
                  disabled={p.stock === 0}
                  className="group text-left bg-card border rounded-xl p-3 hover:border-primary hover:shadow-card transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="aspect-square rounded-lg bg-gradient-to-br from-accent to-muted grid place-items-center mb-2 group-hover:from-primary/10 group-hover:to-primary-glow/10 transition-colors">
                    <Package2 className="h-8 w-8 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                  </div>
                  <div className="text-[11px] text-muted-foreground">{p.sku}</div>
                  <div className="text-sm font-medium line-clamp-2 leading-tight mt-0.5">{p.name}</div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-sm font-bold text-primary">{rupiah(p.sellPrice, { compact: true })}</div>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] font-medium",
                        status === "critical" && "bg-destructive/10 text-destructive",
                        status === "low" && "bg-warning/15 text-warning-foreground",
                        status === "normal" && "bg-success/10 text-success",
                      )}
                    >
                      {p.stock} {p.unit}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cart panel */}
        <Card className="flex flex-col lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] overflow-hidden">
          {/* Cart tabs */}
          <div className="flex items-center gap-1 p-2 border-b bg-muted/40 overflow-x-auto">
            {carts.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCartId(c.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all",
                  c.id === activeCartId ? "bg-background shadow-sm" : "text-muted-foreground hover:bg-background/50",
                )}
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                {c.name}
                {c.items.length > 0 && (
                  <span className="h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] grid place-items-center font-bold">{c.items.length}</span>
                )}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); handleCloseCart(c.id); }}
                  className="hover:bg-destructive/10 hover:text-destructive rounded p-0.5 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </span>
              </button>
            ))}
            <Button variant="ghost" size="sm" onClick={handleAddCart} className="h-7 px-2 ml-auto">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Customer */}
          <div className="p-3 border-b">
            <Select
              value={activeCart.customerId ?? "walk-in"}
              onValueChange={(v) => updateCart((c) => ({ ...c, customerId: v === "walk-in" ? undefined : v }))}
            >
              <SelectTrigger className="h-9">
                <div className="flex items-center gap-2">
                  <UserCircle className="h-4 w-4 text-muted-foreground" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="walk-in">Pelanggan Umum</SelectItem>
                {CUSTOMERS.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px]">
            {itemRows.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-10 text-muted-foreground">
                <ShoppingBag className="h-12 w-12 mb-3 opacity-30" />
                <div className="text-sm">Keranjang masih kosong</div>
                <div className="text-xs mt-1">Klik produk di sebelah kiri</div>
              </div>
            ) : (
              itemRows.map((r) => (
                <div key={r.sku} className="rounded-lg border p-2.5 group">
                  <div className="flex gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium leading-tight truncate">{r.product.name}</div>
                      <div className="text-[11px] text-muted-foreground">{rupiah(r.product.sellPrice)} / {r.product.unit}</div>
                    </div>
                    <button onClick={() => removeItem(r.sku)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(r.sku, -1)}>
                        <Minus className="h-3 w-3" />
                      </Button>
                      <div className="w-8 text-center text-sm font-medium">{r.qty}</div>
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(r.sku, 1)}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="text-sm font-semibold">{rupiah(r.subtotal)}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totals */}
          <div className="border-t bg-muted/30 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{rupiah(subtotal)}</span>
            </div>
            {activeCart.totalDiscount > 0 && (
              <div className="flex justify-between text-sm text-destructive">
                <span>Diskon ({activeCart.totalDiscount}%)</span>
                <span>−{rupiah(totalDiscountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Total</span>
              <span className="text-primary">{rupiah(total)}</span>
            </div>
            <Button
              onClick={handleCheckout}
              disabled={itemRows.length === 0}
              className="w-full bg-gradient-primary hover:opacity-90 shadow-glow h-11 mt-2"
            >
              Bayar Sekarang
            </Button>
          </div>
        </Card>
      </div>

      {/* Checkout dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pembayaran</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-gradient-primary text-primary-foreground rounded-xl p-4">
              <div className="text-xs opacity-80">Total Tagihan</div>
              <div className="text-3xl font-bold mt-1">{rupiah(total)}</div>
              <div className="text-xs opacity-80 mt-1">{itemRows.length} item · {itemRows.reduce((s, r) => s + r.qty, 0)} qty</div>
            </div>

            <div>
              <Label className="text-xs">Metode Pembayaran</Label>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {([
                  { m: "Tunai" as const, icon: Banknote },
                  { m: "QRIS" as const, icon: QrCode },
                  { m: "Transfer" as const, icon: ArrowRightLeft },
                  { m: "Piutang" as const, icon: ReceiptIcon },
                ]).map(({ m, icon: I }) => (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={cn(
                      "flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-medium transition-all",
                      paymentMethod === m ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted",
                    )}
                  >
                    <I className="h-4 w-4" />
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === "Tunai" && (
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
                  {[total, 50000, 100000, 200000].map((v, i) => (
                    <button
                      key={i}
                      onClick={() => setCashGiven(String(Math.ceil((cashGivenNum + v) / 1000) * 1000))}
                      className="px-2.5 py-1 text-xs rounded-md bg-muted hover:bg-primary hover:text-primary-foreground"
                    >
                      +{rupiah(v, { compact: true })}
                    </button>
                  ))}
                </div>
                {cashGivenNum > 0 && (
                  <div className={cn(
                    "rounded-lg p-3 flex justify-between items-center",
                    change >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
                  )}>
                    <span className="text-sm font-medium">{change >= 0 ? "Kembalian" : "Kurang"}</span>
                    <span className="text-xl font-bold">{rupiah(Math.abs(change))}</span>
                  </div>
                )}
              </div>
            )}

            {paymentMethod === "QRIS" && (
              <div className="bg-muted rounded-lg p-6 text-center">
                <div className="h-32 w-32 mx-auto bg-white rounded-lg grid place-items-center border-2 border-dashed">
                  <QrCode className="h-16 w-16 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground mt-3">Scan QR untuk membayar</p>
              </div>
            )}

            {paymentMethod === "Transfer" && (
              <div className="rounded-lg bg-muted p-4 text-sm space-y-1">
                <div className="text-xs text-muted-foreground">Transfer ke</div>
                <div className="font-semibold">BCA 1234567890</div>
                <div className="text-xs">a.n. Toko Bangunan Simetri</div>
              </div>
            )}

            {paymentMethod === "Piutang" && (
              <div className="rounded-lg bg-warning/10 border border-warning/30 p-3 text-sm">
                Tagihan akan dicatat sebagai piutang pelanggan. Pilih pelanggan sebelum melanjutkan.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCheckout(false)}>Batal</Button>
            <Button className="bg-gradient-primary" onClick={handleConfirmPayment}>Konfirmasi Bayar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt */}
      <Dialog open={!!lastReceipt} onOpenChange={(o) => !o && setLastReceipt(null)}>
        <DialogContent className="max-w-sm">
          <div className="text-center pt-2">
            <div className="h-14 w-14 mx-auto rounded-full bg-gradient-success grid place-items-center mb-2">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <div className="font-semibold">Transaksi Berhasil</div>
            <div className="text-xs text-muted-foreground">{lastReceipt?.invoice}</div>
          </div>
          {lastReceipt && (
            <div className="border-2 border-dashed rounded-lg p-4 text-xs font-mono space-y-2 bg-muted/30">
              <div className="text-center pb-2 border-b border-dashed">
                <div className="font-bold text-sm font-sans">Toko Bangunan Simetri</div>
                <div className="text-[10px] font-sans text-muted-foreground">Jl. Sudirman No. 42</div>
              </div>
              <div className="flex justify-between text-[10px]">
                <span>{tanggal(new Date().toISOString(), { withTime: true })}</span>
                <span>Kasir: {user.name}</span>
              </div>
              <div className="space-y-1 py-2 border-y border-dashed">
                {lastReceipt.items.map((it, i) => (
                  <div key={i}>
                    <div>{it.name}</div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{it.qty} × {rupiah(it.price)}</span>
                      <span>{rupiah(it.qty * it.price)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold text-sm">
                <span>TOTAL</span>
                <span>{rupiah(lastReceipt.total)}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span>Bayar ({lastReceipt.method})</span>
                <span>{rupiah(lastReceipt.total + lastReceipt.change)}</span>
              </div>
              {lastReceipt.change > 0 && (
                <div className="flex justify-between text-[10px]">
                  <span>Kembalian</span><span>{rupiah(lastReceipt.change)}</span>
                </div>
              )}
              <div className="text-center pt-2 border-t border-dashed text-[10px] font-sans">
                Terima kasih atas kunjungan Anda
              </div>
            </div>
          )}
          <DialogFooter className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setLastReceipt(null)}>Tutup</Button>
            <Button className="bg-gradient-primary" onClick={() => { toast.success("Struk dikirim ke printer"); setLastReceipt(null); }}>
              <Printer className="h-4 w-4 mr-1.5" /> Cetak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
