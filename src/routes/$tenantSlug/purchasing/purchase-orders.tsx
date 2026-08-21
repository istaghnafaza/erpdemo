import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PurchasingSubNav } from "@/components/purchasing/PurchasingSubNav";
import { PurchaseOrderList } from "@/components/purchasing/PurchaseOrderList";
import { PurchaseOrderFormDialog } from "@/components/purchasing/PurchaseOrderFormDialog";
import { PurchaseOrderDetailDialog } from "@/components/purchasing/PurchaseOrderDetailDialog";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { usePurchasingStore } from "@/stores/purchasing.store";
import { poStatusLabel } from "@/stores/purchasing.store";
import { requireAuth, requireRole } from "@/routes/$tenantSlug";
import { toast } from "sonner";
import type { DbPoStatus, DbPoType } from "@/types/database";

export const Route = createFileRoute("/$tenantSlug/purchasing/purchase-orders")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireRole(params.tenantSlug, ["owner", "manager", "warehouse"]);
  },
  head: () => ({ meta: [{ title: "Purchase Orders — SEPS" }] }),
  component: PurchaseOrdersPage,
});

function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const { tenantSlug } = Route.useParams();
  const setPendingGrPoId = usePurchasingStore((s) => s.setPendingGrPoId);

  const {
    user,
    branch,
    loading,
    orders,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    suppliers,
    products,
    indentSoItemOptions,
    formOpen,
    detailPo,
    setDetailPo,
    actionLoading,
    openCreateForm,
    closeForm,
    createPo,
    sendPo,
    confirmSupplierPo,
    cancelPo,
  } = usePurchaseOrders();

  if (!user) return null;

  return (
    <AppShell
      title="Purchase Orders"
      subtitle="Kelola PO reguler (restock) dan PO indent (dari Sales Order)"
      actions={
        <Button size="sm" className="bg-orange-600 hover:bg-orange-700" onClick={openCreateForm}>
          <Plus className="h-4 w-4 mr-1.5" /> PO Baru
        </Button>
      }
    >
      <PurchasingSubNav />

      <Card className="overflow-hidden">
        <div className="p-4 border-b flex flex-wrap gap-3 items-center">
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as DbPoType | "all")}
          >
            <SelectTrigger className="h-9 w-40">
              <SelectValue placeholder="Tipe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tipe</SelectItem>
              <SelectItem value="regular">Reguler</SelectItem>
              <SelectItem value="indent">Indent (SO)</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as DbPoStatus | "all")}
          >
            <SelectTrigger className="h-9 w-48">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              {(
                [
                  "draft",
                  "awaiting_supplier",
                  "sent",
                  "partial_received",
                  "received",
                  "cancelled",
                ] as DbPoStatus[]
              ).map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "awaiting_supplier"
                    ? "Menunggu jawaban supplier"
                    : poStatusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <PurchaseOrderList orders={orders} loading={loading} onSelect={setDetailPo} />
      </Card>

      <PurchaseOrderFormDialog
        open={formOpen}
        onClose={closeForm}
        suppliers={suppliers}
        products={products}
        indentSoItemOptions={indentSoItemOptions}
        branchAddress={branch?.address}
        loading={actionLoading}
        onSubmit={createPo}
      />

      <PurchaseOrderDetailDialog
        po={detailPo}
        onClose={() => setDetailPo(null)}
        loading={actionLoading}
        onSend={() => {
          if (!detailPo) return;
          void sendPo(detailPo.id).then((r) => {
            if (r.success) toast.success("PO dikirim ke supplier");
            else toast.error(r.error ?? "Gagal");
          });
        }}
        onConfirmSupplier={() => {
          if (!detailPo) return;
          void confirmSupplierPo(detailPo.id).then((r) => {
            if (r.success) {
              setDetailPo(null);
              toast.success("Supplier dikonfirmasi — PO siap penerimaan");
            } else toast.error(r.error ?? "Gagal");
          });
        }}
        onCancel={() => {
          if (!detailPo) return;
          void cancelPo(detailPo.id).then((r) => {
            if (r.success) toast.success("PO dibatalkan");
            else toast.error(r.error ?? "Gagal");
          });
        }}
        onReceive={() => {
          if (!detailPo) return;
          setPendingGrPoId(detailPo.id);
          setDetailPo(null);
          navigate({ to: "/$tenantSlug/purchasing/goods-receipt", params: { tenantSlug } });
        }}
      />
    </AppShell>
  );
}
