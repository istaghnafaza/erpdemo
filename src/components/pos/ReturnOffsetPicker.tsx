import { useEffect, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReturnOffsetSummary } from "@/components/pos/ReturnOffsetLines";
import { listPendingOffsetReturns } from "@/lib/api/returns";
import { mapReturnItemsToOffsetLines, type PosReturnOffset } from "@/lib/pos-return-offset";
import { rupiah } from "@/lib/format";
import type { SalesReturnRecord } from "@/types/sales-returns";

interface ReturnOffsetPickerProps {
  tenantId: string;
  branchId: string;
  selected: PosReturnOffset | null;
  onSelect: (offset: PosReturnOffset | null) => void;
}

export function ReturnOffsetPicker({
  tenantId,
  branchId,
  selected,
  onSelect,
}: ReturnOffsetPickerProps) {
  const [options, setOptions] = useState<SalesReturnRecord[]>([]);

  useEffect(() => {
    if (!tenantId || !branchId) return;
    void listPendingOffsetReturns(tenantId, branchId).then((res) => {
      if (res.data) setOptions(res.data);
    });
  }, [tenantId, branchId]);

  if (options.length === 0 && !selected) return null;

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
        <RotateCcw className="h-4 w-4" />
        Potong Retur
      </div>
      {selected ? (
        <div className="space-y-2">
          <ReturnOffsetSummary offset={selected} />
          <div className="flex justify-end">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onSelect(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <Select
          onValueChange={(id) => {
            const row = options.find((o) => o.id === id);
            if (!row) return;
            onSelect({
              returnId: row.id,
              returnNumber: row.returnNumber,
              amount: row.approvedRefundAmount,
              items: mapReturnItemsToOffsetLines(row.items),
            });
          }}
        >
          <SelectTrigger className="bg-background">
            <SelectValue placeholder="Pilih retur menunggu offset..." />
          </SelectTrigger>
          <SelectContent>
            {options.map((row) => (
              <SelectItem key={row.id} value={row.id}>
                {row.returnNumber} — {rupiah(row.approvedRefundAmount)} ({row.originalTransactionNumber})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
