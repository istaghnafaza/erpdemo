import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { PortalShell } from "@/components/portal/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCustomerPortal } from "@/hooks/useCustomerPortal";
import { onlineOrderStatusLabel, PORTAL_PAYMENT_LABELS } from "@/lib/portal-utils";
import { resolvePortalTenantBySlug } from "@/lib/portal-utils";
import { rupiah, tanggal } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/$tenantSlug/shop/orders")({
  beforeLoad: ({ params }) => {
    const tenant = resolvePortalTenantBySlug(params.tenantSlug);
    if (!tenant) throw redirect({ to: "/login" });
  },
  component: PortalOrdersPage,
});

function PortalOrdersPage() {
  const { tenantSlug } = Route.useParams();
  const tenant = resolvePortalTenantBySlug(tenantSlug)!;
  const portal = useCustomerPortal(tenant.id, tenantSlug);
  const [proofOrderId, setProofOrderId] = useState<string | null>(null);
  const [proofNote, setProofNote] = useState("");

  if (!portal.config) return null;

  if (!portal.account) {
    return (
      <PortalShell
        tenantSlug={tenantSlug}
        config={portal.config}
        account={null}
        cartCount={portal.cartCount}
        onOpenCart={() => {}}
        onOpenAuth={() => {}}
        onLogout={() => {}}
      >
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">Login untuk melihat riwayat pesanan</p>
          <Link to="/$tenantSlug/shop" params={{ tenantSlug }}>
            <Button>Kembali ke Katalog</Button>
          </Link>
        </Card>
      </PortalShell>
    );
  }

  const handleUploadProof = (orderId: string) => {
    const r = portal.uploadPaymentProof(orderId, proofNote);
    if (r.ok) {
      toast.success("Bukti pembayaran dikirim");
      setProofOrderId(null);
      setProofNote("");
    } else {
      toast.error(r.error);
    }
  };

  return (
    <PortalShell
      tenantSlug={tenantSlug}
      config={portal.config}
      account={portal.account}
      cartCount={portal.cartCount}
      onOpenCart={() => {}}
      onOpenAuth={() => {}}
      onLogout={() => portal.logout()}
    >
      <div className="space-y-4">
        <h1 className="text-lg font-semibold">Pesanan Saya</h1>
        {portal.myOrders.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">Belum ada pesanan</Card>
        ) : (
          portal.myOrders.map((order) => (
            <Card key={order.id} className="p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-mono font-medium text-sm">{order.orderNumber}</div>
                  <div className="text-xs text-muted-foreground">
                    {tanggal(order.createdAt, { withTime: true })} · {order.branchName}
                  </div>
                </div>
                <Badge variant="secondary">{onlineOrderStatusLabel(order.status)}</Badge>
              </div>
              <div className="text-sm space-y-1">
                {order.items.map((it, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <span>
                      {it.productName} × {it.qty}
                    </span>
                    <span>{rupiah(it.subtotal)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-semibold text-sm border-t pt-2">
                <span>{PORTAL_PAYMENT_LABELS[order.paymentMethod]}</span>
                <span>{rupiah(order.grandTotal)}</span>
              </div>
              <p className="text-xs text-muted-foreground">{order.deliveryAddress}</p>

              {order.status === "approved" && (
                <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                  {proofOrderId === order.id ? (
                    <>
                      <Label className="text-xs">Catatan bukti bayar (demo)</Label>
                      <Input
                        placeholder="Contoh: Transfer BCA 01/07 Rp 875.000"
                        value={proofNote}
                        onChange={(e) => setProofNote(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleUploadProof(order.id)}>
                          Kirim Bukti
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setProofOrderId(null)}
                        >
                          Batal
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setProofOrderId(order.id)}>
                      Upload Bukti Pembayaran
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </PortalShell>
  );
}
