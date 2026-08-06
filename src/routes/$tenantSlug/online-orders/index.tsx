import { createFileRoute, redirect } from "@tanstack/react-router";
import { FEATURE_ONLINE_ORDERS_ENABLED } from "@/lib/feature-flags";
import { Globe } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOnlineOrdersPage } from "@/hooks/useOnlineOrdersPage";
import { ONLINE_ORDER_STATUS_LABELS } from "@/lib/portal-utils";
import { rupiah, tanggal } from "@/lib/format";
import { requireAuth, requireFeature } from "@/routes/$tenantSlug";
import { toast } from "sonner";
import type { OnlineOrderStatus } from "@/types/customer-portal";

export const Route = createFileRoute("/$tenantSlug/online-orders/")({
  beforeLoad: ({ params }) => {
    if (!FEATURE_ONLINE_ORDERS_ENABLED) {
      throw redirect({ to: "/$tenantSlug/dashboard", params: { tenantSlug: params.tenantSlug } });
    }
    requireAuth();
    requireFeature(params.tenantSlug, "online_orders");
  },
  head: () => ({
    meta: [{ title: "Order Online — SEPS" }],
  }),
  component: OnlineOrdersPage,
});

function OnlineOrdersPage() {
  const {
    user,
    config,
    rows,
    statusFilter,
    setStatusFilter,
    approveOrder,
    rejectOrder,
    confirmPayment,
    updateOrderStatus,
    statusLabel,
    paymentLabel,
  } = useOnlineOrdersPage();

  if (!user) return null;

  const handle = (
    action: () => { ok: boolean; error?: string },
    success: string,
  ) => {
    const r = action();
    if (r.ok) toast.success(success);
    else toast.error(r.error);
  };

  return (
    <AppShell
      title="Order Online"
      subtitle="Pesanan dari portal pelanggan — review & proses"
      actions={
        config && (
          <Button variant="outline" size="sm" asChild>
            <a href={`/${config.slug}/shop`} target="_blank" rel="noreferrer">
              <Globe className="h-4 w-4 mr-1.5" />
              Buka Portal
            </a>
          </Button>
        )
      }
    >
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Filter status:</span>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as OnlineOrderStatus | "all")}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              {(Object.keys(ONLINE_ORDER_STATUS_LABELS) as OnlineOrderStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {ONLINE_ORDER_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>No. Order</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Pelanggan</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Bayar</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[200px]">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  Tidak ada order online
                </TableCell>
              </TableRow>
            ) : (
              rows.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs">{order.orderNumber}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {tanggal(order.createdAt, { withTime: true })}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{order.customerName}</div>
                    <div className="text-[11px] text-muted-foreground">{order.customerPhone}</div>
                  </TableCell>
                  <TableCell>{rupiah(order.grandTotal)}</TableCell>
                  <TableCell className="text-xs">{paymentLabel[order.paymentMethod]}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">
                      {statusLabel(order.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {order.status === "pending_approval" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() =>
                              handle(() => approveOrder(order.id), "Order disetujui")
                            }
                          >
                            Setujui
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-destructive"
                            onClick={() =>
                              handle(() => rejectOrder(order.id), "Order ditolak")
                            }
                          >
                            Tolak
                          </Button>
                        </>
                      )}
                      {order.status === "payment_uploaded" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() =>
                            handle(() => confirmPayment(order.id), "Pembayaran dikonfirmasi")
                          }
                        >
                          Konfirmasi Bayar
                        </Button>
                      )}
                      {order.status === "processing" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() =>
                            handle(
                              () => updateOrderStatus(order.id, "shipped"),
                              "Status: Dikirim",
                            )
                          }
                        >
                          Kirim
                        </Button>
                      )}
                      {order.status === "shipped" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() =>
                            handle(
                              () => updateOrderStatus(order.id, "completed"),
                              "Order selesai",
                            )
                          }
                        >
                          Selesai
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}
