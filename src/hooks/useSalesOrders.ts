// =============================================================================
// useSalesOrders — business logic for Sales Order module (Fase 9).
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth.store";
import { isMockTenantId } from "@/lib/mock-session";
import { useBranchStore } from "@/stores/branch.store";
import { usePosStore } from "@/stores/pos.store";
import {
  useSalesOrdersStore,
  type CreateSoDraft,
  type CreateSoItemDraft,
  type UpdateSoDraft,
} from "@/stores/sales-orders.store";
import {
  getSalesOrders,
  getSalesOrder,
  createSalesOrder,
  updateSalesOrder,
  processItemFulfillment,
  convertSalesOrderToInvoice,
} from "@/lib/api/sales-orders";
import {
  listSuppliersWithProductsApi,
} from "@/lib/api/purchasing";
import { getCustomers } from "@/lib/api/customers";
import { getBranchProducts } from "@/lib/api/products";
import { queryKeys } from "@/lib/query-keys";
import { getMockPosCatalog } from "@/lib/mock-pos-catalog";
import { getMockTenantCustomers } from "@/stores/customers.store";
import { type MockSalesOrderWithDetails } from "@/lib/mock-sales-orders";
import { mapNeonSalesOrderToDetails } from "@/lib/map-neon-sales-order";
import { soOrderNeedsFulfillment } from "@/lib/so-fulfillment-utils";
import {
  formatIndentSupplierOrderMessage,
  openSupplierWhatsAppOrder,
} from "@/lib/supplier-wa-order";
import type { FulfillItemResult } from "@/lib/api/sales-orders";
import { ensureMockSuppliersSeeded, useSuppliersStore } from "@/stores/suppliers.store";
import { useInventoryStore } from "@/stores/inventory.store";
import type { Customer, DbSoStatus } from "@/types/database";

export type SoStatusFilter = DbSoStatus | "all" | "pending_fulfillment";

export interface SoSupplierOption {
  id: string;
  name: string;
  phone?: string | null;
}

export interface SoProductOption {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  sellingPrice: number;
  availableStock: number;
}

