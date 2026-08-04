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

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 text-xs text-emerald-700 dark:text-emerald-400">
        <span className="flex items-center gap-1.5 min-w-0">
          <RotateCcw className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            Retur dipilih: {selected.returnNumber} · {rupiah(selected.amount)}
          </span>
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={() => onSelect(null)}
          title="Hapus potong retur"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <RotateCcw className="h-3.5 w-3.5" />
        Potong Retur
      </div>
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
        <SelectTrigger className="bg-background h-9 text-sm">
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
    </div>
  );
}
