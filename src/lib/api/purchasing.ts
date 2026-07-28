// =============================================================================
// Purchasing API — suppliers, purchase orders, goods receipts
// =============================================================================

import { db as supabase, ok, fail, queryMany, isNeonBackend } from "./client";
import { withResponseCache, invalidateResponseCache } from "./response-cache";
import { neonCall } from "./backend";
import {
  neonCreateGoodsReceipt,
  neonCreatePurchaseOrder,
  neonCreateSupplier,
  neonGetGoodsReceipts,
  neonGetPurchaseOrder,
  neonGetPurchaseOrders,
  neonGetSupplier,
  neonGetSuppliers,
  neonUpdatePurchaseOrderStatus,
  neonUpdateSupplier,
} from "@/lib/api/neon/phase5-fns";
import type { ApiResponse } from "@/types/app";
import type {
  Supplier,
  SupplierInsert,
  SupplierUpdate,
  PurchaseOrder,
  PurchaseOrderInsert,
  PurchaseOrderUpdate,
  PoItem,
  PoItemInsert,
  GoodsReceipt,
  GoodsReceiptInsert,
  GrItem,
  GrItemInsert,
} from "@/types/database";

export async function getSuppliers(
  tenantId: string,
  options?: { activeOnly?: boolean; search?: string },
): Promise<ApiResponse<Supplier[]>> {
  const cacheKey = `suppliers:${tenantId}:${options?.activeOnly ? "active" : "all"}:${options?.search ?? ""}`;
  const load = async (): Promise<ApiResponse<Supplier[]>> => {
    if (isNeonBackend()) {
      const result = await neonCall(() => neonGetSuppliers({ data: { tenantId, options } }));
      if (result.error) return fail(result.error);
      return ok(result.data ?? []);
    }
    return queryMany(() => {
      let q = supabase
        .from("suppliers")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name");

      if (options?.activeOnly) q = q.eq("is_active", true);
      if (options?.search) q = q.ilike("name", `%${options.search}%`);

      return q;
    });
  };

  if (options?.search) return load();
  return withResponseCache(cacheKey, 30_000, load);
}

