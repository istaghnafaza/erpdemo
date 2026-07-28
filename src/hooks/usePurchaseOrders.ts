// =============================================================================
// usePurchaseOrders — business logic PO (Fase 10).
// =============================================================================

import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import { isMockTenantId } from "@/lib/mock-session";
import { useBranchStore } from "@/stores/branch.store";
import {
  usePurchasingStore,
  type CreatePoDraft,
} from "@/stores/purchasing.store";
import { useSalesOrdersStore } from "@/stores/sales-orders.store";
import {
  getPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  getSuppliers,
} from "@/lib/api/purchasing";
import { getBranchProducts } from "@/lib/api/products";
import { queryKeys } from "@/lib/query-keys";
import { getMockPosCatalog } from "@/lib/mock-pos-catalog";
import { MOCK_SUPPLIER_LIST, type MockPoWithItems } from "@/lib/mock-purchasing";
import { collectActiveIndentPoSoItemIds } from "@/lib/indent-po-guard";
import type { DbPoStatus, DbPoType } from "@/types/database";

export interface PoProductOption {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  purchasePrice: number;
}

/** Baris SO yang belum punya PO indent aktif — untuk form PO indent manual. */
export interface IndentSoItemOption {
  soItemId: string;
  salesOrderId: string;
  soNumber: string;
  label: string;
  customerName: string;
  deliveryAddress: string | null;
  productId: string | null;
  productName: string;
  sku: string;
  unit: string;
  remainingQty: number;
  purchasePrice: number;
}