export function useSalesOrders() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.currentUser);
  const activeBranch = useBranchStore((s) => s.activeBranch);
  const mockStockDelta = usePosStore((s) => s.mockStockDelta);
  const mockStockAdjustments = useInventoryStore((s) => s.mockStockAdjustments);
  const mockOrders = useSalesOrdersStore((s) => s.mockOrders);
  const createMockOrder = useSalesOrdersStore((s) => s.createMockOrder);
  const updateMockOrder = useSalesOrdersStore((s) => s.updateMockOrder);
  const confirmMockOrder = useSalesOrdersStore((s) => s.confirmMockOrder);
  const cancelMockOrder = useSalesOrdersStore((s) => s.cancelMockOrder);
  const processFulfillment = useSalesOrdersStore((s) => s.processFulfillment);
  const convertToInvoice = useSalesOrdersStore((s) => s.convertToInvoice);

  const user = currentUser?.profile ?? null;
  const tenantId = currentUser?.tenantId ?? "";
  const branchId = activeBranch?.id ?? "";
  const isMockTenant = isMockTenantId(tenantId);

  const [statusFilter, setStatusFilter] = useState<SoStatusFilter>("pending_fulfillment");
  const [formOpen, setFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<MockSalesOrderWithDetails | null>(null);
  const [detailOrder, setDetailOrder] = useState<MockSalesOrderWithDetails | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const computeStock = useCallback(
    (productId: string, baseStock: number) => {
      const posDelta = mockStockDelta[productId] ?? 0;
      const invDelta = mockStockAdjustments[`${branchId}:${productId}`] ?? 0;
      return Math.max(0, baseStock + posDelta + invDelta);
    },
    [mockStockDelta, mockStockAdjustments, branchId],
  );

  const ordersQuery = useQuery({
    queryKey: queryKeys.salesOrders(tenantId, branchId, statusFilter),
    queryFn: async () => {
      const result = await getSalesOrders(tenantId, branchId, {
        status:
          statusFilter === "all" || statusFilter === "pending_fulfillment"
            ? undefined
            : statusFilter,
      });
      if (result.error) throw new Error(result.error);
      return (result.data ?? []).map(mapNeonSalesOrderToDetails) as MockSalesOrderWithDetails[];
    },
    enabled: !isMockTenant && Boolean(tenantId && branchId),
    staleTime: 30_000,
  });

  const customersQuery = useQuery({
    queryKey: queryKeys.posCustomers(tenantId),
    queryFn: async () => {
      const result = await getCustomers(tenantId);
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
    enabled: !isMockTenant && Boolean(tenantId && branchId),
    staleTime: 60_000,
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

  const mockSupplierRows = useSuppliersStore((s) => s.suppliers);
  const mockProductLinks = useSuppliersStore((s) => s.productLinks);

  useEffect(() => {
    if (isMockTenant) ensureMockSuppliersSeeded();
  }, [isMockTenant]);

  const suppliersWithProductsQuery = useQuery({
    queryKey: queryKeys.suppliersWithProducts(tenantId),
    queryFn: async () => {
      const result = await listSuppliersWithProductsApi(tenantId);
      if (result.error) throw new Error(result.error);
      return result.data ?? [];
    },
    enabled: !isMockTenant && Boolean(tenantId),
    staleTime: 60_000,
  });

  const mockOrdersFiltered = useMemo(() => {
    let list = mockOrders;
    if (branchId) list = list.filter((o) => o.branch_id === branchId);
    if (statusFilter === "pending_fulfillment") {
      list = list.filter(soOrderNeedsFulfillment);
    } else if (statusFilter !== "all") {
      list = list.filter((o) => o.status === statusFilter);
    }
    return list;
  }, [mockOrders, branchId, statusFilter]);

  const ordersRaw = isMockTenant ? mockOrdersFiltered : (ordersQuery.data ?? []);

  const orders = useMemo(() => {
    let list = ordersRaw;
    if (!isMockTenant && statusFilter === "pending_fulfillment") {
      list = list.filter(soOrderNeedsFulfillment);
    }
    return [...list].sort((a, b) => {
      const aPending = soOrderNeedsFulfillment(a) ? 0 : 1;
      const bPending = soOrderNeedsFulfillment(b) ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [ordersRaw, isMockTenant, statusFilter]);
  const loading = isMockTenant ? false : ordersQuery.isPending;

  const customers = useMemo((): Customer[] => {
    if (!tenantId || !branchId) return [];
    if (isMockTenant) {
      return getMockTenantCustomers(tenantId).filter(
        (c) => c.type === "credit" || c.type === "retail",
      );
    }
    return customersQuery.data ?? [];
  }, [tenantId, branchId, isMockTenant, customersQuery.data]);

  const products = useMemo((): SoProductOption[] => {
    if (!branchId) return [];
    if (isMockTenant) {
      return getMockPosCatalog(branchId).map((bp) => ({
        productId: bp.product_id,
        sku: bp.product.sku,
        name: bp.product.name,
        unit: bp.product.unit,
        sellingPrice: bp.selling_price,
        availableStock: computeStock(bp.product_id, bp.stock),
      }));
    }
    return (catalogQuery.data ?? []).map((bp) => ({
      productId: bp.product_id,
      sku: bp.product.sku,
      name: bp.product.name,
      unit: bp.product.unit,
      sellingPrice: bp.selling_price,
      availableStock: bp.stock,
    }));
  }, [branchId, isMockTenant, catalogQuery.data, computeStock]);

  const suppliers = useMemo((): SoSupplierOption[] => {
    if (isMockTenant) {
      return useSuppliersStore
        .getState()
        .listForTenant(tenantId)
        .filter((s) => s.is_active)
        .map((s) => ({ id: s.id, name: s.name, phone: s.phone }));
    }
    const rows = suppliersWithProductsQuery.data ?? [];
    return rows.filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name, phone: s.phone }));
  }, [isMockTenant, tenantId, suppliersWithProductsQuery.data, mockSupplierRows, mockProductLinks]);

  const getSuppliersForProduct = useCallback(
    (productId: string | null): SoSupplierOption[] => {
      if (!productId) return suppliers;
      if (isMockTenant) {
        return useSuppliersStore
          .getState()
          .getSuppliersForProduct(productId, true)
          .map((s) => ({ id: s.id, name: s.name, phone: s.phone }));
      }
      const rows = suppliersWithProductsQuery.data ?? [];
      const linked = rows.filter(
        (s) => s.is_active && s.product_ids.includes(productId),
      );
      if (linked.length === 0) {
        return rows.filter((s) => s.is_active).map((s) => ({ id: s.id, name: s.name, phone: s.phone }));
      }
      return linked.map((s) => ({ id: s.id, name: s.name, phone: s.phone }));
    },
    [suppliers, isMockTenant, suppliersWithProductsQuery.data],
  );

  const getDefaultSupplierId = useCallback(
    (productId: string | null): string | undefined => {
      if (!productId) return suppliers[0]?.id;
      if (isMockTenant) {
        return useSuppliersStore.getState().getPreferredSupplierIdForProduct(productId) ?? undefined;
      }
      const rows = suppliersWithProductsQuery.data ?? [];
      const linked = rows.filter((s) => s.is_active && s.product_ids.includes(productId));
      return linked[0]?.id ?? suppliers[0]?.id;
    },
    [suppliers, isMockTenant, suppliersWithProductsQuery.data],
  );

  const refetchOrders = useCallback(async (): Promise<MockSalesOrderWithDetails[]> => {
    if (isMockTenant) {
      let list = useSalesOrdersStore.getState().mockOrders;
      if (branchId) list = list.filter((o) => o.branch_id === branchId);
      if (statusFilter === "pending_fulfillment") {
        list = list.filter(soOrderNeedsFulfillment);
      } else if (statusFilter !== "all") {
        list = list.filter((o) => o.status === statusFilter);
      }
      return list;
    }
    return queryClient.fetchQuery({
      queryKey: queryKeys.salesOrders(tenantId, branchId, statusFilter),
      queryFn: async () => {
        const result = await getSalesOrders(tenantId, branchId, {
          status:
            statusFilter === "all" || statusFilter === "pending_fulfillment"
              ? undefined
              : statusFilter,
        });
        if (result.error) throw new Error(result.error);
        return (result.data ?? []).map(mapNeonSalesOrderToDetails) as MockSalesOrderWithDetails[];
      },
    });
  }, [isMockTenant, queryClient, tenantId, branchId, statusFilter]);

  const refreshOrders = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.salesOrders(tenantId, branchId, statusFilter),
    });
    await refetchOrders();
  }, [queryClient, tenantId, branchId, statusFilter, refetchOrders]);

  const syncDetailOrder = useCallback(
    async (soId: string) => {
      if (isMockTenant) {
        const updated = useSalesOrdersStore.getState().mockOrders.find((o) => o.id === soId);
        if (updated) setDetailOrder(updated);
        return;
      }
      const result = await getSalesOrder(tenantId, soId);
      if (result.data) {
        setDetailOrder(mapNeonSalesOrderToDetails(result.data));
      } else {
        const list = await refetchOrders();
        setDetailOrder(list.find((o) => o.id === soId) ?? null);
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders(tenantId, branchId, statusFilter),
      });
    },
    [isMockTenant, tenantId, branchId, statusFilter, refetchOrders, queryClient],
  );

  const openCreateForm = useCallback(() => {
    setEditingOrder(null);
    setFormOpen(true);
  }, []);

  const openEditForm = useCallback((order: MockSalesOrderWithDetails) => {
    setEditingOrder(order);
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setEditingOrder(null);
  }, []);

  const createOrder = useCallback(
    async (draft: Omit<CreateSoDraft, "tenant_id" | "branch_id" | "created_by">) => {
      if (!user || !branchId) return { success: false, error: "Sesi tidak valid" };
      if (draft.items.length === 0) return { success: false, error: "Tambahkan minimal 1 item" };

      setActionLoading(true);
      if (isMockTenant) {
        createMockOrder({
          ...draft,
          tenant_id: tenantId,
          branch_id: branchId,
          created_by: user.id,
        });
        setActionLoading(false);
        setFormOpen(false);
        return { success: true };
      }

      const subtotal = draft.items.reduce(
        (s, i) => s + i.qty * i.selling_price - i.discount,
        0,
      );
      const grandTotal = Math.max(0, subtotal - draft.discount_amount);
      const result = await createSalesOrder(
        tenantId,
        {
          branch_id: branchId,
          so_number: "",
          customer_id: draft.customer_id,
          customer_name: draft.customer_name,
          delivery_address: draft.delivery_address,
          subtotal,
          discount_amount: draft.discount_amount,
          grand_total: grandTotal,
          down_payment: draft.down_payment,
          status: "draft",
          payment_status:
            draft.down_payment >= grandTotal
              ? "paid"
              : draft.down_payment > 0
                ? "partial"
                : "unpaid",
          estimated_delivery_date: draft.estimated_delivery_date,
          notes: draft.notes,
          created_by: user.id,
        },
        draft.items.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          sku: i.sku,
          unit: i.unit,
          qty: i.qty,
          selling_price: i.selling_price,
          discount: i.discount,
          subtotal: i.qty * i.selling_price - i.discount,
          delivered_qty: 0,
          status: "pending",
        })),
      );
      setActionLoading(false);
      if (result.error) return { success: false, error: result.error };
      setFormOpen(false);
      await refreshOrders();
      return { success: true };
    },
    [user, branchId, isMockTenant, tenantId, createMockOrder, refreshOrders],
  );

  const updateOrder = useCallback(
    async (soId: string, draft: UpdateSoDraft) => {
      if (!user || !branchId) return { success: false, error: "Sesi tidak valid" };
      if (draft.items.length === 0) return { success: false, error: "Tambahkan minimal 1 item" };

      setActionLoading(true);
      if (isMockTenant) {
        const result = updateMockOrder(soId, draft);
        setActionLoading(false);
        if (!result.ok) return { success: false, error: result.error };
        setFormOpen(false);
        setEditingOrder(null);
        const updated = useSalesOrdersStore.getState().mockOrders.find((o) => o.id === soId);
        if (updated) setDetailOrder(updated);
        return { success: true };
      }
      setActionLoading(false);
      return { success: false, error: "Fitur belum tersedia untuk tenant nyata" };
    },
    [user, branchId, isMockTenant, updateMockOrder],
  );

  const confirmOrder = useCallback(
    async (soId: string) => {
      setActionLoading(true);
      if (isMockTenant) {
        const result = confirmMockOrder(soId);
        setActionLoading(false);
        if (!result.ok) return { success: false, error: result.error };
        const updated = useSalesOrdersStore.getState().mockOrders.find((o) => o.id === soId);
        if (updated) setDetailOrder(updated);
        return { success: true };
      }
      const result = await updateSalesOrder(tenantId, soId, { status: "confirmed" });
      setActionLoading(false);
      if (result.error) return { success: false, error: result.error };
      await syncDetailOrder(soId);
      return { success: true };
    },
    [isMockTenant, confirmMockOrder, syncDetailOrder, tenantId],
  );

  const cancelOrder = useCallback(
    async (soId: string) => {
      setActionLoading(true);
      if (isMockTenant) {
        const result = cancelMockOrder(soId);
        setActionLoading(false);
        if (!result.ok) return { success: false, error: result.error };
        setDetailOrder(null);
        return { success: true };
      }
      const result = await updateSalesOrder(tenantId, soId, { status: "cancelled" });
      setActionLoading(false);
      if (result.error) return { success: false, error: result.error };
      setDetailOrder(null);
      await refreshOrders();
      return { success: true };
    },
    [isMockTenant, cancelMockOrder, refreshOrders, tenantId],
  );

  const dispatchIndentWa = useCallback(
    (indentPo: NonNullable<FulfillItemResult["indentPo"]>) => {
      const message = formatIndentSupplierOrderMessage({
        customerName: indentPo.customerName,
        deliveryAddress: indentPo.deliveryAddress,
        lines: [
          {
            productName: indentPo.productName,
            sku: indentPo.sku,
            qty: indentPo.qty,
            unit: indentPo.unit,
          },
        ],
        notes: indentPo.notes,
      });
      return openSupplierWhatsAppOrder(indentPo.supplierPhone, message);
    },
    [],
  );

  const fulfillItem = useCallback(
    async (
      soId: string,
      soItemId: string,
      stockQty: number,
      indentQty: number,
      supplierId?: string,
    ): Promise<{
      success: boolean;
      error?: string;
      indentPo?: FulfillItemResult["indentPo"];
      waOpened?: boolean;
    }> => {
      setActionLoading(true);
      if (isMockTenant) {
        const result = processFulfillment(soId, soItemId, stockQty, indentQty, supplierId);
        setActionLoading(false);
        if (!result.ok) return { success: false, error: result.error };
        const updated = useSalesOrdersStore.getState().mockOrders.find((o) => o.id === soId);
        if (updated) setDetailOrder(updated);
        const waOpened = result.indentPo ? dispatchIndentWa(result.indentPo) : false;
        return { success: true, indentPo: result.indentPo, waOpened };
      }
      const result = await processItemFulfillment(
        tenantId,
        soId,
        soItemId,
        stockQty,
        indentQty,
        user!.id,
        supplierId,
      );
      setActionLoading(false);
      if (result.error) return { success: false, error: result.error };
      await syncDetailOrder(soId);
      const indentPo = result.data?.indentPo;
      const waOpened = indentPo ? dispatchIndentWa(indentPo) : false;
      return { success: true, indentPo, waOpened };
    },
    [isMockTenant, processFulfillment, syncDetailOrder, tenantId, user, dispatchIndentWa],
  );

  const invoiceFromSo = useCallback(
    async (soId: string) => {
      setActionLoading(true);
      if (isMockTenant) {
        const result = convertToInvoice(soId);
        setActionLoading(false);
        if (!result.ok) return { success: false, error: result.error };
        const updated = useSalesOrdersStore.getState().mockOrders.find((o) => o.id === soId);
        if (updated) setDetailOrder(updated);
        return { success: true, invoiceNumber: result.invoiceNumber };
      }
      const result = await convertSalesOrderToInvoice(tenantId, soId);
      setActionLoading(false);
      if (result.error) return { success: false, error: result.error };
      await syncDetailOrder(soId);
      return { success: true, invoiceNumber: result.data?.invoiceNumber };
    },
    [isMockTenant, convertToInvoice, syncDetailOrder, tenantId],
  );

  const getProductStock = useCallback(
    (productId: string) => {
      const p = products.find((x) => x.productId === productId);
      return p?.availableStock ?? 0;
    },
    [products],
  );

  return {
    user,
    branch: activeBranch,
    loading,
    orders,
    statusFilter,
    setStatusFilter,
    customers,
    products,
    suppliers,
    formOpen,
    editingOrder,
    detailOrder,
    setDetailOrder,
    actionLoading,
    openCreateForm,
    openEditForm,
    closeForm,
    createOrder,
    updateOrder,
    confirmOrder,
    cancelOrder,
    fulfillItem,
    invoiceFromSo,
    getProductStock,
    getSuppliersForProduct,
    getDefaultSupplierId,
    loadOrders: refreshOrders,
  };
}

export type { CreateSoItemDraft, UpdateSoDraft };
