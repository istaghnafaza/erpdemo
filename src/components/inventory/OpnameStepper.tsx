import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { cn } from "@/lib/utils";
import type { OpnameStep, OpnameLineItem } from "@/hooks/useStockOpname";

interface OpnameStepperProps {
  step: OpnameStep;
  categoryScope: string;
  onCategoryScopeChange: (v: string) => void;
  categories: string[];
  lineItems: (OpnameLineItem & { physical: number; discrepancy: number })[];
  summary: {
    totalItems: number;
    itemsWithDiff: number;
    shortageCount: number;
    surplusCount: number;
    estimatedLoss: number;
  };
  reference: string;
  branchName: string;
  canApprove: boolean;
  submitting: boolean;
  submitError: string | null;
  pendingApproval: boolean;
  onStart: () => void;
  onUpdatePhysical: (productId: string, value: number | "") => void;
  onGoToReview: () => void;
  onBack: () => void;
  onRequestApproval: () => void;
  onApprove: () => void;
  onReset: () => void;
}

const STEPS = [
  { n: 1, label: "Setup" },
  { n: 2, label: "Input" },
  { n: 3, label: "Review" },
];

export function OpnameStepper({
  step,
  categoryScope,
  onCategoryScopeChange,
  categories,
  lineItems,
  summary,
  reference,
  branchName,
  canApprove,
  submitting,
  submitError,
  pendingApproval,
  onStart,
  onUpdatePhysical,
  onGoToReview,
  onBack,
  onRequestApproval,
  onApprove,
  onReset,
}: OpnameStepperProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold border-2",
                step >= s.n
                  ? "bg-cyan-600 border-cyan-600 text-white"
                  : "border-muted-foreground/30 text-muted-foreground",
              )}
            >
              {step > s.n ? <Check className="h-4 w-4" /> : s.n}
            </div>
            <span
              className={cn(
                "text-sm font-medium hidden sm:inline",
                step >= s.n ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div className={cn("w-12 h-0.5", step > s.n ? "bg-cyan-600" : "bg-muted")} />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card className="p-6 max-w-md mx-auto space-y-4">
          <div>
            <h3 className="font-semibold">Mulai Sesi Stock Opname</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Cabang: <strong>{branchName}</strong>
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Ruang Lingkup</Label>
            <Select value={categoryScope} onValueChange={onCategoryScopeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full bg-cyan-600 hover:bg-cyan-700" onClick={onStart}>
            Mulai Opname
          </Button>
        </Card>
      )}

      {step === 2 && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <div>
              <div className="font-semibold">Input Stok Fisik</div>
              <div className="text-xs text-muted-foreground">{reference}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onBack}>
                Kembali
              </Button>
              <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700" onClick={onGoToReview}>
                Review
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[55vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-center">Stok Sistem</TableHead>
                  <TableHead className="text-center w-32">Stok Fisik</TableHead>
                  <TableHead className="text-center">Selisih</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((item) => (
                  <TableRow key={item.productId}>
                    <TableCell>
                      <div className="font-medium text-sm">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.sku}</div>
                    </TableCell>
                    <TableCell className="text-center">{item.systemStock}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        className="h-8 text-center"
                        value={item.physicalStock}
                        placeholder={String(item.systemStock)}
                        onChange={(e) => {
                          const v = e.target.value;
                          onUpdatePhysical(
                            item.productId,
                            v === "" ? "" : Math.max(0, Number(v)),
                          );
                        }}
                      />
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-center font-semibold",
                        item.discrepancy < 0 && "text-destructive",
                        item.discrepancy > 0 && "text-success",
                      )}
                    >
                      {item.discrepancy > 0 ? "+" : ""}
                      {item.discrepancy}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {submitError && (
            <p className="p-4 text-sm text-destructive border-t">{submitError}</p>
          )}
        </Card>
      )}

      {step === 3 && (
        <Card className="p-6 space-y-4 max-w-2xl mx-auto">
          <div>
            <h3 className="font-semibold">Review & Konfirmasi</h3>
            <p className="text-sm text-muted-foreground">{reference}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox label="Total Item" value={String(summary.totalItems)} />
            <StatBox label="Ada Selisih" value={String(summary.itemsWithDiff)} />
            <StatBox label="Kekurangan" value={String(summary.shortageCount)} danger />
            <StatBox label="Kelebihan" value={String(summary.surplusCount)} />
          </div>

          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
            <div className="text-sm text-muted-foreground">Estimasi Kerugian (selisih × HPP)</div>
            <div className="text-2xl font-bold text-destructive mt-1">
              <CurrencyDisplay value={summary.estimatedLoss} />
            </div>
          </div>

          {pendingApproval && !canApprove && (
            <div className="rounded-lg bg-warning/15 border border-warning/30 p-3 text-sm">
              Permintaan approval sudah dikirim ke manager. Menunggu persetujuan.
            </div>
          )}

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" onClick={onBack} disabled={submitting}>
              Kembali
            </Button>
            {!canApprove && (
              <Button variant="outline" onClick={onRequestApproval} disabled={pendingApproval}>
                Minta Approval Manager
              </Button>
            )}
            {canApprove && (
              <Button
                className="bg-cyan-600 hover:bg-cyan-700"
                disabled={submitting}
                onClick={() => void onApprove()}
              >
                {submitting ? "Memproses..." : "Approve & Adjust"}
              </Button>
            )}
            <Button variant="ghost" onClick={onReset}>
              Sesi Baru
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-3 text-center">
      <div className="text-[11px] text-muted-foreground uppercase">{label}</div>
      <div className={cn("text-lg font-bold mt-1", danger && "text-destructive")}>{value}</div>
    </div>
  );
}
