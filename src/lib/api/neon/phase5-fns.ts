// =============================================================================
// Neon RPC — Phase 5 (purchasing, sales orders, transfers, reports)
// =============================================================================

import { createServerFn } from "@tanstack/react-start";
import type { DateRangeFilter } from "@/types/app";
import type {
  GoodsReceiptInsert,
  GrItemInsert,
  OpnameItem,
  PoItemInsert,
  PurchaseOrder,
  PurchaseOrderInsert,
  PurchaseOrderUpdate,
  SalesOrder,
  SalesOrderInsert,
  SalesOrderItemInsert,
  SalesOrderUpdate,
  SoFulfillment,
  SoFulfillmentInsert,
  StockTransfer,
  StockTransferInsert,
  StockTransferItemInsert,
  Supplier,
  SupplierInsert,
  SupplierUpdate,
} from "@/types/database";

async function requireTenant(tenantId: string) {
  const { assertTenant, requireRequestSession } = await import("@/server/auth/request-session");
  const session = await requireRequestSession();
  assertTenant(session, tenantId);
  return session;
}

// --- Purchasing ---

export const neonGetSuppliers = createServerFn({ method: "POST" })
  .validator(
    (data: { tenantId: string; options?: { activeOnly?: boolean; search?: string } }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { listSuppliers } = await import("@/server/services/purchasing");
    return listSuppliers(data.tenantId, data.options);
  });

export const neonGetSupplier = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; supplierId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { getSupplierById } = await import("@/server/services/purchasing");
    const supplier = await getSupplierById(data.tenantId, data.supplierId);
    if (!supplier) throw new Error("Supplier tidak ditemukan");
    return supplier;
  });

export const neonCreateSupplier = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; payload: Omit<SupplierInsert, "tenant_id"> }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { createSupplierRecord } = await import("@/server/services/purchasing");
    return createSupplierRecord(data.tenantId, data.payload);
  });

export const neonUpdateSupplier = createServerFn({ method: "POST" })
  .validator(
    (data: { tenantId: string; supplierId: string; updates: SupplierUpdate }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { updateSupplierById } = await import("@/server/services/purchasing");
    const supplier = await updateSupplierById(data.tenantId, data.supplierId, data.updates);
    if (!supplier) throw new Error("Supplier tidak ditemukan");
    return supplier;
  });

export const neonGetPurchaseOrders = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      branchId?: string;
      options?: { status?: PurchaseOrder["status"]; supplierId?: string };
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { listPurchaseOrders } = await import("@/server/services/purchasing");
    return listPurchaseOrders(data.tenantId, data.branchId, data.options);
  });

export const neonGetPurchaseOrder = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; poId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { getPurchaseOrderById } = await import("@/server/services/purchasing");
    const po = await getPurchaseOrderById(data.tenantId, data.poId);
    if (!po) throw new Error("PO tidak ditemukan");
    return po;
  });

export const neonCreatePurchaseOrder = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      po: Omit<PurchaseOrderInsert, "tenant_id">;
      items: Omit<PoItemInsert, "po_id" | "tenant_id">[];
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { createPurchaseOrderRecord } = await import("@/server/services/purchasing");
    return createPurchaseOrderRecord(data.tenantId, data.po, data.items);
  });

export const neonUpdatePurchaseOrderStatus = createServerFn({ method: "POST" })
  .validator(
    (data: { tenantId: string; poId: string; status: PurchaseOrder["status"] }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { updatePurchaseOrderStatusById } = await import("@/server/services/purchasing");
    const po = await updatePurchaseOrderStatusById(data.tenantId, data.poId, data.status);
    if (!po) throw new Error("PO tidak ditemukan");
    return po;
  });

export const neonGetGoodsReceipts = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; branchId?: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { listGoodsReceipts } = await import("@/server/services/purchasing");
    return listGoodsReceipts(data.tenantId, data.branchId);
  });

export const neonCreateGoodsReceipt = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      gr: Omit<GoodsReceiptInsert, "tenant_id">;
      items: Omit<GrItemInsert, "gr_id" | "tenant_id">[];
      userId: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { createGoodsReceiptRecord } = await import("@/server/services/purchasing");
    return createGoodsReceiptRecord(data.tenantId, data.gr, data.items, data.userId);
  });

// --- Sales orders ---

export const neonGetSalesOrders = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      branchId?: string;
      options?: { status?: SalesOrder["status"]; customerId?: string };
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { listSalesOrders } = await import("@/server/services/sales-orders");
    return listSalesOrders(data.tenantId, data.branchId, data.options);
  });

export const neonGetSalesOrder = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; soId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { getSalesOrderById } = await import("@/server/services/sales-orders");
    const so = await getSalesOrderById(data.tenantId, data.soId);
    if (!so) throw new Error("Sales Order tidak ditemukan");
    return so;
  });

export const neonCreateSalesOrder = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      so: Omit<SalesOrderInsert, "tenant_id">;
      items: Omit<SalesOrderItemInsert, "so_id" | "tenant_id">[];
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { createSalesOrderRecord } = await import("@/server/services/sales-orders");
    return createSalesOrderRecord(data.tenantId, data.so, data.items);
  });

export const neonUpdateSalesOrder = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; soId: string; updates: SalesOrderUpdate }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { updateSalesOrderById } = await import("@/server/services/sales-orders");
    const so = await updateSalesOrderById(data.tenantId, data.soId, data.updates);
    if (!so) throw new Error("Sales Order tidak ditemukan");
    return so;
  });

export const neonAddDownPayment = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; soId: string; amount: number }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { addDownPaymentToSo } = await import("@/server/services/sales-orders");
    const so = await addDownPaymentToSo(data.tenantId, data.soId, data.amount);
    if (!so) throw new Error("Sales Order tidak ditemukan");
    return so;
  });

