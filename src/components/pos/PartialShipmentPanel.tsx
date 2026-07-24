import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { PartialShipLine } from "@/lib/pos-partial-shipment";
import { validatePartialShipment } from "@/lib/pos-partial-shipment";
import type { CartItem } from "@/types/database";

export interface PartialShipmentPanelProps {
  items: CartItem[];
  partialShip: PartialShipLine[];
  onLineChange: (itemIndex: number, patch: { selected?: boolean; shipQty?: number }) => void;
}

export function PartialShipmentPanel({
  items,
  partialShip,
  onLineChange,
}: PartialShipmentPanelProps) {
  const validation = validatePartialShipment(items, partialShip);

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
      <div>
        <Label className="text-xs font-medium">Barang yang dikirim (sebagian)</Label>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Centang barang yang dikirim sekarang dan isi qty kirim. Sisanya tidak masuk DO ini.
        </p>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {items.map((item, i) => {
          if (item.is_so_line) return null;
          const line = partialShip[i] ?? { selected: false, shipQty: 0 };
          const lineError =
            line.selected && line.shipQty > item.qty
              ? `Maks ${item.qty} ${item.unit}`
              : line.selected && line.shipQty < 1
                ? "Minimal 1"
                : null;

          return (
            <div
              key={`${item.product_id}-${i}`}
              className={cn(
                "flex items-start gap-2 rounded-md border bg-background p-2",
                line.selected && "border-primary/40",
              )}
            >
              <Checkbox
                id={`partial-ship-${i}`}
                checked={line.selected}
                onCheckedChange={(checked) =>
                  onLineChange(i, { selected: checked === true })
                }
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0 space-y-1.5">
                <label
                  htmlFor={`partial-ship-${i}`}
                  className="text-xs font-medium leading-tight cursor-pointer block"
                >
                  {item.name}
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    · order {item.qty} {item.unit}
                  </span>
                </label>
                {line.selected && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`partial-qty-${i}`} className="text-[10px] shrink-0">
                      Qty kirim
                    </Label>
                    <Input
                      id={`partial-qty-${i}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={item.qty}
                      value={line.shipQty || ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          onLineChange(i, { shipQty: 0, selected: false });
                          return;
                        }
                        onLineChange(i, { shipQty: Number(raw) });
                      }}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isFinite(v) || v < 1) {
                          onLineChange(i, { shipQty: 1, selected: true });
                        } else if (v > item.qty) {
                          onLineChange(i, { shipQty: item.qty, selected: true });
                        }
                      }}
                      className={cn(
                        "h-8 w-20 text-sm text-center",
                        lineError && "border-destructive",
                      )}
                    />
                    <span className="text-[10px] text-muted-foreground">/ {item.qty}</span>
                  </div>
                )}
                {lineError && (
                  <p className="text-[10px] text-destructive">{lineError}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!validation.ok && items.length > 0 && (
        <p className="text-xs text-destructive">{validation.error}</p>
      )}
    </div>
  );
}
