// =============================================================================
// useSalesOrders — business logic for Sales Order module (Fase 9).
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore, MOCK_TENANT_ID } from "@/stores/auth.store";
import { isNeonBackend } from "@/lib/api/backend";
import { isMockTenantId } from "@/lib/mock-session";
import { useBranchStore } from "@/stores/branch.store";
import { usePosStore } from "@/stores/pos.store";
import {
  useSalesOrdersStore,
  type CreateSoDraft,
  type CreateSoItemDraft,
  type UpdateSoDraft,
} from "@/stores/sales-orders.store";
import { getSalesOrders, createSalesOrder, updateSalesOrder, processItemFulfillment, convertSalesOrderToInvoice } from "@/lib/api/sales-orders";
import { getSuppliers } from "@/lib/api/purchasing";
import { getCustomers } from "@/lib/api/customers";
import { getBranchProducts } from "@/lib/api/products";
import { getMockPosCatalog } from "@/lib/mock-pos-catalog";
import { getMockTenantCustomers } from "@/stores/customers.store";
import { MOCK_SUPPLIERS, type MockSalesOrderWithDetails } from "@/lib/mock-sales-orders";
import { useInventoryStore } from "@/stores/inventory.store";
import type { Customer, DbSoStatus } from "@/types/database";

export interface SoProductOption {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  sellingPrice: number;
  availableStock: number;
}

export function useSalesOrders() {
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

  const [orders, setOrders] = useState<MockSalesOrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<DbSoStatus | "all">("all");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<SoProductOption[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<MockSalesOrderWithDetails | null>(null);
  const [detailOrder, setDetailOrder] = useState<MockSalesOrderWithDetails | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [supplierList, setSupplierList] = useState(MOCK_SUPPLIERS);

  const computeStock = useCallback(
    (productId: string, baseStock: number) => {
      const posDelta = mockStockDelta[productId] ?? 0;
      const invDelta = mockStockAdjustments[`${branchId}:${productId}`] ?? 0;
      return Math.max(0, baseStock + posDelta + invDelta);
    },
    [mockStockDelta, mockStockAdjustments, branchId],
  );

  const loadOrders = useCallback(async () => {
    setLoading(true);
    if (isMockTenant) {
      let list = mockOrders;
      if (branchId) list = list.filter((o) => o.branch_id === branchId);
      setOrders(list);
      setLoading(false);
      return;
    }
    const result = await getSalesOrders(tenantId, branchId, {
      status: statusFilter === "all" ? undefined : statusFilter,
    });
    setOrders((result.data ?? []) as MockSalesOrderWithDetails[]);
    setLoading(false);
  }, [isMockTenant, mockOrders, branchId, tenantId, statusFilter]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!tenantId || !branchId) return;
    if (isMockTenant) {
      setCustomers(
        getMockTenantCustomers(tenantId).filter((c) => c.type === "credit" || c.type === "retail"),
      );
      const catalog = getMockPosCatalog(branchId);
      setProducts(
        catalog.map((bp) => ({
          productId: bp.product_id,
          sku: bp.product.sku,
          name: bp.product.name,
          unit: bp.product.unit,
          sellingPrice: bp.selling_price,
          availableStock: computeStock(bp.product_id, bp.stock),
        })),
      );
    } else {
      void getCustomers(tenantId).then((r) => setCustomers(r.data ?? []));
      void getBranchProducts(tenantId, branchId).then((r) =>
        setProducts(
          (r.data ?? []).map((bp) => ({
            productId: bp.product_id,
            sku: bp.product.sku,
            name: bp.product.name,
            unit: bp.product.unit,
            sellingPrice: bp.selling_price,
            availableStock: bp.stock,
          })),
        ),
      );
      void getSuppliers(tenantId, { activeOnly: true }).then((r) => {
        if (r.data?.length) setSupplierList(r.data as typeof MOCK_SUPPLIERS);
      });
    }
  }, [tenantId, branchId, isMockTenant, computeStock]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === "all") return orders;
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  const suppliers = isMockTenant ? MOCK_SUPPLIERS : supplierList;

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
        await loadOrders();
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
      await loadOrders();
      return { success: true };
    },
    [user, branchId, isMockTenant, tenantId, createMockOrder, loadOrders],
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
        await loadOrders();
        const updated = useSalesOrdersStore.getState().mockOrders.find((o) => o.id === soId);
        if (updated) setDetailOrder(updated);
        return { success: true };
      }
      setActionLoading(false);
      return { success: false, error: "Fitur belum tersedia untuk tenant nyata" };
    },
    [user, branchId, isMockTenant, updateMockOrder, loadOrders],
  );

  const confirmOrder = useCallback(
    async (soId: string) => {
      setActionLoading(true);
      if (isMockTenant) {
        const result = confirmMockOrder(soId);
        setActionLoading(false);
        if (!result.ok) return { success: false, error: result.error };
        await loadOrders();
        setDetailOrder((prev) =>
          prev?.id === soId ? { ...prev, status: "confirmed" } : prev,
        );
        return { success: true };
      }
      const result = await updateSalesOrder(tenantId, soId, { status: "confirmed" });
      setActionLoading(false);
      if (result.error) return { success: false, error: result.error };
      await loadOrders();
      return { success: true };
    },
    [isMockTenant, confirmMockOrder, loadOrders, tenantId],
  );

  const cancelOrder = useCallback(
    async (soId: string) => {
      setActionLoading(true);
      if (isMockTenant) {
        const result = cancelMockOrder(soId);
        setActionLoading(false);
        if (!result.ok) return { success: false, error: result.error };
        setDetailOrder(null);
        await loadOrders();
        return { success: true };
      }
      const result = await updateSalesOrder(tenantId, soId, { status: "cancelled" });
      setActionLoading(false);
      if (result.error) return { success: false, error: result.error };
      setDetailOrder(null);
      await loadOrders();
      return { success: true };
    },
    [isMockTenant, cancelMockOrder, loadOrders, tenantId],
  );

  const fulfillItem = useCallback(
    async (
      soId: string,
      soItemId: string,
      stockQty: number,
      indentQty: number,
      supplierId?: string,
    ) => {
      setActionLoading(true);
      if (isMockTenant) {
        const result = processFulfillment(soId, soItemId, stockQty, indentQty, supplierId);
        setActionLoading(false);
        if (!result.ok) return { success: false, error: result.error };
        await loadOrders();
        const updated = useSalesOrdersStore.getState().mockOrders.find((o) => o.id === soId);
        if (updated) setDetailOrder(updated);
        return { success: true };
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
      await loadOrders();
      return { success: true };
    },
    [isMockTenant, processFulfillment, loadOrders, tenantId, user],
  );

  const invoiceFromSo = useCallback(
    async (soId: string) => {
      setActionLoading(true);
      if (isMockTenant) {
        const result = convertToInvoice(soId);
        setActionLoading(false);
        if (!result.ok) return { success: false, error: result.error };
        await loadOrders();
        const updated = useSalesOrdersStore.getState().mockOrders.find((o) => o.id === soId);
        if (updated) setDetailOrder(updated);
        return { success: true, invoiceNumber: result.invoiceNumber };
      }
      const result = await convertSalesOrderToInvoice(tenantId, soId);
      setActionLoading(false);
      if (result.error) return { success: false, error: result.error };
      await loadOrders();
      return { success: true, invoiceNumber: result.data?.invoiceNumber };
    },
    [isMockTenant, convertToInvoice, loadOrders, tenantId],
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
    orders: filteredOrders,
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
    loadOrders,
  };
}

export type { CreateSoItemDraft, UpdateSoDraft };
