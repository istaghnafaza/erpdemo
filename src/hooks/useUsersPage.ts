import { useCallback, useEffect, useMemo, useState } from "react";
import { listTenantUsers } from "@/lib/api/users";
import { useAuthStore } from "@/stores/auth.store";
import { useBranchStore } from "@/stores/branch.store";
import type { TenantUserRecord } from "@/types/app";

export function useUsersPage() {
  const tenantId = useAuthStore((s) => s.currentUser?.tenantId) ?? "";
  const currentUserId = useAuthStore((s) => s.currentUser?.id) ?? "";
  const branches = useBranchStore((s) => s.branches);

  const [users, setUsers] = useState<TenantUserRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const branchNameById = useMemo(
    () => Object.fromEntries(branches.map((b) => [b.id, b.name])),
    [branches],
  );

  const reload = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const result = await listTenantUsers(tenantId);
    setUsers(result.data ?? []);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    tenantId,
    currentUserId,
    users,
    loading,
    branches,
    branchNameById,
    reload,
  };
}
