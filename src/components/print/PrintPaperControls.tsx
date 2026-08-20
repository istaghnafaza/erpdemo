import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { clampReceiptMm, type InvoicePaperSize, type PrintPrefs } from "@/lib/print-prefs";
import { cn } from "@/lib/utils";

export function PrintPaperControls({
  prefs,
  onPreset,
  onCustomMm,
  onInvoicePaper,
  onThermerOrigin,
  className,
}: {
  prefs: PrintPrefs;
  onPreset: (preset: PrintPrefs["receiptPreset"]) => void;
  onCustomMm: (mm: number) => void;
  onInvoicePaper: (paper: InvoicePaperSize) => void;
  onThermerOrigin?: (origin: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("no-print space-y-3 text-xs", className)}>
      <div>
        <Label className="text-[11px] text-muted-foreground">Lebar struk</Label>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {(["58", "80", "custom"] as const).map((preset) => (
            <Button
              key={preset}
              type="button"
              size="sm"
              variant={prefs.receiptPreset === preset ? "default" : "outline"}
              className="h-7 px-2.5"
              onClick={() => onPreset(preset)}
            >
              {preset === "custom" ? "Custom" : `${preset} mm`}
            </Button>
          ))}
          {prefs.receiptPreset === "custom" ? (
            <Input
              type="number"
              min={40}
              max={120}
              className="h-7 w-[4.5rem]"
              value={prefs.customMm}
              onChange={(e) => onCustomMm(clampReceiptMm(Number(e.target.value)))}
            />
          ) : null}
        </div>
      </div>
      <div>
        <Label className="text-[11px] text-muted-foreground">Kertas invoice</Label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(["a4", "a5"] as const).map((paper) => (
            <Button
              key={paper}
              type="button"
              size="sm"
              variant={prefs.invoicePaper === paper ? "default" : "outline"}
              className="h-7 px-2.5 uppercase"
              onClick={() => onInvoicePaper(paper)}
            >
              {paper}
            </Button>
          ))}
        </div>
      </div>
      {onThermerOrigin ? (
        <div>
          <Label className="text-[11px] text-muted-foreground">URL publik untuk iPhone (Thermer)</Label>
          <Input
            className="mt-1.5 h-8 text-xs"
            placeholder="Uji local wajib http://192.168.0.107:8081 (termasuk http://)"
            value={prefs.thermerOrigin}
            onChange={(e) => onThermerOrigin(e.target.value)}
          />
        </div>
      ) : null}
      <p className="text-[11px] text-muted-foreground leading-snug">
        Di dialog printer PC, pilih kertas 58/80 mm atau A4/A5. HP: iPhone pakai bprint, iPad pakai data langsung, Android pakai RawBT.
      </p>
    </div>
  );
}