export function usePurchaseOrders() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.currentUser);
  const activeBranch = useBranchStore((s) => s.activeBranch);
  const mockPurchaseOrders = usePurchasingStore((s) => s.mockPurchaseOrders);
  const getAllMockPos = usePurchasingStore((s) => s.getAllMockPos);
  const createMockPo = usePurchasingStore((s) => s.createMockPo);
  const sendMockPo = usePurchasingStore((s) => s.sendMockPo);
  const cancelMockPo = usePurchasingStore((s) => s.cancelMockPo);
  const mockSalesOrders = useSalesOrdersStore((s) => s.mockOrders);

  const user = currentUser?.profile ?? null;
  const tenantId = currentUser?.tenantId ?? "";
  const branchId = activeBranch?.id ?? "";
  const isMockTenant = isMockTenantId(tenantId);

  const [typeFilter, setTypeFilter] = useState<DbPoType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<DbPoStatus | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [detailPo, setDetailPo] = useState<MockPoWithItems | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const ordersQuery = useQuery({
    queryKey: queryKeys.purchaseOrders(tenantId, branchId),
    queryFn: async () => {
      const result = await getPurchaseOrders(tenantId, branchId);
      if (result.error) throw new Error(result.error);
      return (result.data ?? []) as MockPoWithItems[];
    },
    enabled: !isMockTenant && Boolean(tenantId && branchId),
    staleTime: 30_000,
  });

  const catalogQuery = useQuery({
    queryKey: queryKeys.posCatalog(tenantId, branchId),
    queryFn: async () => {
      const result = await getBranchProducts(tenantId, branchId);
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
    enabled: !isMockTenant && Boolean(tenantId && branchId),
    staleTime: 60_000,
  });

  const suppliersQuery = useQuery({
    queryKey: queryKeys.suppliers(tenantId, true),
    queryFn: async () => {
      const result = await getSuppliers(tenantId, { activeOnly: true });
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
    enabled: !isMockTenant && Boolean(tenantId),
    staleTime: 60_000,
  });

  const mockOrdersFiltered = useMemo(() => {
    let list = getAllMockPos();
    if (branchId) list = list.filter((p) => p.branch_id === branchId);
    return list;
  }, [getAllMockPos, branchId, mockPurchaseOrders]);

  const ordersRaw = isMockTenant ? mockOrdersFiltered : (ordersQuery.data ?? []);
  const loading = isMockTenant ? false : ordersQuery.isPending;

  const products = useMemo((): PoProductOption[] => {
    if (!branchId) return [];
    if (isMockTenant) {
      return getMockPosCatalog(branchId).map((bp) => ({
        productId: bp.product_id,
        sku: bp.product.sku,
        name: bp.product.name,
        unit: bp.product.unit,
        purchasePrice: bp.product.purchase_price,
      }));
    }
    return (catalogQuery.data ?? []).map((bp) => ({
      productId: bp.product_id,
      sku: bp.product.sku,
      name: bp.product.name,
      unit: bp.product.unit,
      purchasePrice: bp.product.purchase_price,
    }));
  }, [branchId, isMockTenant, catalogQuery.data]);

  const suppliers = isMockTenant
    ? MOCK_SUPPLIER_LIST
    : (suppliersQuery.data ?? []).length > 0
      ? suppliersQuery.data!
      : MOCK_SUPPLIER_LIST;

  const filteredOrders = useMemo(() => {
    return ordersRaw.filter((o) => {
      if (typeFilter !== "all" && o.type !== typeFilter) return false;
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      return true;
    });
  }, [ordersRaw, typeFilter, statusFilter]);

  const refreshOrders = useCallback(async () => {
    if (isMockTenant) return;
    await queryClient.invalidateQueries({
      queryKey: queryKeys.purchaseOrders(tenantId, branchId),
    });
  }, [isMockTenant, queryClient, tenantId, branchId]);

  const indentSoItemOptions = useMemo((): IndentSoItemOption[] => {
    const activeSoItemIds = collectActiveIndentPoSoItemIds(
      mockPurchaseOrders,
      mockSalesOrders,
    );
    const options: IndentSoItemOption[] = [];

    for (const so of mockSalesOrders) {
      if (so.status === "cancelled" || so.status === "draft") continue;
      if (branchId && so.branch_id !== branchId) continue;

      for (const item of so.items) {
        if (activeSoItemIds.has(item.id)) continue;
        const remaining = item.qty - item.delivered_qty;
        if (remaining <= 0) continue;

        const catalogProduct = products.find((p) => p.productId === item.product_id);

        options.push({
          soItemId: item.id,
          salesOrderId: so.id,
          soNumber: so.so_number,
          label: `${so.so_number} — ${item.product_name} (sisa ${remaining} ${item.unit})`,
          customerName: so.customer_name,
          deliveryAddress: so.delivery_address,
          productId: item.product_id,
          productName: item.product_name,
          sku: item.sku,
          unit: item.unit,
          remainingQty: remaining,
          purchasePrice: catalogProduct?.purchasePrice ?? 0,
        });
      }
    }

    return options;
  }, [mockPurchaseOrders, mockSalesOrders, branchId, products]);

  /** @deprecated gunakan indentSoItemOptions untuk PO indent */
  const salesOrderOptions = useMemo(
    () =>
      mockSalesOrders
        .filter((o) => o.status !== "cancelled" && o.status !== "draft")
        .map((o) => ({
          id: o.id,
          label: `${o.so_number} — ${o.customer_name}`,
          deliveryAddress: o.delivery_address,
        })),
    [mockSalesOrders],
  );

  const createPo = useCallback(
    async (draft: Omit<CreatePoDraft, "tenant_id" | "branch_id" | "created_by">) => {
      if (!user || !branchId) return { success: false, error: "Sesi tidak valid" };
      if (draft.items.length === 0) return { success: false, error: "Tambahkan minimal 1 item" };
      if (draft.type === "indent" && !draft.so_item_id) {
        return { success: false, error: "Pilih baris Sales Order untuk PO indent" };
      }
      if (draft.type === "indent" && !draft.sales_order_id) {
        return { success: false, error: "Referensi Sales Order wajib untuk PO indent" };
      }

      setActionLoading(true);
      if (isMockTenant) {
        const result = createMockPo({
          ...draft,
          tenant_id: tenantId,
          branch_id: branchId,
          created_by: user.id,
        });
        setActionLoading(false);
        if (!result.ok) return { success: false, error: result.error };
        setFormOpen(false);
        return { success: true };
      }

      const subtotal = draft.items.reduce((s, i) => s + i.ordered_qty * i.purchase_price, 0);
      const result = await createPurchaseOrder(
        tenantId,
        {
          branch_id: branchId,
          po_number: "",
          type: draft.type,
          sales_order_id: draft.sales_order_id,
          supplier_id: draft.supplier_id,
          delivery_address: draft.delivery_address,
          subtotal,
          grand_total: subtotal,
          status: "draft",
          expected_date: draft.expected_date,
          notes: draft.notes,
          created_by: user.id,
        },
        draft.items.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          sku: i.sku,
          unit: i.unit,
          ordered_qty: i.ordered_qty,
          received_qty: 0,
          purchase_price: i.purchase_price,
          subtotal: i.ordered_qty * i.purchase_price,
        })),
      );
      setActionLoading(false);
      if (result.error) return { success: false, error: result.error };
      setFormOpen(false);
      await refreshOrders();
      return { success: true };
    },
    [user, branchId, isMockTenant, tenantId, createMockPo, refreshOrders],
  );

  const sendPo = useCallback(
    async (poId: string) => {
      setActionLoading(true);
      if (isMockTenant) {
        const result = sendMockPo(poId);
        setActionLoading(false);
        if (!result.ok) return { success: false, error: result.error };
        const updated = getAllMockPos().find((p) => p.id === poId);
        if (updated) setDetailPo(updated);
        return { success: true };
      }
      const result = await updatePurchaseOrderStatus(tenantId, poId, "sent");
      setActionLoading(false);
      if (result.error) return { success: false, error: result.error };
      await refreshOrders();
      return { success: true };
    },
    [isMockTenant, sendMockPo, refreshOrders, getAllMockPos, tenantId],
  );

  const cancelPo = useCallback(
    async (poId: string) => {
      setActionLoading(true);
      if (isMockTenant) {
        const result = cancelMockPo(poId);
        setActionLoading(false);
        if (!result.ok) return { success: false, error: result.error };
        setDetailPo(null);
        return { success: true };
      }
      const result = await updatePurchaseOrderStatus(tenantId, poId, "cancelled");
      setActionLoading(false);
      if (result.error) return { success: false, error: result.error };
      setDetailPo(null);
      await refreshOrders();
      return { success: true };
    },
    [isMockTenant, cancelMockPo, refreshOrders, tenantId],
  );

  const receivablePos = useMemo(
    () =>
      ordersRaw.filter(
        (p) =>
          p.status === "sent" ||
          p.status === "partial_received",
      ),
    [ordersRaw],
  );

  return {
    user,
    branch: activeBranch,
    loading,
    orders: filteredOrders,
    receivablePos,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    suppliers,
    products,
    indentSoItemOptions,
    salesOrderOptions,
    formOpen,
    detailPo,
    setDetailPo,
    actionLoading,
    openCreateForm: () => setFormOpen(true),
    closeForm: () => setFormOpen(false),
    createPo,
    sendPo,
    cancelPo,
    loadOrders: refreshOrders,
  };
}
