import { useMemo, useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SellUnitInput } from "@/lib/product-sell-units";
import { PASIR_LAMAJANG_SELL_UNIT_TEMPLATE } from "@/lib/product-sell-units";
import { angka, rupiah } from "@/lib/format";

interface SellUnitsEditorProps {
  stockUnit: string;
  units: SellUnitInput[];
  onChange: (units: SellUnitInput[]) => void;
  showPasirTemplate?: boolean;
}

export type SellUnitsEditorHandle = {
  /** Commit draft preset (agar 0.25 tersimpan meski belum blur) */
  flush: () => SellUnitInput[];
};

function emptyUnit(sortOrder: number): SellUnitInput {
  return {
    label: "",
    factor_to_base: 1,
    selling_price: null,
    purchase_price: null,
    sort_order: sortOrder,
    is_active: true,
    allow_fraction: true,
    preset_qty: [],
  };
}

function parseIdNumber(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

function formatIdNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return "";
  return angka(Math.round(n));
}

/** Parse preset: "0.25, 0.5, 1" atau "0,25; 0,5; 1" — string bebas saat mengetik. */
export function parsePresetQtyText(raw: string): number[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  let parts: string[];
  if (trimmed.includes(";")) {
    parts = trimmed.split(";");
  } else if (/\d,\d/.test(trimmed) && !/\d\.\d/.test(trimmed)) {
    parts = trimmed.split(/,\s+/);
  } else {
    parts = trimmed.split(",");
  }

  return parts
    .map((p) => Number(p.trim().replace(",", ".")))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function formatPresetQty(presets: number[] | undefined): string {
  return (presets ?? []).join(", ");
}

function unitSummary(unit: SellUnitInput, stockUnit: string): string | null {
  const label = unit.label.trim() || "—";
  const factor = Number(unit.factor_to_base);
  if (!Number.isFinite(factor) || factor <= 0) return null;
  const price =
    unit.selling_price != null && unit.selling_price > 0
      ? rupiah(unit.selling_price)
      : "harga belum diisi";
  const presets = (unit.preset_qty ?? []).filter((p) => p > 0);
  const presetPart =
    presets.length > 0 && unit.selling_price != null && unit.selling_price > 0
      ? ` · contoh preset ${presets[0]} ${label} = ${rupiah(unit.selling_price * presets[0])}`
      : presets.length > 0
        ? ` · preset: ${presets.join(", ")}`
        : "";
  return `1 ${label} = ${factor} ${stockUnit || "dasar"}, Harga ${price}${presetPart}`;
}

export const SellUnitsEditor = forwardRef<SellUnitsEditorHandle, SellUnitsEditorProps>(
  function SellUnitsEditor({ stockUnit, units, onChange, showPasirTemplate = false }, ref) {
  /** Draft teks preset per index — supaya bisa ketik 0. / 0, tanpa hilang. */
  const [presetDrafts, setPresetDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    setPresetDrafts((prev) => {
      const next: Record<number, string> = {};
      units.forEach((u, i) => {
        if (prev[i] !== undefined) next[i] = prev[i];
        else next[i] = formatPresetQty(u.preset_qty);
      });
      return next;
    });
  }, [units.length]);

  const buildFlushedUnits = (): SellUnitInput[] =>
    units.map((u, i) => {
      const raw = presetDrafts[i];
      if (raw === undefined) return { ...u, allow_fraction: true };
      return {
        ...u,
        allow_fraction: true,
        preset_qty: parsePresetQtyText(raw),
      };
    });

  useImperativeHandle(ref, () => ({
    flush: () => {
      const flushed = buildFlushedUnits();
      onChange(flushed);
      setPresetDrafts(
        Object.fromEntries(flushed.map((u, i) => [i, formatPresetQty(u.preset_qty)])),
      );
      return flushed;
    },
  }));

  const updateAt = (index: number, patch: Partial<SellUnitInput>) => {
    onChange(
      units.map((u, i) =>
        i === index
          ? {
              ...u,
              ...patch,
              allow_fraction: true,
            }
          : u,
      ),
    );
  };

  const removeAt = (index: number) => {
    onChange(units.filter((_, i) => i !== index));
    setPresetDrafts((prev) => {
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const ki = Number(k);
        if (ki < index) next[ki] = v;
        else if (ki > index) next[ki - 1] = v;
      });
      return next;
    });
  };

  const commitPresetDraft = (index: number) => {
    const raw = presetDrafts[index] ?? formatPresetQty(units[index]?.preset_qty);
    const parsed = parsePresetQtyText(raw);
    updateAt(index, { preset_qty: parsed });
    setPresetDrafts((prev) => ({ ...prev, [index]: formatPresetQty(parsed) }));
  };

  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Satuan jual (multi-unit)</p>
          <p className="text-xs text-muted-foreground">
            Stok dicatat dalam <span className="font-medium">{stockUnit || "satuan dasar"}</span>.
            Isi label, konversi, dan harga jual per satuan.
          </p>
        </div>
        <div className="flex gap-2">
          {showPasirTemplate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const next = PASIR_LAMAJANG_SELL_UNIT_TEMPLATE.map((u) => ({
                  ...u,
                  allow_fraction: true,
                }));
                onChange(next);
                setPresetDrafts(
                  Object.fromEntries(next.map((u, i) => [i, formatPresetQty(u.preset_qty)])),
                );
              }}
            >
              Template pasir
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onChange([...units, emptyUnit(units.length + 1)])}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Tambah
          </Button>
        </div>
      </div>

      {units.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Kosongkan jika produk hanya 1 satuan (sama dengan satuan stok).
        </p>
      ) : (
        <div className="space-y-3">
          {units.map((unit, index) => {
            const summary = unitSummary(unit, stockUnit);
            const labelName = unit.label.trim() || "Label";
            const presetValue =
              presetDrafts[index] !== undefined
                ? presetDrafts[index]
                : formatPresetQty(unit.preset_qty);
            return (
              <div key={`sell-unit-${index}`} className="space-y-2 rounded-md border bg-background p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">Label satuan jual</Label>
                    <Input
                      value={unit.label}
                      placeholder="Truk / Pikap / Sak"
                      onChange={(e) => updateAt(index, { label: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">
                      1 {labelName} = ? {stockUnit || "dasar"}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={unit.factor_to_base}
                      onChange={(e) =>
                        updateAt(index, { factor_to_base: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Harga jual (Rp)</Label>
                    <Input
                      inputMode="numeric"
                      value={formatIdNumber(unit.selling_price)}
                      placeholder="1.500.000"
                      onChange={(e) =>
                        updateAt(index, { selling_price: parseIdNumber(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Preset qty (pisah koma / titik koma)</Label>
                    <div className="flex gap-2">
                      <Input
                        value={presetValue}
                        placeholder="0.25, 0.5, 0.75, 1"
                        onChange={(e) =>
                          setPresetDrafts((prev) => ({ ...prev, [index]: e.target.value }))
                        }
                        onBlur={() => commitPresetDraft(index)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-destructive"
                        title="Hapus satuan jual ini"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeAt(index);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Contoh: 0.25, 0.5, 1 atau 0,25; 0,5; 1
                    </p>
                  </div>
                </div>
                {summary && (
                  <p className="rounded-md bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
                    {summary}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
  },
);

export const COMMON_STOCK_UNITS = [
  "m³",
  "kg",
  "pcs",
  "sak",
  "batang",
  "lembar",
  "dus",
  "liter",
  "zak",
  "roll",
  "unit",
] as const;

interface StockUnitFieldProps {
  value: string;
  onChange: (value: string) => void;
}

/** Dropdown satuan stok + opsi tambah satuan baru. */
export function StockUnitField({ value, onChange }: StockUnitFieldProps) {
  const options = useMemo(() => {
    const set = new Set<string>([...COMMON_STOCK_UNITS]);
    if (value.trim()) set.add(value.trim());
    return Array.from(set);
  }, [value]);

  const [customMode, setCustomMode] = useState(
    () => Boolean(value) && !(COMMON_STOCK_UNITS as readonly string[]).includes(value),
  );
  const [custom, setCustom] = useState(
    () =>
      Boolean(value) && !(COMMON_STOCK_UNITS as readonly string[]).includes(value) ? value : "",
  );

  return (
    <div className="space-y-1.5">
      <Label>Satuan stok (dasar)</Label>
      {!customMode ? (
        <select
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm"
          value={(COMMON_STOCK_UNITS as readonly string[]).includes(value) ? value : "__custom__"}
          onChange={(e) => {
            if (e.target.value === "__custom__") {
              setCustomMode(true);
              setCustom("");
              return;
            }
            onChange(e.target.value);
          }}
        >
          {options
            .filter((o) => (COMMON_STOCK_UNITS as readonly string[]).includes(o))
            .map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          <option value="__custom__">+ Tambah satuan baru…</option>
        </select>
      ) : (
        <div className="flex gap-2">
          <Input
            value={custom}
            placeholder="mis. rit, karung"
            onChange={(e) => {
              setCustom(e.target.value);
              onChange(e.target.value.trim() || "pcs");
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => {
              setCustomMode(false);
              if (!custom.trim()) onChange("pcs");
            }}
          >
            Daftar
          </Button>
        </div>
      )}
    </div>
  );
}
