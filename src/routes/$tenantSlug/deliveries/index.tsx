import { createFileRoute } from "@tanstack/react-router";
import { Clock, PackageCheck, Truck, Package } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { ReportScopeBadge } from "@/components/reports/ReportScopeBadge";
import { DeliveryDataTable } from "@/components/deliveries/DeliveryDataTable";
import { DeliveryDetailDialog } from "@/components/deliveries/DeliveryDetailDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeliveriesPage } from "@/hooks/useDeliveriesPage";
import { DELIVERY_STATUS_LABELS } from "@/lib/delivery-utils";
import { requireAuth, requireFeature } from "@/routes/$tenantSlug";
import type { DeliveryStatus } from "@/types/deliveries";

export const Route = createFileRoute("/$tenantSlug/deliveries/")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireFeature(params.tenantSlug, "deliveries");
  },
  head: () => ({
    meta: [
      { title: "Pengiriman — SEPS" },
      {
        name: "description",
        content: "Pelacakan pengiriman material dari checkout POS.",
      },
    ],
  }),
  component: DeliveriesPage,
});

function DeliveriesPage() {
  const {
    user,
    rows,
    scopeLabel,
    isConsolidated,
    summary,
    dateFrom,
    dateTo,
    setDateFrom,
    setDateTo,
    clearDateFilter,
    statusFilter,
    setStatusFilter,
    selectedDelivery,
    setSelectedDelivery,
    canEditDelivery,
    saveDelivery,
  } = useDeliveriesPage();

  if (!user) return null;

  return (
    <AppShell
      title="Pengiriman"
      subtitle={
        isConsolidated
          ? "Semua pengiriman material gabungan cabang"
          : `Pengiriman material cabang ${scopeLabel}`
      }
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ReportScopeBadge scopeLabel={scopeLabel} isConsolidated={isConsolidated} />
        <p className="text-xs text-muted-foreground max-w-xl">
          Data pengiriman dibuat otomatis saat checkout POS. Tidak ada pembuatan manual di modul
          ini.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-sky-600/10 grid place-items-center">
              <Package className="h-5 w-5 text-sky-600" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total DO</div>
              <div className="text-xl font-bold">{summary.totalRows}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-600/10 grid place-items-center">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Menunggu / disiapkan</div>
              <div className="text-xl font-bold">{summary.pendingCount}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-600/10 grid place-items-center">
              <Truck className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Dalam pengiriman</div>
              <div className="text-xl font-bold">{summary.inTransitCount}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-600/10 grid place-items-center">
              <PackageCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Selesai / terkirim</div>
              <div className="text-xl font-bold">{summary.deliveredCount}</div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4 mb-4">
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="delivery-date-from" className="text-xs">
              Dari tanggal
            </Label>
            <Input
              id="delivery-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full sm:w-[170px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="delivery-date-to" className="text-xs">
              Sampai tanggal
            </Label>
            <Input
              id="delivery-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full sm:w-[170px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="delivery-status-filter" className="text-xs">
              Status
            </Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as DeliveryStatus | "all")}
            >
              <SelectTrigger id="delivery-status-filter" className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status</SelectItem>
                {(Object.keys(DELIVERY_STATUS_LABELS) as DeliveryStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {DELIVERY_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(dateFrom || dateTo || statusFilter !== "all") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                clearDateFilter();
                setStatusFilter("all");
              }}
            >
              Reset filter
            </Button>
          )}
        </div>
      </Card>

      <DeliveryDataTable
        data={rows}
        isConsolidated={isConsolidated}
        onRowClick={setSelectedDelivery}
      />

      <DeliveryDetailDialog
        delivery={selectedDelivery}
        canEdit={canEditDelivery}
        onClose={() => setSelectedDelivery(null)}
        onSave={saveDelivery}
      />
    </AppShell>
  );
}
