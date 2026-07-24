import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SalesOrderList } from "@/components/sales-orders/SalesOrderList";
import { SalesOrderFormDialog } from "@/components/sales-orders/SalesOrderFormDialog";
import { SalesOrderDetailDialog } from "@/components/sales-orders/SalesOrderDetailDialog";
import { useSalesOrders } from "@/hooks/useSalesOrders";
import { soStatusLabel } from "@/stores/sales-orders.store";
import { requireAuth, requireRole } from "@/routes/$tenantSlug";
import { toast } from "sonner";
import type { DbSoStatus } from "@/types/database";

export const Route = createFileRoute("/$tenantSlug/sales-orders")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireRole(params.tenantSlug, ["owner", "manager", "warehouse"]);
  },
  head: () => ({ meta: [{ title: "Sales Order — SEPS" }] }),
  component: SalesOrdersPage,
});

function SalesOrdersPage() {
  const {
    user,
    loading,
    orders,
    statusFilter,
    setStatusFilter,
    customers,
    products,
    suppliers,
    formOpen,
    editingOrder,
    detailOrder,
    setDetailOrder,
    actionLoading,
    openCreateForm,
    openEditForm,
    closeForm,
    createOrder,
    updateOrder,
    confirmOrder,
    cancelOrder,
    fulfillItem,
    invoiceFromSo,
    getProductStock,
  } = useSalesOrders();

  if (!user) return null;

  return (
    <AppShell
      title="Sales Order"
      subtitle="Fulfillment pesanan dari checkout POS — stok cabang atau indent supplier"
    >
      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Filter status:</span>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as DbSoStatus | "all")}
          >
            <SelectTrigger className="h-9 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              {(
                [
                  "draft",
                  "confirmed",
                  "partial_delivered",
                  "completed",
                  "cancelled",
                ] as DbSoStatus[]
              ).map((s) => (
                <SelectItem key={s} value={s}>
                  {soStatusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <SalesOrderList orders={orders} loading={loading} onSelect={setDetailOrder} />
      </Card>

      <SalesOrderFormDialog
        open={formOpen}
        onClose={closeForm}
        customers={customers}
        products={products}
        loading={actionLoading}
        editingOrder={editingOrder}
        onSubmit={async (data) => {
          if (editingOrder) {
            const result = await updateOrder(editingOrder.id, data);
            if (result.success) toast.success("SO diperbarui");
            else toast.error(result.error ?? "Gagal memperbarui SO");
            return result;
          }
          const result = await createOrder(data);
          if (result.success) toast.success("Draft SO dibuat");
          else toast.error(result.error ?? "Gagal membuat SO");
          return result;
        }}
      />

      <SalesOrderDetailDialog
        order={detailOrder}
        onClose={() => setDetailOrder(null)}
        suppliers={suppliers}
        getProductStock={getProductStock}
        loading={actionLoading}
        onConfirm={() => {
          if (!detailOrder) return;
          void confirmOrder(detailOrder.id).then((r) => {
            if (r.success) toast.success("SO dikonfirmasi");
            else toast.error(r.error ?? "Gagal konfirmasi");
          });
        }}
        onCancel={() => {
          if (!detailOrder) return;
          void cancelOrder(detailOrder.id).then((r) => {
            if (r.success) toast.success("SO dibatalkan");
            else toast.error(r.error ?? "Gagal membatalkan");
          });
        }}
        onFulfill={(itemId, stockQty, indentQty, supplierId) => {
          if (!detailOrder) return;
          void fulfillItem(detailOrder.id, itemId, stockQty, indentQty, supplierId).then((r) => {
            if (r.success) toast.success("Fulfillment diproses");
            else toast.error(r.error ?? "Gagal fulfillment");
          });
        }}
        onConvertInvoice={() => {
          if (!detailOrder) return;
          void invoiceFromSo(detailOrder.id).then((r) => {
            if (r.success) toast.success(`Invoice ${r.invoiceNumber} dibuat`);
            else toast.error(r.error ?? "Gagal konversi invoice");
          });
        }}
        onEdit={() => {
          if (!detailOrder) return;
          openEditForm(detailOrder);
          setDetailOrder(null);
        }}
      />
    </AppShell>
  );
}
