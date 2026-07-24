import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, MapPin, Store, UserRound } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BranchSetupRequired } from "@/components/branches/BranchSetupRequired";
import {
  BranchFormDialog,
  toUpdateBranchPayload,
  type BranchFormValues,
} from "@/components/branches/BranchFormDialog";
import { TenantBusinessForm } from "@/components/branches/TenantBusinessForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTokoSayaPage } from "@/hooks/useTokoSayaPage";
import {
  deactivateBranch,
  forceCloseAllOpenCashierSessionsForBranch,
  getBranchCloseBlockers,
  updateBranch,
  type BranchCloseBlockers,
  type BranchWithManager,
} from "@/lib/api/branches";
import { requireAuth, requireFeature } from "@/routes/$tenantSlug";
import { useAuthStore } from "@/stores/auth.store";
import { useOnboardingStore } from "@/stores/onboarding.store";
import { navigateToBranchSetup } from "@/lib/branch-setup-utils";
import { toast } from "sonner";

export const Route = createFileRoute("/$tenantSlug/toko-saya")({
  beforeLoad: ({ params }) => {
    requireAuth();
    requireFeature(params.tenantSlug, "toko_saya");
  },
  head: () => ({
    meta: [
      { title: "Toko Saya — SEPS" },
      { name: "description", content: "Kelola cabang/toko bisnis Anda." },
    ],
  }),
  component: TokoSayaPage,
});

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function TokoSayaPage() {
  const { tenantSlug } = Route.useParams();
  const navigate = useNavigate();
  const currentTenant = useAuthStore((s) => s.currentTenant);
  const startWizardSetup = useOnboardingStore((s) => s.startWizardSetup);
  const {
    tenantId,
    tenant,
    setTenant,
    visibleBranches,
    managerCandidates,
    loading,
    showClosed,
    setShowClosed,
    activeCount,
    closedCount,
    reload,
  } = useTokoSayaPage();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<BranchWithManager | null>(null);
  const [closeTarget, setCloseTarget] = useState<BranchWithManager | null>(null);
  const [closeBlockers, setCloseBlockers] = useState<BranchCloseBlockers | null>(null);
  const [loadingBlockers, setLoadingBlockers] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closingSessions, setClosingSessions] = useState(false);

  const refreshCloseBlockers = async (branchId: string) => {
    setLoadingBlockers(true);
    const result = await getBranchCloseBlockers(tenantId, branchId);
    setLoadingBlockers(false);
    if (result.error) {
      toast.error(result.error);
      return null;
    }
    setCloseBlockers(result.data ?? null);
    return result.data ?? null;
  };

  const openEdit = (branch: BranchWithManager) => {
    setEditTarget(branch);
    setDialogOpen(true);
  };

  const openCloseDialog = async (branch: BranchWithManager) => {
    setCloseTarget(branch);
    setCloseBlockers(null);
    const blockers = await refreshCloseBlockers(branch.id);
    if (!blockers) setCloseTarget(null);
  };

  const handleForceCloseSessions = async () => {
    if (!closeTarget) return;
    setClosingSessions(true);
    const result = await forceCloseAllOpenCashierSessionsForBranch(tenantId, closeTarget.id);
    setClosingSessions(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    const { closedCount = 0, cancelledCarts = 0 } = result.data ?? {};
    toast.success(
      cancelledCarts > 0
        ? `${closedCount} sesi kasir ditutup (${cancelledCarts} keranjang dibatalkan)`
        : `${closedCount} sesi kasir ditutup`,
    );
    await refreshCloseBlockers(closeTarget.id);
  };

  const handleSubmit = async (values: BranchFormValues) => {
    if (!editTarget) return { ok: false, error: "Toko tidak dipilih" };
    const result = await updateBranch(tenantId, editTarget.id, toUpdateBranchPayload(values));
    if (result.error) {
      toast.error(result.error);
      return { ok: false, error: result.error };
    }
    toast.success("Toko diperbarui");
    await reload();
    return { ok: true };
  };

  const confirmClose = async () => {
    if (!closeTarget || closeBlockers?.blocked) return;
    setClosing(true);
    const result = await deactivateBranch(tenantId, closeTarget.id);
    setClosing(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Toko "${closeTarget.name}" ditutup`);
    setCloseTarget(null);
    setCloseBlockers(null);
    await reload();
  };

  const reopenBranch = async (branch: BranchWithManager) => {
    const result = await updateBranch(tenantId, branch.id, { is_active: true });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Toko "${branch.name}" dibuka kembali`);
    await reload();
  };

  const goToBranchSetup = () => {
    navigateToBranchSetup({
      navigate,
      tenant: currentTenant,
      startWizardSetup,
    });
  };

  return (
    <AppShell
      title="Toko Saya"
      subtitle="Kelola info bisnis dan cabang/toko — edit detail cabang atau tutup operasional."
    >
      <TenantBusinessForm tenant={tenant} onUpdated={setTenant} />

      {!loading && activeCount === 0 && (
        <div className="mb-6">
          <BranchSetupRequired
            isOwner
            onboardingComplete={tenant?.onboarding_complete ?? false}
            onSetup={goToBranchSetup}
            compact
          />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="p-5 shadow-card">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Toko Aktif
              </div>
              <div className="text-2xl font-bold mt-1">{activeCount}</div>
            </div>
            <div className="h-9 w-9 rounded-xl bg-green-500/15 text-green-600 grid place-items-center">
              <Store className="h-4 w-4" />
            </div>
          </div>
        </Card>
        <Card className="p-5 shadow-card">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Toko Tutup
              </div>
              <div className="text-2xl font-bold mt-1">{closedCount}</div>
            </div>
            <div className="h-9 w-9 rounded-xl bg-muted text-muted-foreground grid place-items-center">
              <Store className="h-4 w-4" />
            </div>
          </div>
        </Card>
        <Card className="p-5 shadow-card flex items-center">
          <div className="flex items-center gap-2">
            <Checkbox
              id="show-closed"
              checked={showClosed}
              onCheckedChange={(v) => setShowClosed(v === true)}
            />
            <Label htmlFor="show-closed" className="text-sm cursor-pointer">
              Tampilkan toko tutup
            </Label>
          </div>
        </Card>
      </div>

      <Card className="shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Toko</TableHead>
              <TableHead>Kode</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Alamat</TableHead>
              <TableHead>Telepon</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                  Memuat daftar toko...
                </TableCell>
              </TableRow>
            )}
            {!loading && visibleBranches.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                  {showClosed
                    ? "Belum ada toko. Tambahkan melalui Setup onboarding."
                    : "Tidak ada toko aktif. Centang “Tampilkan toko tutup” atau tambah via Setup."}
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              visibleBranches.map((branch) => (
                <TableRow key={branch.id} className={!branch.is_active ? "opacity-60" : undefined}>
                  <TableCell>
                    <div>
                      <div className="font-medium leading-none">{branch.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        Dibuat {formatDate(branch.created_at)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{branch.code}</code>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs">
                      <UserRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {branch.manager?.name ?? "—"}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <div className="flex items-start gap-1.5 text-xs leading-relaxed">
                      <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                      <span>{branch.address || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{branch.phone || "—"}</TableCell>
                  <TableCell>
                    {branch.is_active ? (
                      <Badge className="bg-success/15 text-success hover:bg-success/15">
                        Aktif
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Tutup</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(branch)}>
                        Edit
                      </Button>
                      {branch.is_active ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => void openCloseDialog(branch)}
                        >
                          Tutup
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => void reopenBranch(branch)}>
                          Buka Kembali
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </Card>

      <BranchFormDialog
        open={dialogOpen}
        branch={editTarget}
        managerCandidates={managerCandidates}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
      />

      <AlertDialog
        open={!!closeTarget}
        onOpenChange={(open) => {
          if (!open) {
            setCloseTarget(null);
            setCloseBlockers(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tutup toko ini?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Toko <strong>{closeTarget?.name}</strong> akan dinonaktifkan. Data historis tetap
                  tersimpan — pegawai tidak bisa memilih cabang ini di POS.
                </p>
                {loadingBlockers && <p>Memeriksa kondisi toko...</p>}
                {!loadingBlockers && closeBlockers?.blocked && (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive flex gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{closeBlockers.blockReason}</span>
                    </div>
                    {closeBlockers.openSessions.length > 0 && (
                      <div className="rounded-lg border p-3 space-y-2">
                        <p className="text-sm font-medium text-foreground">Sesi kasir terbuka</p>
                        <ul className="space-y-1.5">
                          {closeBlockers.openSessions.map((s) => (
                            <li
                              key={s.id}
                              className="flex flex-wrap items-center justify-between gap-2 text-sm"
                            >
                              <span className="font-medium text-foreground">{s.cashier_name}</span>
                              <span className="text-muted-foreground">
                                buka {formatDateTime(s.opened_at)}
                                {s.active_carts > 0
                                  ? ` · ${s.active_carts} keranjang aktif`
                                  : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs text-muted-foreground">
                          Kasir bisa menutup sesi manual di POS (menu Tutup Sesi). Owner dapat
                          menutup semua sesi sekaligus di bawah.
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={closingSessions}
                            onClick={() => void handleForceCloseSessions()}
                          >
                            {closingSessions ? "Menutup sesi..." : "Tutup semua sesi kasir"}
                          </Button>
                          <Button type="button" size="sm" variant="outline" asChild>
                            <Link to="/$tenantSlug/pos" params={{ tenantSlug }}>
                              Buka POS
                            </Link>
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {!loadingBlockers &&
                  closeBlockers &&
                  !closeBlockers.blocked &&
                  closeBlockers.warnings.length > 0 && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-amber-900 dark:text-amber-100">
                      <p className="font-medium flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="h-4 w-4" />
                        Peringatan
                      </p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {closeBlockers.warnings.map((w) => (
                          <li key={w}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={closing || closingSessions}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={closing || closingSessions || loadingBlockers || closeBlockers?.blocked}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void confirmClose();
              }}
            >
              {closing ? "Menutup..." : "Ya, Tutup Toko"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
