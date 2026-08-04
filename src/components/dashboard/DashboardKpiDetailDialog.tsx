import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { Separator } from "@/components/ui/separator";
import {
  DASHBOARD_KPI_LABELS,
  type DashboardKpiId,
} from "@/stores/dashboard-preferences.store";
import type { DashboardPeriod } from "@/hooks/useDashboard";
import { ArrowUpRight } from "lucide-react";

export interface DashboardKpiDetailData {
  period: DashboardPeriod;
  periodLabel: string;
  sales: {
    total: number;
    transactions: number;
    marginPct: number;
    compareLabel?: string;
    deltaPct?: number;
  };
  profit: {
    grossProfit: number;
    netProfit: number;
    opex: number;
    marginPct: number;
    compareLabel?: string;
    deltaGrossPct?: number;
    deltaNetPct?: number;
  };
  stock: {
    criticalCount: number;
    lowCount: number;
  };
  receivables: {
    overdueTotal: number;
    customerCount: number;
  };
  cash: {
    totalBalance: number;
    accountCount: number;
  };
}

interface DashboardKpiDetailDialogProps {
  kpiId: DashboardKpiId | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: DashboardKpiDetailData;
  tenantSlug: string;
}

function DetailRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
      </div>
      <div className="text-sm font-semibold text-right shrink-0">{value}</div>
    </div>
  );
}

function FormulaBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/50 border px-3 py-2 text-xs text-muted-foreground leading-relaxed">
      {children}
    </div>
  );
}

export function DashboardKpiDetailDialog({
  kpiId,
  open,
  onOpenChange,
  data,
  tenantSlug,
}: DashboardKpiDetailDialogProps) {
  if (!kpiId) return null;

  const title = DASHBOARD_KPI_LABELS[kpiId];
  const { sales, profit, stock, receivables, cash } = data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Rincian periode <strong>{data.periodLabel}</strong> — diperbarui realtime dari transaksi
            POS &amp; kas cabang aktif.
          </DialogDescription>
        </DialogHeader>

        {kpiId === "sales" && (
          <div className="space-y-3">
            <DetailRow
              label="Total penjualan"
              value={<CurrencyDisplay value={sales.total} />}
              hint="Jumlah grand total transaksi selesai (termasuk baris Sales Order)."
            />
            <DetailRow
              label="Jumlah transaksi"
              value={`${sales.transactions} transaksi`}
            />
            <DetailRow
              label="Margin rata-rata"
              value={`${sales.marginPct}%`}
              hint="Keuntungan kotor ÷ penjualan. Baris SO tidak masuk perhitungan margin."
            />
            <Separator />
            <FormulaBlock>
              <strong>Cara hitung:</strong> Σ grandTotal transaksi <em>completed</em> pada periode
              ini. Margin rata-rata = (Σ subtotal − harga beli per baris stok) ÷ penjualan. Baris
              Semua baris penjualan (stok dan SO) ikut perhitungan omzet dan keuntungan.
            </FormulaBlock>
            <Link
              to="/$tenantSlug/sales"
              params={{ tenantSlug }}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Buka Histori Penjualan <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {kpiId === "gross_profit" && (
          <div className="space-y-3">
            <DetailRow
              label="Keuntungan kotor"
              value={<CurrencyDisplay value={profit.grossProfit} />}
              hint="Selisih harga jual vs harga beli per baris stok."
            />
            <DetailRow label="Penjualan periode" value={<CurrencyDisplay value={sales.total} />} />
            <DetailRow label="Margin" value={`${profit.marginPct}%`} />
            <Separator />
            <FormulaBlock>
              <strong>Cara hitung:</strong> Untuk setiap baris penjualan (kecuali SO):{" "}
              <em>subtotal − (harga beli × qty)</em>. Hasilnya dijumlahkan per periode. Angka ini
              sama dengan ringkasan margin di Histori Penjualan bila filter tanggal sama.
            </FormulaBlock>
            <p className="text-xs text-muted-foreground">
              Jika margin terlihat negatif padahal histori positif, biasanya karena baris SO
              sebelumnya ikut dihitung — sudah diperbaiki agar konsisten dengan histori. Retur
              barang mengurangi keuntungan transaksi asal secara proporsional (qty dikembalikan).
            </p>
          </div>
        )}

        {kpiId === "net_profit" && (
          <div className="space-y-3">
            <DetailRow
              label="Keuntungan kotor"
              value={<CurrencyDisplay value={profit.grossProfit} />}
            />
            <DetailRow
              label="Biaya operasional"
              value={<CurrencyDisplay value={profit.opex} />}
              hint="Pengeluaran kas (kecuali Pembelian/HPP)."
            />
            <DetailRow
              label="Laba bersih"
              value={<CurrencyDisplay value={profit.netProfit} />}
              hint="Keuntungan kotor − biaya operasional."
            />
            <Separator />
            <FormulaBlock>
              <strong>Cara hitung:</strong> Laba Bersih = Keuntungan Kotor − Biaya Operasional.
              Biaya operasional diambil dari transaksi kas tipe <em>expense</em> dengan kategori
              selain Pembelian/HPP (mis. gaji, sewa, listrik).
            </FormulaBlock>
            <Link
              to="/$tenantSlug/finance"
              params={{ tenantSlug }}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Buka Modul Keuangan <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {kpiId === "critical_stock" && (
          <div className="space-y-3">
            <DetailRow
              label="Stok kritis"
              value={`${stock.criticalCount} produk`}
              hint="Stok ≤ 50% reorder point atau habis."
            />
            <DetailRow
              label="Stok menipis"
              value={`${stock.lowCount} produk`}
              hint="Di bawah reorder point tetapi belum kritis."
            />
            <Separator />
            <FormulaBlock>
              Data diambil dari stok cabang aktif vs titik reorder masing-masing produk. Periksa
              dan restock sebelum stok habis total.
            </FormulaBlock>
            <Link
              to="/$tenantSlug/inventory"
              params={{ tenantSlug }}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Buka Inventori <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {kpiId === "overdue_ar" && (
          <div className="space-y-3">
            <DetailRow
              label="Total piutang jatuh tempo"
              value={<CurrencyDisplay value={receivables.overdueTotal} />}
            />
            <DetailRow
              label="Pelanggan terdampak"
              value={`${receivables.customerCount} pelanggan`}
            />
            <Separator />
            <FormulaBlock>
              Piutang dengan sisa tagihan &gt; 0 dan tanggal jatuh tempo sudah lewat (overdue).
              Tidak terikat filter periode dashboard — selalu snapshot terkini.
            </FormulaBlock>
            <Link
              to="/$tenantSlug/receivables"
              params={{ tenantSlug }}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Buka Piutang <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {kpiId === "cash_balance" && (
          <div className="space-y-3">
            <DetailRow
              label="Total saldo"
              value={<CurrencyDisplay value={cash.totalBalance} />}
            />
            <DetailRow
              label="Akun aktif"
              value={`${cash.accountCount} akun kas & bank`}
            />
            <Separator />
            <FormulaBlock>
              Jumlah saldo semua akun kas &amp; bank aktif di cabang yang sedang dipilih. Diperbarui
              setiap transaksi kas masuk/keluar.
            </FormulaBlock>
            <Link
              to="/$tenantSlug/finance"
              params={{ tenantSlug }}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Buka Kas & Bank <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
