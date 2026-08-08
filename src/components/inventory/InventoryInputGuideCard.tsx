import { Info, PackagePlus, FileSpreadsheet } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  INVENTORY_BULK_INPUT_THRESHOLD,
  INVENTORY_INPUT_GUIDE,
} from "@/lib/inventory-input-policy";

interface InventoryInputGuideCardProps {
  productCount: number;
}

export function InventoryInputGuideCard({ productCount }: InventoryInputGuideCardProps) {
  const suggestBulk = productCount >= INVENTORY_BULK_INPUT_THRESHOLD;

  return (
    <Card className="p-4 mb-4 border-cyan-200/60 bg-cyan-50/40 dark:bg-cyan-950/20">
      <div className="flex gap-3">
        <Info className="h-5 w-5 text-cyan-700 shrink-0 mt-0.5" />
        <div className="space-y-2 text-sm">
          <p className="font-medium text-foreground">Dua cara input master barang</p>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="flex gap-2 items-start">
              <PackagePlus className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <p className="text-muted-foreground">
                <strong className="text-foreground">&lt; {INVENTORY_BULK_INPUT_THRESHOLD} barang:</strong>{" "}
                {INVENTORY_INPUT_GUIDE.manual}
              </p>
            </div>
            <div className="flex gap-2 items-start">
              <FileSpreadsheet className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <p className="text-muted-foreground">
                <strong className="text-foreground">≥ {INVENTORY_BULK_INPUT_THRESHOLD} barang:</strong>{" "}
                {INVENTORY_INPUT_GUIDE.bulk} Sheet <strong>Data Legacy</strong> untuk data lama dari buku/Excel toko.
              </p>
            </div>
          </div>
          {suggestBulk ? (
            <p className="text-xs text-cyan-800 dark:text-cyan-200">
              Anda sudah punya {productCount}+ barang — untuk penambahan banyak sekaligus, gunakan Import Excel.
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