export const neonCreateFulfillment = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      soItemId: string;
      payload: Omit<SoFulfillmentInsert, "tenant_id" | "so_item_id">;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { createFulfillmentRecord } = await import("@/server/services/sales-orders");
    return createFulfillmentRecord(data.tenantId, data.soItemId, data.payload);
  });

export const neonGetFulfillmentsByItem = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; soItemId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { listFulfillmentsByItemId } = await import("@/server/services/sales-orders");
    return listFulfillmentsByItemId(data.tenantId, data.soItemId);
  });

export const neonUpdateFulfillmentStatus = createServerFn({ method: "POST" })
  .validator(
    (data: { tenantId: string; fulfillmentId: string; status: SoFulfillment["status"] }) =>
      data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { updateFulfillmentStatusById } = await import("@/server/services/sales-orders");
    const row = await updateFulfillmentStatusById(
      data.tenantId,
      data.fulfillmentId,
      data.status,
    );
    if (!row) throw new Error("Fulfillment tidak ditemukan");
    return row;
  });

export const neonProcessItemFulfillment = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      soId: string;
      soItemId: string;
      stockQty: number;
      indentQty: number;
      userId: string;
      supplierId?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { processItemFulfillment } = await import("@/server/services/sales-orders");
    await processItemFulfillment(
      data.tenantId,
      data.soId,
      data.soItemId,
      data.stockQty,
      data.indentQty,
      data.userId,
      data.supplierId,
    );
    return { ok: true };
  });

export const neonConvertSalesOrderToInvoice = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; soId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { convertSalesOrderToInvoice } = await import("@/server/services/sales-orders");
    return convertSalesOrderToInvoice(data.tenantId, data.soId);
  });

// --- Transfers & opname ---

export const neonSubmitOpname = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      branchId: string;
      userId: string;
      reference: string;
      items: OpnameItem[];
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { submitOpnameRecord } = await import("@/server/services/transfers");
    return submitOpnameRecord(
      data.tenantId,
      data.branchId,
      data.userId,
      data.reference,
      data.items,
    );
  });

export const neonGetStockTransfers = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      branchId?: string;
      options?: { status?: StockTransfer["status"]; dateRange?: DateRangeFilter };
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { listStockTransfers } = await import("@/server/services/transfers");
    return listStockTransfers(data.tenantId, data.branchId, data.options);
  });

export const neonGetStockTransfer = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; transferId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { getStockTransferById } = await import("@/server/services/transfers");
    const tf = await getStockTransferById(data.tenantId, data.transferId);
    if (!tf) throw new Error("Transfer tidak ditemukan");
    return tf;
  });

export const neonCreateStockTransfer = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      transfer: Omit<StockTransferInsert, "tenant_id">;
      items: Omit<StockTransferItemInsert, "transfer_id" | "tenant_id">[];
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { createStockTransferRecord } = await import("@/server/services/transfers");
    return createStockTransferRecord(data.tenantId, data.transfer, data.items);
  });

export const neonSendStockTransfer = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; transferId: string; userId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { sendStockTransferRecord } = await import("@/server/services/transfers");
    const tf = await sendStockTransferRecord(data.tenantId, data.transferId, data.userId);
    if (!tf) throw new Error("Transfer tidak ditemukan");
    return tf;
  });

export const neonConfirmStockTransferReceived = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      transferId: string;
      userId: string;
      receivedQties: Record<string, number>;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { confirmStockTransferReceivedRecord } = await import("@/server/services/transfers");
    const tf = await confirmStockTransferReceivedRecord(
      data.tenantId,
      data.transferId,
      data.userId,
      data.receivedQties,
    );
    if (!tf) throw new Error("Transfer tidak ditemukan");
    return tf;
  });

export const neonCancelStockTransfer = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; transferId: string; userId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { cancelStockTransferRecord } = await import("@/server/services/transfers");
    const tf = await cancelStockTransferRecord(data.tenantId, data.transferId, data.userId);
    if (!tf) throw new Error("Transfer tidak ditemukan");
    return tf;
  });

// --- Reports ---

export const neonGetDailySales = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; branchId: string; dateRange: DateRangeFilter }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { getDailySalesReport } = await import("@/server/services/reports");
    return getDailySalesReport(data.tenantId, data.branchId, data.dateRange);
  });

export const neonGetTopProducts = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      branchId: string;
      dateRange: DateRangeFilter;
      limit?: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { getTopProductsReport } = await import("@/server/services/reports");
    return getTopProductsReport(
      data.tenantId,
      data.branchId,
      data.dateRange,
      data.limit ?? 10,
    );
  });

export const neonGetBranchSummaries = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; dateRange: DateRangeFilter }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { getBranchSummariesReport } = await import("@/server/services/reports");
    return getBranchSummariesReport(data.tenantId, data.dateRange);
  });

export const neonGetStockAlerts = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; branchId?: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { getStockAlertsReport } = await import("@/server/services/reports");
    return getStockAlertsReport(data.tenantId, data.branchId);
  });

export const neonGetDashboardStats = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; branchId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { getDashboardStatsReport } = await import("@/server/services/reports");
    return getDashboardStatsReport(data.tenantId, data.branchId);
  });

export const neonGetProfitLossSummary = createServerFn({ method: "POST" })
  .validator(
    (data: { tenantId: string; branchId: string; dateRange: DateRangeFilter }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { getProfitLossSummaryReport } = await import("@/server/services/reports");
    return getProfitLossSummaryReport(data.tenantId, data.branchId, data.dateRange);
  });
