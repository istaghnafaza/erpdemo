import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CreditCard,
  Database,
  LogOut,
  Pencil,
  RefreshCw,
  Search,
  Sparkles,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";
import { PlatformShell } from "@/components/platform/PlatformShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getPlatformDashboard } from "@/lib/api/platform";
import { angka, rupiah, tanggal } from "@/lib/format";
import { getTenantAccessStatus, tenantAccessLabel } from "@/lib/plan-config";
import { requirePlatformAdmin } from "@/routes/platform";
import { useAuthStore } from "@/stores/auth.store";
import type { PlatformDashboardData, PlatformTenantRow } from "@/types/platform";
import { toast } from "sonner";
import { PlatformTenantPlanDialog } from "@/components/platform/PlatformTenantPlanDialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/platform/dashboard")({
  beforeLoad: () => {
    requirePlatformAdmin();
  },
  head: () => ({
    meta: [{ title: "Platform Dashboard — SEPS" }],
  }),
  component: PlatformDashboardPage,
});

function planBadge(plan: string) {
  const colors: Record<string, string> = {
    trial: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    basic: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    pro: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
    enterprise: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  };
  return (
    <Badge variant="secondary" className={colors[plan] ?? ""}>
      {plan}
    </Badge>
  );
}

function PlatformDashboardPage() {
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.currentUser);
  const [data, setData] = useState<PlatformDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [manualOrderId, setManualOrderId] = useState("");
  const [markingPaid, setMarkingPaid] = useState(false);
  const [editTenant, setEditTenant] = useState<PlatformTenantRow | null>(null);
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTenants = useMemo(() => {
    if (!data?.tenants) return [];
    const q = searchQuery.trim().toLowerCase();
    return data.tenants.filter((tenant) => {
      if (planFilter !== "all" && tenant.plan !== planFilter) return false;
      const accessStatus = getTenantAccessStatus(tenant);
      if (statusFilter !== "all" && accessStatus !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        tenant.name,
        tenant.slug,
        tenant.ownerName ?? "",
        tenant.ownerEmail,
        tenant.phone ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [data?.tenants, planFilter, statusFilter, searchQuery]);

  const load = async () => {
    setLoading(true);
    const result = await getPlatformDashboard();
    if (result.error || !result.data) {
      toast.error(result.error ?? "Gagal memuat dashboard platform");
      setLoading(false);
      return;
    }
    setData(result.data);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const overview = data?.overview;

  return (
    <PlatformShell
      title="Platform Dashboard"
      subtitle="Monitor owner, langganan, dan kinerja toko untuk prospek bisnis"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/platform/finance">
              <CreditCard className="h-4 w-4 mr-2" />
              Keuangan & Pricing
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/platform/catalog">
              <Database className="h-4 w-4 mr-2" />
              Master Data Katalog
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/platform/price-compare">
              <Search className="h-4 w-4 mr-2" />
              Banding Harga
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await logout();
              window.location.href = "/login";
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Keluar
          </Button>
        </div>
      }
    >
      <div className="mb-6 rounded-xl border bg-muted/30 p-4 flex flex-wrap items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="font-semibold">Developer Console</div>
          <div className="text-sm text-muted-foreground">
            Masuk sebagai {user?.profile.name} ({user?.email})
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Toko Aktif</div>
              <div className="text-2xl font-bold mt-1">{overview ? angka(overview.totalTenants) : "—"}</div>
            </div>
            <Store className="h-5 w-5 text-primary" />
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Trial Aktif</div>
              <div className="text-2xl font-bold mt-1">
                {overview ? angka(overview.billing?.activeTrials ?? overview.trialTenants) : "—"}
              </div>
            </div>
            <CreditCard className="h-5 w-5 text-amber-500" />
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Omzet 30 Hari</div>
              <div className="text-2xl font-bold mt-1">
                {overview ? rupiah(overview.totalRevenue30d, { compact: true }) : "—"}
              </div>
            </div>
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Setup Pending</div>
              <div className="text-2xl font-bold mt-1">
                {overview ? angka(overview.onboardingPending) : "—"}
              </div>
            </div>
            <Building2 className="h-5 w-5 text-violet-500" />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
        <Card className="p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">MRR Paket</div>
          <div className="text-2xl font-bold mt-1">
            {overview?.billing ? rupiah(overview.billing.mrr, { compact: true }) : "—"}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Langganan active (tahunan /12)</p>
        </Card>
        <Card className="p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Konversi 7h</div>
          <div className="text-2xl font-bold mt-1">
            {overview?.billing ? `${overview.billing.trialToPaidConversion7dPct}%` : "—"}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Trial → paid ≤7 hari (kohort 30h)</p>
        </Card>
        <Card className="p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Past Due</div>
          <div className="text-2xl font-bold mt-1 text-amber-700 dark:text-amber-300">
            {overview?.billing ? angka(overview.billing.pastDueCount) : "—"}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Sub past_due / invoice failed 7h</p>
        </Card>
        <Card className="p-5">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Jatuh Tempo ≤7h</div>
          <div className="text-2xl font-bold mt-1">
            {overview?.billing ? angka(overview.billing.renewingWithin7d) : "—"}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Perlu follow-up perpanjang</p>
        </Card>
      </div>

      <Card className="p-4 mb-6 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-muted-foreground">Tandai lunas manual (order Midtrans)</label>
          <input
            className="mt-1 w-full h-9 rounded-md border bg-background px-3 text-sm"
            placeholder="seps-...-order-id"
            value={manualOrderId}
            onChange={(e) => setManualOrderId(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={markingPaid || !manualOrderId.trim()}
          onClick={async () => {
            setMarkingPaid(true);
            const { markPlanInvoicePaidManual } = await import("@/lib/api/plan-billing");
            const result = await markPlanInvoicePaidManual(manualOrderId.trim());
            setMarkingPaid(false);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            toast.success(`Plan ${result.data?.plan} diaktifkan`);
            setManualOrderId("");
            void load();
          }}
        >
          Tandai lunas
        </Button>
      </Card>

      <Card className="overflow-hidden">
        <div className="p-5 border-b space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-semibold text-lg">Daftar Owner / Toko</h2>
              <p className="text-sm text-muted-foreground">
                Data langganan, cabang aktif, dan performa transaksi 30 hari terakhir
              </p>
            </div>
            <Badge variant="outline" className="gap-1">
              <Users className="h-3.5 w-3.5" />
              {angka(filteredTenants.length)}
              {data && filteredTenants.length !== data.tenants.length
                ? ` / ${angka(data.tenants.length)}`
                : ""}{" "}
              tenant
            </Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Cari toko / owner</label>
              <Input
                placeholder="Nama toko, slug, email, HP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Filter plan</label>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua plan</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="basic">Basic</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Filter status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua status</SelectItem>
                  <SelectItem value="active">Aktif</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="trial_expired">Trial berakhir</SelectItem>
                  <SelectItem value="past_due">Langganan habis</SelectItem>
                  <SelectItem value="inactive">Nonaktif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Toko</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Kontak</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
                <TableHead className="text-right">Cabang</TableHead>
                <TableHead className="text-right">User</TableHead>
                <TableHead className="text-right">Tx 30h</TableHead>
                <TableHead className="text-right">Omzet 30h</TableHead>
                <TableHead>Terdaftar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-10 text-muted-foreground">
                    Memuat data...
                  </TableCell>
                </TableRow>
              ) : filteredTenants.length ? (
                filteredTenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell>
                      <div className="font-medium">{tenant.name}</div>
                      <div className="text-xs text-muted-foreground">/{tenant.slug}</div>
                    </TableCell>
                    <TableCell>
                      <div>{tenant.ownerName ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{tenant.ownerEmail}</div>
                    </TableCell>
                    <TableCell className="text-sm">{tenant.phone ?? "—"}</TableCell>
                    <TableCell>{planBadge(tenant.plan)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        {(() => {
                          const status = getTenantAccessStatus(tenant);
                          const locked = status === "trial_expired" || status === "past_due" || status === "inactive";
                          return (
                            <Badge variant={locked ? (status === "inactive" ? "secondary" : "destructive") : status === "trial" ? "outline" : "default"}>
                              {tenantAccessLabel(status)}
                            </Badge>
                          );
                        })()}
                        {!tenant.onboardingComplete ? (
                          <Badge variant="outline" className="text-amber-700 border-amber-300">
                            Setup pending
                          </Badge>
                        ) : null}
                        {tenant.plan === "trial" && tenant.trialEndsAt ? (
                          <span className="text-[11px] text-muted-foreground">
                            Trial s/d {tanggal(tenant.trialEndsAt)}
                          </span>
                        ) : null}
                        {tenant.plan !== "trial" && tenant.planRenewsAt ? (
                          <span className="text-[11px] text-muted-foreground">
                            Aktif s/d {tanggal(tenant.planRenewsAt)}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditTenant(tenant)}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Plan
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">{angka(tenant.activeBranchCount)}</TableCell>
                    <TableCell className="text-right">{angka(tenant.activeUserCount)}</TableCell>
                    <TableCell className="text-right">{angka(tenant.txCount30d)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {rupiah(tenant.revenue30d, { compact: true })}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {tanggal(tenant.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              ) : data?.tenants.length ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-10 text-muted-foreground">
                    Tidak ada tenant yang cocok dengan filter
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-10 text-muted-foreground">
                    Belum ada tenant terdaftar
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground mt-4">
        Tip: buka toko tenant dari browser dengan URL{" "}
        <code className="rounded bg-muted px-1">/{`{slug}`}/dashboard</code> setelah login sebagai
        owner masing-masing. Status toko mengikuti masa trial / tanggal aktif, bukan hanya flag akun.
      </p>
      <PlatformTenantPlanDialog
        tenant={editTenant}
        open={!!editTenant}
        onOpenChange={(open) => {
          if (!open) setEditTenant(null);
        }}
        onSaved={() => void load()}
      />
    </PlatformShell>
  );
}
