import { Building2, ChevronDown, Layers } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import { useOnboardingStore } from "@/stores/onboarding.store";
import { navigateToBranchSetup } from "@/lib/branch-setup-utils";
import { checkCanAddBranchClient } from "@/lib/plan-guard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// -----------------------------------------------------------------------------
// BranchSwitcher — dropdown listing active branches the current user may access.
// Owners get an extra "Semua Cabang (Konsolidasi)" option at the bottom that
// aggregates data across every branch instead of scoping to one.
// -----------------------------------------------------------------------------

export function BranchSwitcher() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);
  const currentTenant = useAuthStore((s) => s.currentTenant);
  const branches = useBranchStore((s) => s.branches);
  const branchLoading = useBranchStore((s) => s.isLoading);
  const activeBranch = useBranchStore((s) => s.activeBranch);
  const isConsolidated = useBranchStore((s) => s.isConsolidated);
  const setActiveBranch = useBranchStore((s) => s.setActiveBranch);
  const setConsolidated = useBranchStore((s) => s.setConsolidated);
  const startWizardSetup = useOnboardingStore((s) => s.startWizardSetup);

  const role = currentUser?.profile.role ?? "";
  const isOwner = role === "owner";

  const label = isConsolidated ? "Semua Cabang" : (activeBranch?.name ?? "Pilih cabang");

  const goToBranchSetup = () => {
    if (currentTenant?.onboarding_complete) {
      const activeCount = branches.filter((b) => b.is_active).length;
      const guard = checkCanAddBranchClient(currentTenant, activeCount);
      if (!guard.ok) {
        toast.error(guard.message, {
          action: { label: "Lihat Paket", onClick: () => navigate({ to: "/pricing" }) },
        });
        return;
      }
      useOnboardingStore.getState().startAddBranchSetup();
      navigate({ to: "/onboarding" });
      return;
    }
    navigateToBranchSetup({
      navigate,
      tenant: currentTenant,
      startWizardSetup,
    });
  };

  if (branchLoading) {
    return (
      <Button variant="ghost" size="sm" className="gap-2 -ml-2" disabled>
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <div className="text-left hidden sm:block">
          <div className="text-xs text-muted-foreground leading-none">Cabang</div>
          <div className="text-sm font-medium leading-tight text-muted-foreground">Memuat...</div>
        </div>
      </Button>
    );
  }

  if (branches.length === 0) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 -ml-2"
        disabled={!isOwner}
        onClick={isOwner ? goToBranchSetup : undefined}
      >
        <Building2 className="h-4 w-4 text-amber-500" />
        <div className="text-left hidden sm:block">
          <div className="text-xs text-muted-foreground leading-none">Cabang</div>
          <div className="text-sm font-medium leading-tight text-amber-700 dark:text-amber-300 truncate max-w-[140px]">
            {isOwner ? (currentTenant?.onboarding_complete ? "Tambah cabang" : "Setup toko") : "Belum ada toko"}
          </div>
        </div>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 -ml-2">
          {isConsolidated ? (
            <Layers className="h-4 w-4 text-primary" />
          ) : (
            <Building2 className="h-4 w-4 text-primary" />
          )}
          <div className="text-left hidden sm:block">
            <div className="text-xs text-muted-foreground leading-none">Cabang</div>
            <div className="text-sm font-medium leading-tight truncate max-w-[140px]">{label}</div>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Pilih cabang</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {branches.map((b) => (
          <DropdownMenuItem key={b.id} onClick={() => setActiveBranch(b)}>
            <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
            <span className="flex-1 truncate">{b.name}</span>
            {!isConsolidated && activeBranch?.id === b.id && (
              <Badge variant="secondary" className="ml-2 text-[10px]">
                Aktif
              </Badge>
            )}
          </DropdownMenuItem>
        ))}
        {isOwner && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setConsolidated(true, role)}>
              <Layers className="h-4 w-4 mr-2 text-primary" />
              <span className="flex-1">Semua Cabang (Konsolidasi)</span>
              {isConsolidated && (
                <Badge variant="secondary" className="ml-2 text-[10px]">
                  Aktif
                </Badge>
              )}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
