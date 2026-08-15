import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { FinanceSubNav } from "@/components/finance/FinanceSubNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CurrencyDisplay } from "@/components/ui/currency-display";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { isMockTenantId } from "@/lib/mock-session";
import { resolveScopedBranchIds } from "@/lib/branch-scope";
import { queryKeys } from "@/lib/query-keys";
import { getCashAccounts, listOwnerCapital, recordOwnerCapital } from "@/lib/api/finance";
import { isNeonBackend } from "@/lib/api/backend";
import { requireAuth, requireFeature } from "@/routes/$tenantSlug";
import { toast } from "sonner";
import { todayKeyInAppTz } from "@/lib/app-timezone";

export const Route = createFileRoute("/$tenantSlug/finance/owner-capital")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireFeature(params.tenantSlug, "owner_capital");
  },
  head: () => ({ meta: [{ title: "Prive / Setoran Owner — SEPS" }] }),
  component: OwnerCapitalPage,
});

function OwnerCapitalPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.currentUser);
  const branches = useBranchStore((s) => s.branches);
  const activeBranch = useBranchStore((s) => s.activeBranch);
  const isConsolidated = useBranchStore((s) => s.isConsolidated);
  const tenantId = currentUser?.tenantId ?? "";
  const isOwner = currentUser?.profile.role === "owner";
  const isMock = isMockTenantId(tenantId);

  const branchIds = useMemo(
    () =>
      resolveScopedBranchIds({
        branches,
        activeBranch,
        isConsolidated,
        isOwner,
      }),
    [branches, activeBranch, isConsolidated, isOwner],
  );

  const listQuery = useQuery({
    queryKey: queryKeys.ownerCapital(tenantId, branchIds),
    queryFn: async () => {
      const result = await listOwnerCapital(tenantId, [...branchIds]);
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
    enabled: isNeonBackend() && !isMock && Boolean(tenantId) && branchIds.length > 0,
  });

  const accountsQuery = useQuery({
    queryKey: ["cash-accounts", tenantId, activeBranch?.id],
    queryFn: async () => {
      const result = await getCashAccounts(tenantId, activeBranch?.id, { activeOnly: true });
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
    enabled: isNeonBackend() && !isMock && Boolean(tenantId) && Boolean(activeBranch?.id),
  });

  const [kind, setKind] = useState<"prive_keluar" | "setoran_owner">("prive_keluar");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [occurredAt, setOccurredAt] = useState(todayKeyInAppTz());

  const mutation = useMutation({
    mutationFn: async () => {
      if (!activeBranch?.id) throw new Error("Pilih cabang spesifik, bukan mode konsolidasi");
      const result = await recordOwnerCapital(tenantId, {
        branch_id: activeBranch.id,
        cash_account_id: accountId,
        kind,
        amount: Number(amount),
        occurred_at: occurredAt,
        notes: notes.trim() || null,
      });
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      toast.success(kind === "prive_keluar" ? "Prive dicatat" : "Setoran owner dicatat");
      setAmount("");
      setNotes("");
      void queryClient.invalidateQueries({ queryKey: queryKeys.ownerCapital(tenantId, branchIds) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.financeOverview(tenantId, branchIds) });
      void queryClient.invalidateQueries({ queryKey: ["cashflow-kpis"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const accounts = accountsQuery.data ?? [];
  const rows = listQuery.data ?? [];

  return (
    <AppShell
      title="Prive / Setoran Owner"
      subtitle="Mengubah kas, tidak masuk laba akuntansi"
    >
      <FinanceSubNav />

      <Card className="p-6 mb-6 max-w-xl space-y-3">
        <div>
          <Label className="text-xs">Jenis</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="prive_keluar">Prive keluar</SelectItem>
              <SelectItem value="setoran_owner">Setoran owner</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Akun kas/bank</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Pilih akun" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Tanggal</Label>
          <Input
            type="date"
            className="mt-1"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Nominal (Rp)</Label>
          <Input
            className="mt-1"
            value={amount ? Number(amount).toLocaleString("id-ID") : ""}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <div>
          <Label className="text-xs">Keterangan</Label>
          <Input className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <Button
          disabled={mutation.isPending || !accountId || !amount || isConsolidated}
          onClick={() => mutation.mutate()}
        >
          Simpan
        </Button>
        {isConsolidated && (
          <p className="text-xs text-muted-foreground">Pilih cabang spesifik untuk mencatat.</p>
        )}
      </Card>

      {listQuery.isPending ? (
        <LoadingSkeleton variant="table-row" count={4} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="p-3">Tanggal</th>
                <th className="p-3">Jenis</th>
                <th className="p-3">Keterangan</th>
                <th className="p-3 text-right">Nominal</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="p-3">{row.occurred_at}</td>
                  <td className="p-3">
                    {row.kind === "prive_keluar" ? "Prive keluar" : "Setoran owner"}
                  </td>
                  <td className="p-3 text-muted-foreground">{row.notes ?? "—"}</td>
                  <td className="p-3 text-right">
                    <CurrencyDisplay value={row.amount} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    Belum ada transaksi modal owner.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </AppShell>
  );
}
