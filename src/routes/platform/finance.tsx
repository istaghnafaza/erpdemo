import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Calculator,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  applySuggestedPlanPricing,
  getPlatformFinance,
  previewPricingSuggestion,
  updatePlatformFinanceSettings,
  upsertPlatformPlanPricing,
} from "@/lib/api/platform-finance";
import { formatPlanPrice, type PaidTenantPlan } from "@/lib/plan-config";
import { requirePlatformAdmin } from "@/routes/platform";
import { angka, rupiah } from "@/lib/format";

export const Route = createFileRoute("/platform/finance")({
  beforeLoad: () => {
    requirePlatformAdmin();
  },
  head: () => ({
    meta: [{ title: "Keuangan & Pricing — Platform" }],
  }),
  component: PlatformFinancePage,
});

type DraftPlan = Record<PaidTenantPlan, { monthly: string; yearly: string }>;

type ExpenseDraft = { key: string; label: string; amount: string };

const DEFAULT_EXPENSE_LABELS = [
  "Hosting / Railway",
  "Database / Neon",
  "Midtrans & payment fee",
  "Support & operasional",
];

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function parseIdr(raw: string): number {
  const n = Number(String(raw).replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function newExpenseRow(label = "", amount = ""): ExpenseDraft {
  return { key: crypto.randomUUID(), label, amount };
}

function PlatformFinancePage() {
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);
  const [applying, setApplying] = useState(false);

  const [marginPct, setMarginPct] = useState("40");
  const [expectedTenants, setExpectedTenants] = useState("10");
  const [notes, setNotes] = useState("");
  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [activePaid, setActivePaid] = useState(0);
  const [expenses, setExpenses] = useState<ExpenseDraft[]>([
    newExpenseRow(DEFAULT_EXPENSE_LABELS[0], ""),
    newExpenseRow(DEFAULT_EXPENSE_LABELS[1], ""),
  ]);

  const [draftPlans, setDraftPlans] = useState<DraftPlan>({
    basic: { monthly: "599000", yearly: "499000" },
    pro: { monthly: "849000", yearly: "749000" },
    enterprise: { monthly: "2499000", yearly: "1999000" },
  });

  const [suggestion, setSuggestion] = useState<Awaited<
    ReturnType<typeof previewPricingSuggestion>
  >["data"]>(null);
  const [hppHistory, setHppHistory] = useState<
    Array<{ yearMonth: string; amount: number; notes: string | null }>
  >([]);

  const expenseTotal = useMemo(
    () => expenses.reduce((sum, row) => sum + parseIdr(row.amount), 0),
    [expenses],
  );

  const load = async (ym?: string) => {
    setLoading(true);
    const month = ym ?? yearMonth;
    const result = await getPlatformFinance(month);
    if (result.error || !result.data) {
      toast.error(result.error ?? "Gagal memuat keuangan platform");
      setLoading(false);
      return;
    }
    const data = result.data;
    setMarginPct(String(data.settings.targetMarginPct));
    setExpectedTenants(String(data.settings.expectedPayingTenants));
    setNotes(data.settings.notes ?? "");
    setYearMonth(data.activeYearMonth);
    setActivePaid(data.activePaidTenants);
    setSuggestion(data.suggestion);
    setHppHistory(
      data.hppEntries.map((e) => ({
        yearMonth: e.yearMonth,
        amount: e.amount,
        notes: e.notes,
      })),
    );

    if (data.expenses.length > 0) {
      setExpenses(
        data.expenses.map((e) => newExpenseRow(e.label, String(e.amount))),
      );
    } else {
      setExpenses([
        newExpenseRow(DEFAULT_EXPENSE_LABELS[0], ""),
        newExpenseRow(DEFAULT_EXPENSE_LABELS[1], ""),
        newExpenseRow(DEFAULT_EXPENSE_LABELS[2], ""),
        newExpenseRow(DEFAULT_EXPENSE_LABELS[3], ""),
      ]);
    }

    const next = { ...draftPlans };
    for (const row of data.pricing) {
      next[row.plan] = {
        monthly: String(row.monthly),
        yearly: String(row.yearly),
      };
    }
    setDraftPlans(next);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const livePreview = useMemo(
    () => ({
      monthlyHpp: expenseTotal,
      expectedPayingTenants: Math.max(1, parseIdr(expectedTenants)),
      targetMarginPct: Math.min(90, parseIdr(marginPct)),
    }),
    [expenseTotal, expectedTenants, marginPct],
  );

  const refreshSuggestion = async () => {
    const result = await previewPricingSuggestion(livePreview);
    if (result.error || !result.data) {
      toast.error(result.error ?? "Gagal hitung saran");
      return;
    }
    setSuggestion(result.data);
  };

  const saveSettings = async () => {
    const rows = expenses
      .map((e) => ({ label: e.label.trim(), amount: parseIdr(e.amount) }))
      .filter((e) => e.label || e.amount > 0);

    if (rows.length === 0) {
      toast.error("Tambahkan minimal satu pengeluaran");
      return;
    }
    if (rows.some((e) => !e.label)) {
      toast.error("Setiap baris pengeluaran wajib punya nama");
      return;
    }

    setSavingSettings(true);
    const result = await updatePlatformFinanceSettings({
      targetMarginPct: parseIdr(marginPct),
      expectedPayingTenants: Math.max(1, parseIdr(expectedTenants)),
      notes: notes.trim() || null,
      yearMonth: yearMonth.trim(),
      expenses: rows,
    });
    setSavingSettings(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`List pengeluaran tersimpan · total ${rupiah(result.data?.monthlyHpp ?? 0)}`);
    await load(yearMonth);
  };

  const savePricing = async () => {
    setSavingPricing(true);
    const plans = (["basic", "pro", "enterprise"] as PaidTenantPlan[]).map((plan) => ({
      plan,
      monthly: parseIdr(draftPlans[plan].monthly),
      yearly: parseIdr(draftPlans[plan].yearly),
      isActive: true,
    }));
    const result = await upsertPlatformPlanPricing(plans);
    setSavingPricing(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Harga paket live diperbarui — landing/checkout ikut berubah");
    await load(yearMonth);
  };

  const applySuggestion = async () => {
    setApplying(true);
    const rows = expenses
      .map((e) => ({ label: e.label.trim(), amount: parseIdr(e.amount) }))
      .filter((e) => e.label && e.amount >= 0);

    if (rows.length > 0) {
      await updatePlatformFinanceSettings({
        targetMarginPct: parseIdr(marginPct),
        expectedPayingTenants: Math.max(1, parseIdr(expectedTenants)),
        notes: notes.trim() || null,
        yearMonth: yearMonth.trim(),
        expenses: rows,
      });
    }

    const result = await applySuggestedPlanPricing();
    setApplying(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Saran harga diterapkan ke pricing live");
    await load(yearMonth);
  };

  return (
    <PlatformShell
      title="Keuangan & Pricing"
      subtitle="List pengeluaran HPP, harga paket remote, dan saran estimasi jual"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/platform/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Dashboard
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load(yearMonth)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-16 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> Memuat...
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Total HPP (list)
              </div>
              <div className="text-2xl font-bold mt-1">{rupiah(expenseTotal)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Jumlah {expenses.filter((e) => e.label.trim() || parseIdr(e.amount) > 0).length}{" "}
                pengeluaran · {yearMonth}
              </p>
            </Card>
            <Card className="p-5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Tenant berbayar aktif
              </div>
              <div className="text-2xl font-bold mt-1">{angka(activePaid)}</div>
              <p className="text-xs text-muted-foreground mt-1">Real-time dari Neon</p>
            </Card>
            <Card className="p-5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Target margin
              </div>
              <div className="text-2xl font-bold mt-1">{parseIdr(marginPct)}%</div>
              <p className="text-xs text-muted-foreground mt-1">Dipakai untuk lantai harga saran</p>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-lg">List pengeluaran HPP</h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Bulan (YYYY-MM)</Label>
                  <Input
                    value={yearMonth}
                    onChange={(e) => setYearMonth(e.target.value)}
                    onBlur={() => {
                      if (/^\d{4}-\d{2}$/.test(yearMonth.trim())) {
                        void load(yearMonth.trim());
                      }
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Margin target (%)</Label>
                  <Input
                    inputMode="numeric"
                    value={marginPct}
                    onChange={(e) => setMarginPct(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Estimasi tenant berbayar</Label>
                  <Input
                    inputMode="numeric"
                    value={expectedTenants}
                    onChange={(e) => setExpectedTenants(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Catatan bulan</Label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Opsional"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="hidden sm:grid sm:grid-cols-[1fr_140px_40px] gap-2 text-xs text-muted-foreground px-0.5">
                  <span>Nama pengeluaran</span>
                  <span>Nominal (Rp)</span>
                  <span />
                </div>
                {expenses.map((row, idx) => (
                  <div
                    key={row.key}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_140px_40px] gap-2 items-center"
                  >
                    <Input
                      placeholder={`Pengeluaran ${idx + 1} (contoh: Railway)`}
                      value={row.label}
                      onChange={(e) =>
                        setExpenses((prev) =>
                          prev.map((r) =>
                            r.key === row.key ? { ...r, label: e.target.value } : r,
                          ),
                        )
                      }
                    />
                    <Input
                      inputMode="numeric"
                      placeholder="0"
                      value={row.amount}
                      onChange={(e) =>
                        setExpenses((prev) =>
                          prev.map((r) =>
                            r.key === row.key ? { ...r, amount: e.target.value } : r,
                          ),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-destructive"
                      disabled={expenses.length <= 1}
                      onClick={() =>
                        setExpenses((prev) => prev.filter((r) => r.key !== row.key))
                      }
                      title="Hapus baris"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setExpenses((prev) => [...prev, newExpenseRow()])}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Tambah pengeluaran
                </Button>
                <div className="text-sm font-semibold">Total: {rupiah(expenseTotal)}</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void saveSettings()} disabled={savingSettings}>
                  {savingSettings ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Simpan list HPP
                </Button>
                <Button variant="outline" onClick={() => void refreshSuggestion()}>
                  <Calculator className="h-4 w-4 mr-2" />
                  Hitung ulang saran
                </Button>
              </div>

              {hppHistory.length > 0 ? (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium mb-2">Riwayat total HPP per bulan</h3>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto text-sm">
                    {hppHistory.map((row) => (
                      <button
                        key={row.yearMonth}
                        type="button"
                        className="w-full flex justify-between gap-2 rounded-md px-2 py-1 hover:bg-muted/60 text-left"
                        onClick={() => {
                          setYearMonth(row.yearMonth);
                          void load(row.yearMonth);
                        }}
                      >
                        <span className="text-muted-foreground">{row.yearMonth}</span>
                        <span className="font-medium">{rupiah(row.amount)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </Card>

            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-lg">Saran estimasi harga</h2>
              </div>
              {suggestion ? (
                <>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Dari total list {rupiah(expenseTotal)} → biaya/tenant ≈{" "}
                    {rupiah(suggestion.assumptions.costPerTenant)} → lantai (+
                    {suggestion.assumptions.targetMarginPct}%) ≈{" "}
                    {rupiah(suggestion.assumptions.floorPerTenant)}.
                  </p>
                  <div className="grid gap-3">
                    {(["basic", "pro", "enterprise"] as PaidTenantPlan[]).map((plan) => (
                      <div
                        key={plan}
                        className="flex items-center justify-between rounded-lg border px-3 py-2"
                      >
                        <div>
                          <div className="font-medium capitalize">{plan}</div>
                          <div className="text-xs text-muted-foreground">
                            Break-even @Pro: {angka(suggestion.insights.breakEvenTenantsAtPro)}{" "}
                            tenant
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div>{formatPlanPrice(suggestion.suggested[plan].monthly)}/bln</div>
                          <div className="text-muted-foreground">
                            thn {formatPlanPrice(suggestion.suggested[plan].yearly)}/bln
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
                    <p>
                      ARPU campuran ≈ <strong>{rupiah(suggestion.insights.blendedArpu)}</strong>
                    </p>
                    <p>
                      Kontribusi/tenant ≈{" "}
                      <strong>{rupiah(suggestion.insights.contributionPerTenant)}</strong>
                    </p>
                    <p>
                      Laba estimasi @target ≈{" "}
                      <strong>{rupiah(suggestion.insights.monthlyProfitAtTarget)}</strong>
                    </p>
                    <p className="text-muted-foreground pt-1">{suggestion.insights.affordableNote}</p>
                    <p className="text-muted-foreground">{suggestion.insights.worthNote}</p>
                  </div>
                  <Button onClick={() => void applySuggestion()} disabled={applying}>
                    {applying ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Terapkan saran ke harga live
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Isi list pengeluaran lalu hitung saran.
                </p>
              )}
            </Card>
          </div>

          <Card className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-lg">Harga paket live (remote)</h2>
                <p className="text-sm text-muted-foreground">
                  Perubahan langsung dipakai landing, /pricing, upgrade sheet, dan Midtrans
                  checkout.
                </p>
              </div>
              <Badge variant="secondary">Sumber: Neon</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {(["basic", "pro", "enterprise"] as PaidTenantPlan[]).map((plan) => (
                <div key={plan} className="rounded-xl border p-4 space-y-3">
                  <div className="font-semibold capitalize">{plan}</div>
                  <div className="space-y-1.5">
                    <Label>Bulanan (Rp)</Label>
                    <Input
                      inputMode="numeric"
                      value={draftPlans[plan].monthly}
                      onChange={(e) =>
                        setDraftPlans((prev) => ({
                          ...prev,
                          [plan]: { ...prev[plan], monthly: e.target.value },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tahunan /bulan (Rp)</Label>
                    <Input
                      inputMode="numeric"
                      value={draftPlans[plan].yearly}
                      onChange={(e) =>
                        setDraftPlans((prev) => ({
                          ...prev,
                          [plan]: { ...prev[plan], yearly: e.target.value },
                        }))
                      }
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Tagihan tahunan = nilai ini × 12
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={() => void savePricing()} disabled={savingPricing}>
              {savingPricing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Simpan harga live
            </Button>
          </Card>
        </div>
      )}
    </PlatformShell>
  );
}
