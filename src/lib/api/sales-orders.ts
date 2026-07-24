// =============================================================================
// Sales Orders API — SO (indent) + fulfillment
// =============================================================================

import { db as supabase, ok, fail, queryMany, isNeonBackend } from "./client";
import { neonCall } from "./backend";
import {
  neonAddDownPayment,
  neonConvertSalesOrderToInvoice,
  neonCreateFulfillment,
  neonCreateSalesOrder,
  neonGetFulfillmentsByItem,
  neonGetSalesOrder,
  neonGetSalesOrders,
  neonProcessItemFulfillment,
  neonUpdateFulfillmentStatus,
  neonUpdateSalesOrder,
} from "@/lib/api/neon/phase5-fns";
import type { ApiResponse } from "@/types/app";
import type {
  SalesOrder,
  SalesOrderInsert,
  SalesOrderUpdate,
  SalesOrderItem,
  SalesOrderItemInsert,
  SoFulfillment,
  SoFulfillmentInsert,
} from "@/types/database";

export async function getSalesOrders(
  tenantId: string,
  branchId?: string,
  options?: { status?: SalesOrder["status"]; customerId?: string },
): Promise<ApiResponse<SalesOrder[]>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetSalesOrders({ data: { tenantId, branchId, options } }),
    );
    if (result.error) return fail(result.error);
    return ok(result.data ?? []);
  }
  return queryMany(() => {
    let q = supabase
      .from("sales_orders")
      .select("*, customer:customer_id(name, phone), items:sales_order_items(*)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (branchId) q = q.eq("branch_id", branchId);
    if (options?.status) q = q.eq("status", options.status);
    if (options?.customerId) q = q.eq("customer_id", options.customerId);

    return q;
  });
}

export async function getSalesOrder(
  tenantId: string,
  soId: string,
): Promise<ApiResponse<SalesOrder & { items: SalesOrderItem[] }>> {
  if (isNeonBackend()) {
    const result = await neonCall(() => neonGetSalesOrder({ data: { tenantId, soId } }));
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Sales Order tidak ditemukan");
    return ok(result.data as SalesOrder & { items: SalesOrderItem[] });
  }
  try {
    const { data, error } = await supabase
      .from("sales_orders")
      .select("*, customer:customer_id(*), items:sales_order_items(*, fulfillments:so_fulfillments(*))")
      .eq("tenant_id", tenantId)
      .eq("id", soId)
      .single();
    if (error) return fail(error);
    return ok(data as SalesOrder & { items: SalesOrderItem[] });
  } catch (err) {
    return fail(err);
  }
}

export async function createSalesOrder(
  tenantId: string,
  so: Omit<SalesOrderInsert, "tenant_id">,
  items: Omit<SalesOrderItemInsert, "so_id" | "tenant_id">[],
): Promise<ApiResponse<SalesOrder>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonCreateSalesOrder({ data: { tenantId, so, items } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal membuat Sales Order");
    return ok(result.data);
  }
  try {
    const { data: soData, error: soError } = await supabase
      .from("sales_orders")
      .insert({ ...so, tenant_id: tenantId })
      .select()
      .single();

    if (soError) return fail(soError);

    const soItems = items.map((item) => ({
      ...item,
      so_id: soData.id,
      tenant_id: tenantId,
    }));

    const { error: itemsError } = await supabase
      .from("sales_order_items")
      .insert(soItems);

    if (itemsError) return fail(itemsError);
    return ok(soData);
  } catch (err) {
    return fail(err);
  }
}

export async function updateSalesOrder(
  tenantId: string,
  soId: string,
  updates: SalesOrderUpdate,
): Promise<ApiResponse<SalesOrder>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonUpdateSalesOrder({ data: { tenantId, soId, updates } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Sales Order tidak ditemukan");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("sales_orders")
      .update(updates)
      .eq("tenant_id", tenantId)
      .eq("id", soId)
      .select()
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function addDownPayment(
  tenantId: string,
  soId: string,
  amount: number,
): Promise<ApiResponse<SalesOrder>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonAddDownPayment({ data: { tenantId, soId, amount } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Sales Order tidak ditemukan");
    return ok(result.data);
  }
  try {
    const { data: so } = await supabase
      .from("sales_orders")
      .select("down_payment, grand_total")
      .eq("tenant_id", tenantId)
      .eq("id", soId)
      .single();

    if (!so) return fail("SO tidak ditemukan");

    const newDownPayment = so.down_payment + amount;
    const paymentStatus =
      newDownPayment >= so.grand_total
        ? "paid"
        : newDownPayment > 0
          ? "partial"
          : "unpaid";

    return updateSalesOrder(tenantId, soId, {
      down_payment: newDownPayment,
      payment_status: paymentStatus,
    });
  } catch (err) {
    return fail(err);
  }
}

export async function createFulfillment(
  tenantId: string,
  soItemId: string,
  payload: Omit<SoFulfillmentInsert, "tenant_id" | "so_item_id">,
): Promise<ApiResponse<SoFulfillment>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonCreateFulfillment({ data: { tenantId, soItemId, payload } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal membuat fulfillment");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("so_fulfillments")
      .insert({ ...payload, tenant_id: tenantId, so_item_id: soItemId })
      .select()
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function getFulfillmentsByItem(
  tenantId: string,
  soItemId: string,
): Promise<ApiResponse<SoFulfillment[]>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetFulfillmentsByItem({ data: { tenantId, soItemId } }),
    );
    if (result.error) return fail(result.error);
    return ok(result.data ?? []);
  }
  return queryMany(() =>
    supabase
      .from("so_fulfillments")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("so_item_id", soItemId),
  );
}

export async function updateFulfillmentStatus(
  tenantId: string,
  fulfillmentId: string,
  status: SoFulfillment["status"],
): Promise<ApiResponse<SoFulfillment>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonUpdateFulfillmentStatus({ data: { tenantId, fulfillmentId, status } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Fulfillment tidak ditemukan");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("so_fulfillments")
      .update({ status })
      .eq("tenant_id", tenantId)
      .eq("id", fulfillmentId)
      .select()
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function processItemFulfillment(
  tenantId: string,
  soId: string,
  soItemId: string,
  stockQty: number,
  indentQty: number,
  userId: string,
  supplierId?: string,
): Promise<ApiResponse<null>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonProcessItemFulfillment({
        data: { tenantId, soId, soItemId, stockQty, indentQty, userId, supplierId },
      }),
    );
    if (result.error) return fail(result.error);
    return ok(null);
  }
  return fail("Fulfillment memerlukan VITE_DATA_BACKEND=neon");
}

export async function convertSalesOrderToInvoice(
  tenantId: string,
  soId: string,
): Promise<ApiResponse<{ invoiceNumber: string }>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonConvertSalesOrderToInvoice({ data: { tenantId, soId } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal convert ke invoice");
    return ok(result.data);
  }
  return fail("Convert invoice memerlukan VITE_DATA_BACKEND=neon");
}
