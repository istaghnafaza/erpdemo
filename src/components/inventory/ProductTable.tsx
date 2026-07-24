import { MoreHorizontal, Pencil, Eye, Ban } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/status-badge";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { cn } from "@/lib/utils";
import type { InventoryProductRow } from "@/hooks/useInventoryProducts";

interface ProductTableProps {
  rows: InventoryProductRow[];
  canSeePurchasePrice: boolean;
  canEditProduct: boolean;
  isConsolidated: boolean;
  onRowClick: (productId: string) => void;
  onViewMovements: (productId: string) => void;
  onEdit: (productId: string) => void;
  onDeactivate: (productId: string) => void;
}

function stockColor(status: InventoryProductRow["stockStatus"]) {
  if (status === "empty" || status === "critical") return "text-destructive font-semibold";
  if (status === "low") return "text-warning-foreground font-semibold";
  return "text-success font-semibold";
}

export function ProductTable({
  rows,
  canSeePurchasePrice,
  canEditProduct,
  isConsolidated,
  onRowClick,
  onViewMovements,
  onEdit,
  onDeactivate,
}: ProductTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>SKU</TableHead>
            <TableHead>Nama</TableHead>
            <TableHead>Kategori</TableHead>
            {isConsolidated && <TableHead>Cabang</TableHead>}
            <TableHead className="text-center">Stok</TableHead>
            <TableHead className="text-center">Min Stok</TableHead>
            {canSeePurchasePrice && <TableHead className="text-right">Harga Beli</TableHead>}
            <TableHead className="text-right">Harga Jual</TableHead>
            <TableHead>Lokasi</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={`${row.branchId}-${row.productId}`}
              className="cursor-pointer hover:bg-muted/30"
              onClick={() => onRowClick(row.productId)}
            >
              <TableCell className="font-mono text-xs">{row.sku}</TableCell>
              <TableCell>
                <div className="font-medium">{row.name}</div>
                {row.barcode && (
                  <div className="text-xs text-muted-foreground">{row.barcode}</div>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">{row.category}</TableCell>
              {isConsolidated && (
                <TableCell className="text-xs text-muted-foreground">{row.branchName}</TableCell>
              )}
              <TableCell className="text-center">
                <span className={cn(stockColor(row.stockStatus))}>
                  {row.stock} {row.unit}
                </span>
                <div className="mt-0.5 flex justify-center">
                  <StatusBadge
                    status={
                      row.stockStatus === "empty"
                        ? "critical"
                        : row.stockStatus === "critical"
                          ? "critical"
                          : row.stockStatus
                    }
                    label={
                      row.stockStatus === "empty"
                        ? "Habis"
                        : undefined
                    }
                  />
                </div>
              </TableCell>
              <TableCell className="text-center text-muted-foreground">
                {row.reorderPoint}
              </TableCell>
              {canSeePurchasePrice && (
                <TableCell className="text-right text-muted-foreground">
                  <CurrencyDisplay value={row.purchasePrice} />
                </TableCell>
              )}
              <TableCell className="text-right font-medium">
                <CurrencyDisplay value={row.sellingPrice} />
              </TableCell>
              <TableCell className="font-mono text-xs">{row.warehouseLocation || "—"}</TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onViewMovements(row.productId)}>
                      <Eye className="h-4 w-4 mr-2" /> Lihat Mutasi
                    </DropdownMenuItem>
                    {canEditProduct && (
                      <>
                        <DropdownMenuItem onClick={() => onEdit(row.productId)}>
                          <Pencil className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => onDeactivate(row.productId)}
                        >
                          <Ban className="h-4 w-4 mr-2" /> Nonaktifkan
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={canSeePurchasePrice ? (isConsolidated ? 10 : 9) : isConsolidated ? 9 : 8}
                className="text-center py-12 text-muted-foreground"
              >
                Tidak ada produk yang cocok dengan filter
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
