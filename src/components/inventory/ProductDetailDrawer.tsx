import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { DateDisplay } from "@/components/ui/date-display";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PoPriceChangeWarning } from "@/components/inventory/PoPriceChangeWarning";
import { cn } from "@/lib/utils";
import type { InventoryProductRow } from "@/hooks/useInventoryProducts";
import type { StockMovement } from "@/types/database";

const MOVEMENT_LABELS: Record<string, string> = {
  in: "Masuk",
  out: "Keluar",
  adjustment: "Penyesuaian",
  opname: "Stock Opname",
  transfer_out: "Transfer Keluar",
  transfer_in: "Transfer Masuk",
  legacy_in: "Legacy Masuk",
  legacy_out: "Legacy Keluar",
};

interface ProductDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  product: InventoryProductRow | null;
  branchStock: InventoryProductRow[];
  movements: StockMovement[];
  movementsLoading: boolean;
  canSeePurchasePrice: boolean;
}

export function ProductDetailDrawer({
  open,
  onClose,
  product,
  branchStock,
  movements,
  movementsLoading,
  canSeePurchasePrice,
}: ProductDetailDrawerProps) {
  if (!product) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{product.name}</SheetTitle>
          <SheetDescription>
            {product.sku} · {product.category}
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="info" className="mt-6">
          <TabsList className="w-full">
            <TabsTrigger value="info" className="flex-1">
              Info
            </TabsTrigger>
            <TabsTrigger value="movements" className="flex-1">
              Mutasi Stok
            </TabsTrigger>
            <TabsTrigger value="branches" className="flex-1">
              Stok per Cabang
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <InfoTile label="Stok" value={`${product.stock} ${product.unit}`} />
              <InfoTile label="Min. Stok" value={String(product.reorderPoint)} />
              {canSeePurchasePrice && (
                <InfoTile
                  label="Harga Beli"
                  value={<CurrencyDisplay value={product.purchasePrice} />}
                />
              )}
              <InfoTile
                label="Harga Jual"
                value={<CurrencyDisplay value={product.sellingPrice} />}
              />
              <InfoTile label="Lokasi Gudang" value={product.warehouseLocation || "—"} />
              <InfoTile label="Satuan" value={product.unit} />
            </div>
            {product.stockOwnership !== "consignment" ? (
              <PoPriceChangeWarning
                hpp={product.purchasePrice}
                lastPoPrice={product.lastPoPrice}
                sellingPrice={product.sellingPrice}
                poNumber={product.lastPoNumber}
                showAmounts={canSeePurchasePrice}
              />
            ) : null}
            <div>
              <StatusBadge
                status={
                  product.stockStatus === "empty"
                    ? "critical"
                    : product.stockStatus === "critical"
                      ? "critical"
                      : product.stockStatus
                }
                label={product.stockStatus === "empty" ? "Habis" : undefined}
              />
            </div>
          </TabsContent>

          <TabsContent value="movements" className="mt-4">
            {movementsLoading ? (
              <LoadingSkeleton variant="table-row" count={4} />
            ) : movements.length === 0 ? (
              <EmptyState title="Belum ada mutasi" description="Riwayat mutasi stok kosong." />
            ) : (
              <div className="rounded-lg border divide-y max-h-[60vh] overflow-y-auto">
                {movements.map((m) => {
                  const isPositive =
                    m.type === "in" ||
                    m.type === "transfer_in" ||
                    m.type === "legacy_in" ||
                    (m.type === "opname" && m.qty_after > m.qty_before);

                  return (
                    <div key={m.id} className="flex items-start gap-3 p-3 text-sm">
                      <div
                        className={cn(
                          "h-8 w-8 rounded-full grid place-items-center shrink-0",
                          isPositive
                            ? "bg-success/15 text-success"
                            : "bg-destructive/15 text-destructive",
                        )}
                      >
                        {isPositive ? (
                          <ArrowUp className="h-4 w-4" />
                        ) : (
                          <ArrowDown className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{MOVEMENT_LABELS[m.type] ?? m.type}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          <DateDisplay value={m.created_at} withTime />
                          {m.reference && ` · ${m.reference}`}
                        </div>
                        {m.notes && (
                          <div className="text-xs text-muted-foreground mt-1">{m.notes}</div>
                        )}
                      </div>
                      <div
                        className={cn(
                          "font-semibold shrink-0",
                          isPositive ? "text-success" : "text-destructive",
                        )}
                      >
                        {isPositive ? "+" : "−"}
                        {m.qty}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="branches" className="mt-4">
            <div className="rounded-lg border divide-y">
              {branchStock.map((b) => (
                <div
                  key={b.branchId}
                  className="flex items-center justify-between p-3 text-sm"
                >
                  <div>
                    <div className="font-medium">{b.branchName}</div>
                    <div className="text-xs text-muted-foreground">{b.warehouseLocation || "—"}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      {b.stock} {b.unit}
                    </div>
                    <StatusBadge
                      status={
                        b.stockStatus === "empty"
                          ? "critical"
                          : b.stockStatus === "critical"
                            ? "critical"
                            : b.stockStatus
                      }
                      label={b.stockStatus === "empty" ? "Habis" : undefined}
                    />
                  </div>
                </div>
              ))}
              {branchStock.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Data stok per cabang tidak tersedia
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function InfoTile({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <div className="text-[11px] text-muted-foreground uppercase font-medium">{label}</div>
      <div className="text-sm font-bold mt-1">{value}</div>
    </div>
  );
}
