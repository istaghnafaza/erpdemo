// =============================================================================
// usePurchaseOrders — business logic PO (Fase 10).
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore, MOCK_TENANT_ID } from "@/stores/auth.store";
import { isNeonBackend } from "@/lib/api/backend";
import { useBranchStore } from "@/stores/branch.store";
import {
  usePurchasingStore,
  type CreatePoDraft,
} from "@/stores/purchasing.store";
import { useSalesOrdersStore } from "@/stores/sales-orders.store";
import { getPurchaseOrders, createPurchaseOrder, updatePurchaseOrderStatus, getSuppliers } from "@/lib/api/purchasing";
import { getBranchProducts } from "@/lib/api/products";
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
  const isMockTenant = tenantId === MOCK_TENANT_ID && !isNeonBackend();

  const [orders, setOrders] = useState<MockPoWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<DbPoType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<DbPoStatus | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [detailPo, setDetailPo] = useState<MockPoWithItems | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [products, setProducts] = useState<PoProductOption[]>([]);
  const [supplierList, setSupplierList] = useState(MOCK_SUPPLIER_LIST);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    if (isMockTenant) {
      let list = getAllMockPos();
      if (branchId) list = list.filter((p) => p.branch_id === branchId);
      setOrders(list);
      setLoading(false);
      return;
    }
    const result = await getPurchaseOrders(tenantId, branchId);
    setOrders((result.data ?? []) as MockPoWithItems[]);
    setLoading(false);
  }, [isMockTenant, getAllMockPos, branchId, tenantId]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!branchId) return;
    if (isMockTenant) {
      setProducts(
        getMockPosCatalog(branchId).map((bp) => ({
          productId: bp.product_id,
          sku: bp.product.sku,
          name: bp.product.name,
          unit: bp.product.unit,
          purchasePrice: bp.product.purchase_price,
        })),
      );
    } else {
      void getBranchProducts(tenantId, branchId).then((r) =>
        setProducts(
          (r.data ?? []).map((bp) => ({
            productId: bp.product_id,
            sku: bp.product.sku,
            name: bp.product.name,
            unit: bp.product.unit,
            purchasePrice: bp.product.purchase_price,
          })),
        ),
      );
      void getSuppliers(tenantId, { activeOnly: true }).then((r) => {
        if (r.data?.length) setSupplierList(r.data);
      });
    }
  }, [branchId, isMockTenant, tenantId]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (typeFilter !== "all" && o.type !== typeFilter) return false;
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      return true;
    });
  }, [orders, typeFilter, statusFilter]);

  const suppliers = isMockTenant ? MOCK_SUPPLIER_LIST : supplierList;

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
        await loadOrders();
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
      await loadOrders();
      return { success: true };
    },
    [user, branchId, isMockTenant, tenantId, createMockPo, loadOrders],
  );

  const sendPo = useCallback(
    async (poId: string) => {
      setActionLoading(true);
      if (isMockTenant) {
        const result = sendMockPo(poId);
        setActionLoading(false);
        if (!result.ok) return { success: false, error: result.error };
        await loadOrders();
        const updated = getAllMockPos().find((p) => p.id === poId);
        if (updated) setDetailPo(updated);
        return { success: true };
      }
      const result = await updatePurchaseOrderStatus(tenantId, poId, "sent");
      setActionLoading(false);
      if (result.error) return { success: false, error: result.error };
      await loadOrders();
      return { success: true };
    },
    [isMockTenant, sendMockPo, loadOrders, getAllMockPos, tenantId],
  );

  const cancelPo = useCallback(
    async (poId: string) => {
      setActionLoading(true);
      if (isMockTenant) {
        const result = cancelMockPo(poId);
        setActionLoading(false);
        if (!result.ok) return { success: false, error: result.error };
        setDetailPo(null);
        await loadOrders();
        return { success: true };
      }
      const result = await updatePurchaseOrderStatus(tenantId, poId, "cancelled");
      setActionLoading(false);
      if (result.error) return { success: false, error: result.error };
      setDetailPo(null);
      await loadOrders();
      return { success: true };
    },
    [isMockTenant, cancelMockPo, loadOrders, tenantId],
  );

  const receivablePos = useMemo(
    () =>
      orders.filter(
        (p) =>
          p.status === "sent" ||
          p.status === "partial_received",
      ),
    [orders],
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
    loadOrders,
  };
}