export async function getSupplier(
  tenantId: string,
  supplierId: string,
): Promise<ApiResponse<Supplier>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetSupplier({ data: { tenantId, supplierId } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Supplier tidak ditemukan");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", supplierId)
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function createSupplier(
  tenantId: string,
  payload: Omit<SupplierInsert, "tenant_id">,
): Promise<ApiResponse<Supplier>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonCreateSupplier({ data: { tenantId, payload } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal membuat supplier");
    invalidateResponseCache(`suppliers:${tenantId}:`);
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("suppliers")
      .insert({ ...payload, tenant_id: tenantId })
      .select()
      .single();
    if (error) return fail(error);
    invalidateResponseCache(`suppliers:${tenantId}:`);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function updateSupplier(
  tenantId: string,
  supplierId: string,
  updates: SupplierUpdate,
): Promise<ApiResponse<Supplier>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonUpdateSupplier({ data: { tenantId, supplierId, updates } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Supplier tidak ditemukan");
    invalidateResponseCache(`suppliers:${tenantId}:`);
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("suppliers")
      .update(updates)
      .eq("tenant_id", tenantId)
      .eq("id", supplierId)
      .select()
      .single();
    if (error) return fail(error);
    invalidateResponseCache(`suppliers:${tenantId}:`);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function getPurchaseOrders(
  tenantId: string,
  branchId?: string,
  options?: { status?: PurchaseOrder["status"]; supplierId?: string },
): Promise<ApiResponse<PurchaseOrder[]>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetPurchaseOrders({ data: { tenantId, branchId, options } }),
    );
    if (result.error) return fail(result.error);
    return ok(result.data ?? []);
  }
  return queryMany(() => {
    let q = supabase
      .from("purchase_orders")
      .select("*, supplier:supplier_id(name), items:purchase_order_items(*)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (branchId) q = q.eq("branch_id", branchId);
    if (options?.status) q = q.eq("status", options.status);
    if (options?.supplierId) q = q.eq("supplier_id", options.supplierId);

    return q;
  });
}

export async function getPurchaseOrder(
  tenantId: string,
  poId: string,
): Promise<ApiResponse<PurchaseOrder & { items: PoItem[] }>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetPurchaseOrder({ data: { tenantId, poId } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("PO tidak ditemukan");
    return ok(result.data as PurchaseOrder & { items: PoItem[] });
  }
  try {
    const { data, error } = await supabase
      .from("purchase_orders")
      .select("*, supplier:supplier_id(*), items:purchase_order_items(*)")
      .eq("tenant_id", tenantId)
      .eq("id", poId)
      .single();
    if (error) return fail(error);
    return ok(data as PurchaseOrder & { items: PoItem[] });
  } catch (err) {
    return fail(err);
  }
}

export async function createPurchaseOrder(
  tenantId: string,
  po: Omit<PurchaseOrderInsert, "tenant_id">,
  items: Omit<PoItemInsert, "po_id" | "tenant_id">[],
): Promise<ApiResponse<PurchaseOrder>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonCreatePurchaseOrder({ data: { tenantId, po, items } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal membuat PO");
    return ok(result.data);
  }
  try {
    const { data: poData, error: poError } = await supabase
      .from("purchase_orders")
      .insert({ ...po, tenant_id: tenantId, status: "draft" })
      .select()
      .single();

    if (poError) return fail(poError);

    const itemsWithIds = items.map((item) => ({
      ...item,
      po_id: poData.id,
      tenant_id: tenantId,
    }));

    const { error: itemsError } = await supabase
      .from("purchase_order_items")
      .insert(itemsWithIds);

    if (itemsError) return fail(itemsError);
    return ok(poData);
  } catch (err) {
    return fail(err);
  }
}

export async function updatePurchaseOrderStatus(
  tenantId: string,
  poId: string,
  status: PurchaseOrder["status"],
): Promise<ApiResponse<PurchaseOrder>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonUpdatePurchaseOrderStatus({ data: { tenantId, poId, status } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("PO tidak ditemukan");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("purchase_orders")
      .update({ status } satisfies PurchaseOrderUpdate)
      .eq("tenant_id", tenantId)
      .eq("id", poId)
      .select()
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function getGoodsReceipts(
  tenantId: string,
  branchId?: string,
): Promise<ApiResponse<GoodsReceipt[]>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetGoodsReceipts({ data: { tenantId, branchId } }),
    );
    if (result.error) return fail(result.error);
    return ok(result.data ?? []);
  }
  return queryMany(() => {
    let q = supabase
      .from("goods_receipts")
      .select("*, supplier:supplier_id(name), items:goods_receipt_items(*)")
      .eq("tenant_id", tenantId)
      .order("received_at", { ascending: false });

    if (branchId) q = q.eq("branch_id", branchId);
    return q;
  });
}

export async function createGoodsReceipt(
  tenantId: string,
  gr: Omit<GoodsReceiptInsert, "tenant_id">,
  items: Omit<GrItemInsert, "gr_id" | "tenant_id">[],
  userId: string,
): Promise<ApiResponse<GoodsReceipt>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonCreateGoodsReceipt({ data: { tenantId, gr, items, userId } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal membuat penerimaan barang");
    return ok(result.data);
  }
  try {
    const { adjustStock } = await import("./inventory");
    const { data: grData, error: grError } = await supabase
      .from("goods_receipts")
      .insert({ ...gr, tenant_id: tenantId })
      .select()
      .single();

    if (grError) return fail(grError);

    const grItems = items.map((item) => ({
      ...item,
      gr_id: grData.id,
      tenant_id: tenantId,
    }));

    const { error: itemsError } = await supabase
      .from("goods_receipt_items")
      .insert(grItems);

    if (itemsError) return fail(itemsError);

    for (const item of items) {
      if (item.product_id && item.received_qty > 0) {
        await adjustStock(tenantId, gr.branch_id, item.product_id, item.received_qty, "in", {
          reference: grData.gr_number,
          notes: `Penerimaan barang dari PO`,
          userId,
        });
      }
    }

    await updatePurchaseOrderStatus(tenantId, gr.purchase_order_id, "received");

    return ok(grData);
  } catch (err) {
    return fail(err);
  }
}
