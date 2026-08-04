import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import { isMockTenantId } from "@/lib/mock-session";
import {
  createSupplier,
  listSuppliersWithProductsApi,
  setSupplierProductLinksApi,
  updateSupplier,
} from "@/lib/api/purchasing";
import { getProducts } from "@/lib/api/products";
import { queryKeys } from "@/lib/query-keys";
import { canEdit } from "@/lib/rbac";
import { getMockPosCatalog } from "@/lib/mock-pos-catalog";
import { useBranchStore } from "@/stores/branch.store";
import {
  ensureMockSuppliersSeeded,
  useSuppliersStore,
  type SupplierFormInput,
} from "@/stores/suppliers.store";
import type { Product, SupplierWithProducts } from "@/types/database";

export interface SupplierProductOption {
  id: string;
  sku: string;
  name: string;
  unit: string;
}

export function useSuppliersPage() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.currentUser);
  const tenantId = currentUser?.tenantId ?? "";
  const user = currentUser?.profile ?? null;
  const branchId = useBranchStore((s) => s.activeBranch?.id) ?? "";
  const isMockTenant = isMockTenantId(tenantId);

  const [formOpen, setFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierWithProducts | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (isMockTenant) ensureMockSuppliersSeeded();
  }, [isMockTenant]);

  const mockSuppliers = useSuppliersStore((s) => s.suppliers);
  const mockLinks = useSuppliersStore((s) => s.productLinks);
  const createMockSupplier = useSuppliersStore((s) => s.createSupplier);
  const updateMockSupplier = useSuppliersStore((s) => s.updateSupplier);

  const suppliersQuery = useQuery({
    queryKey: queryKeys.suppliersWithProducts(tenantId),
    queryFn: async () => {
      const result = await listSuppliersWithProductsApi(tenantId);
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
    enabled: !isMockTenant && Boolean(tenantId),
    staleTime: 30_000,
  });

  const productsQuery = useQuery({
    queryKey: queryKeys.products(tenantId),
    queryFn: async () => {
      if (isMockTenant && branchId) {
        return getMockPosCatalog(branchId).map((bp) => bp.product);
      }
      const result = await getProducts(tenantId, { activeOnly: true });
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
    enabled: Boolean(tenantId) && (isMockTenant ? Boolean(branchId) : true),
    staleTime: 60_000,
  });

  const suppliers = useMemo((): SupplierWithProducts[] => {
    if (isMockTenant) {
      return useSuppliersStore.getState().listForTenant(tenantId);
    }
    return suppliersQuery.data ?? [];
  }, [isMockTenant, tenantId, suppliersQuery.data, mockSuppliers, mockLinks]);

  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.phone ?? "").toLowerCase().includes(q) ||
        (s.contact_person ?? "").toLowerCase().includes(q),
    );
  }, [suppliers, search]);

  const productOptions = useMemo((): SupplierProductOption[] => {
    return (productsQuery.data ?? []).map((p: Product) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      unit: p.unit,
    }));
  }, [productsQuery.data]);

  const productNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of productOptions) map.set(p.id, p.name);
    return map;
  }, [productOptions]);

  const canEditSuppliers = user ? canEdit(user.role, "purchasing") : false;
  const loading = !isMockTenant && suppliersQuery.isPending;

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.suppliersWithProducts(tenantId) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.suppliers(tenantId, true) });
  }, [queryClient, tenantId]);

  const openCreateForm = () => {
    setEditingSupplier(null);
    setFormOpen(true);
  };

  const openEditForm = (supplier: SupplierWithProducts) => {
    setEditingSupplier(supplier);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingSupplier(null);
  };

  const saveSupplier = useCallback(
    async (input: SupplierFormInput) => {
      setActionLoading(true);
      if (isMockTenant) {
        const result = editingSupplier
          ? updateMockSupplier(editingSupplier.id, input)
          : createMockSupplier(tenantId, input);
        setActionLoading(false);
        if (!result.ok) return { success: false, error: result.error };
        closeForm();
        return { success: true };
      }

      if (editingSupplier) {
        const { product_ids, preferred_product_id, ...updates } = input;
        const result = await updateSupplier(tenantId, editingSupplier.id, updates);
        if (result.error) {
          setActionLoading(false);
          return { success: false, error: result.error };
        }
        if (product_ids !== undefined) {
          const linkResult = await setSupplierProductLinksApi(
            tenantId,
            editingSupplier.id,
            product_ids,
            preferred_product_id,
          );
          if (linkResult.error) {
            setActionLoading(false);
            return { success: false, error: linkResult.error };
          }
        }
      } else {
        const { product_ids, preferred_product_id, ...payload } = input;
        const result = await createSupplier(tenantId, payload);
        if (result.error || !result.data) {
          setActionLoading(false);
          return { success: false, error: result.error ?? "Gagal membuat supplier" };
        }
        if (product_ids?.length) {
          const linkResult = await setSupplierProductLinksApi(
            tenantId,
            result.data.id,
            product_ids,
            preferred_product_id,
          );
          if (linkResult.error) {
            setActionLoading(false);
            return { success: false, error: linkResult.error };
          }
        }
      }

      setActionLoading(false);
      await refresh();
      closeForm();
      return { success: true };
    },
    [
      isMockTenant,
      editingSupplier,
      updateMockSupplier,
      createMockSupplier,
      tenantId,
      refresh,
    ],
  );

  return {
    user,
    canEdit: canEditSuppliers,
    loading,
    suppliers: filteredSuppliers,
    search,
    setSearch,
    productOptions,
    productNameById,
    formOpen,
    editingSupplier,
    actionLoading,
    openCreateForm,
    openEditForm,
    closeForm,
    saveSupplier,
  };
}
