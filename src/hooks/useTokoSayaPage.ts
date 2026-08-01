import { useCallback, useEffect, useMemo, useState } from "react";
import { getBranchesWithManager, type BranchWithManager } from "@/lib/api/branches";
import { getTenant } from "@/lib/api/tenants";
import { listTenantUsers } from "@/lib/api/users";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import type { TenantUserRecord } from "@/types/app";
import type { Tenant } from "@/types/database";

export function useTokoSayaPage() {
  const tenantId = useAuthStore((s) => s.currentUser?.tenantId) ?? "";
  const currentUser = useAuthStore((s) => s.currentUser);
  const loadBranches = useBranchStore((s) => s.loadBranches);

  const [tenant, setTenant] = useState<Tenant | null>(useAuthStore.getState().currentTenant);
  const [branches, setBranches] = useState<BranchWithManager[]>([]);
  const [users, setUsers] = useState<TenantUserRecord[]>([]);
  const [managerCandidates, setManagerCandidates] = useState<TenantUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClosed, setShowClosed] = useState(false);

  const reload = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const [branchResult, tenantResult, usersResult] = await Promise.all([
      getBranchesWithManager(tenantId),
      getTenant(tenantId),
      listTenantUsers(tenantId),
    ]);
    setBranches(branchResult.data ?? []);
    const allUsers = usersResult.data ?? [];
    setUsers(allUsers);
    if (tenantResult.data) setTenant(tenantResult.data);
    setManagerCandidates(
      allUsers.filter(
        (u) => u.isActive && (u.role === "owner" || u.role === "manager"),
      ),
    );
    setLoading(false);
    if (currentUser) {
      await loadBranches(tenantId, currentUser.allowedBranchIds, currentUser.isOwner);
    }
  }, [tenantId, currentUser, loadBranches]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const visibleBranches = useMemo(
    () => (showClosed ? branches : branches.filter((b) => b.is_active)),
    [branches, showClosed],
  );

  const activeCount = branches.filter((b) => b.is_active).length;
  const closedCount = branches.length - activeCount;
  const activeUserCount = useMemo(
    () => users.filter((u) => u.isActive).length,
    [users],
  );

  return {
    tenantId,
    tenant,
    setTenant,
    branches,
    visibleBranches,
    managerCandidates,
    loading,
    showClosed,
    setShowClosed,
    activeCount,
    activeUserCount,
    closedCount,
    reload,
  };
}
