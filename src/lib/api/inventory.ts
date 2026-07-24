// =============================================================================
// Inventory API — stock movements, opname, transfers
// =============================================================================

import { db as supabase, ok, fail, queryMany, isNeonBackend } from "./client";
import { neonCall } from "./backend";
import {
  neonAdjustStock,
  neonGetStockMovements,
  neonRecordStockMovement,
} from "@/lib/api/neon/catalog-fns";
import {
  neonCancelStockTransfer,
  neonConfirmStockTransferReceived,
  neonCreateStockTransfer,
  neonGetStockTransfer,
  neonGetStockTransfers,
  neonSendStockTransfer,
  neonSubmitOpname,
} from "@/lib/api/neon/phase5-fns";
import type { ApiResponse, DateRangeFilter } from "@/types/app";
import type {
  StockMovement, StockMovementInsert,
  StockTransfer, StockTransferInsert, StockTransferUpdate,
  StockTransferItem, StockTransferItemInsert,
  BranchProduct,
  OpnameItem,
} from "@/types/database";

// ---------------------------------------------------------------------------
// Stock Movements
// ---------------------------------------------------------------------------

export async function getStockMovements(
  tenantId: string,
  branchId: string,
  options?: {
    productId?: string;
    dateRange?: DateRangeFilter;
    type?: StockMovement["type"];
    limit?: number;
  }
): Promise<ApiResponse<StockMovement[]>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetStockMovements({ data: { tenantId, branchId, options } }),
    );
    if (result.error) return fail(result.error);
    return ok(result.data ?? []);
  }
  return queryMany(() => {
    let q = supabase
      .from("stock_movements")
      .select("*, product:product_id(sku, name, unit), user:user_id(name)")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId)
      .order("created_at", { ascending: false });

    if (options?.productId)          q = q.eq("product_id", options.productId);
    if (options?.type)               q = q.eq("type", options.type);
    if (options?.dateRange?.from)    q = q.gte("created_at", options.dateRange.from);
    if (options?.dateRange?.to)      q = q.lte("created_at", options.dateRange.to);
    if (options?.limit)              q = q.limit(options.limit);

    return q;
  });
}

export async function recordStockMovement(
  tenantId: string,
  movement: Omit<StockMovementInsert, "tenant_id">
): Promise<ApiResponse<StockMovement>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonRecordStockMovement({ data: { tenantId, movement } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal mencatat pergerakan stok");
    return ok(result.data);
  }
  try {
    const { data, error } = await supabase
      .from("stock_movements")
      .insert({ ...movement, tenant_id: tenantId })
      .select()
      .single();
    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

/**
 * Adjust stock on branch_products AND record the movement in one operation.
 * This is the canonical way to change stock — never update branch_products directly.
 */
export async function adjustStock(
  tenantId: string,
  branchId: string,
  productId: string,
  delta: number,
  type: StockMovement["type"],
  options?: {
    stockSource?: "verified" | "legacy";
    reference?: string;
    notes?: string;
    userId?: string;
  }
): Promise<ApiResponse<BranchProduct>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonAdjustStock({
        data: { tenantId, branchId, productId, delta, type, options },
      }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Stok cabang tidak ditemukan");
    return ok(result.data);
  }
  try {
    const { data: bp, error: bpError } = await supabase
      .from("branch_products")
      .select("stock, legacy_stock")
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId)
      .eq("product_id", productId)
      .single();

    if (bpError) return fail(bpError);

    const source = options?.stockSource ?? "verified";
    const isLegacy = source === "legacy";
    const currentQty = isLegacy ? bp.legacy_stock : bp.stock;
    const newQty = Math.max(0, currentQty + delta);

    const updateField = isLegacy ? { legacy_stock: newQty } : { stock: newQty };

    const { data: updatedBp, error: updateError } = await supabase
      .from("branch_products")
      .update(updateField)
      .eq("tenant_id", tenantId)
      .eq("branch_id", branchId)
      .eq("product_id", productId)
      .select()
      .single();

    if (updateError) return fail(updateError);

    await recordStockMovement(tenantId, {
      branch_id: branchId,
      product_id: productId,
      type,
      stock_source: source,
      qty: Math.abs(delta),
      qty_before: currentQty,
      qty_after: newQty,
      reference: options?.reference ?? null,
      notes: options?.notes ?? null,
      user_id: options?.userId ?? null,
    });

    return ok(updatedBp);
  } catch (err) {
    return fail(err);
  }
}


// ---------------------------------------------------------------------------
// Stock Opname
// ---------------------------------------------------------------------------

export async function submitOpname(
  tenantId: string,
  branchId: string,
  userId: string,
  reference: string,
  items: OpnameItem[]
): Promise<ApiResponse<StockMovement[]>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonSubmitOpname({ data: { tenantId, branchId, userId, reference, items } }),
    );
    if (result.error) return fail(result.error);
    return ok(result.data ?? []);
  }
  try {
    const movements: StockMovementInsert[] = [];

    for (const item of items) {
      if (item.discrepancy === 0) continue;

      const stockField = item.stock_source === "legacy" ? "legacy_stock" : "stock";

      const { data: bp } = await supabase
        .from("branch_products")
        .select("stock, legacy_stock")
        .eq("tenant_id", tenantId)
        .eq("branch_id", branchId)
        .eq("product_id", item.product_id)
        .single();

      if (!bp) continue;

      await supabase
        .from("branch_products")
        .update({ [stockField]: item.actual_stock })
        .eq("tenant_id", tenantId)
        .eq("branch_id", branchId)
        .eq("product_id", item.product_id);

      movements.push({
        tenant_id: tenantId,
        branch_id: branchId,
        product_id: item.product_id,
        type: "opname",
        stock_source: item.stock_source,
        qty: Math.abs(item.discrepancy),
        qty_before: item.system_stock,
        qty_after: item.actual_stock,
        reference,
        notes: item.notes,
        user_id: userId,
      });
    }

    const { data, error } = await supabase
      .from("stock_movements")
      .insert(movements)
      .select();

    if (error) return fail(error);
    return ok(data ?? []);
  } catch (err) {
    return fail(err);
  }
}


// ---------------------------------------------------------------------------
// Stock Transfers
// ---------------------------------------------------------------------------

export async function getStockTransfers(
  tenantId: string,
  branchId?: string,
  options?: { status?: StockTransfer["status"]; dateRange?: DateRangeFilter },
): Promise<ApiResponse<StockTransfer[]>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetStockTransfers({ data: { tenantId, branchId, options } }),
    );
    if (result.error) return fail(result.error);
    return ok(result.data ?? []);
  }
  return queryMany(() => {
    let q = supabase
      .from("stock_transfers")
      .select("*, from_branch:from_branch_id(name), to_branch:to_branch_id(name), items:stock_transfer_items(*)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (branchId) {
      q = q.or(`from_branch_id.eq.${branchId},to_branch_id.eq.${branchId}`);
    }
    if (options?.status)          q = q.eq("status", options.status);
    if (options?.dateRange?.from) q = q.gte("created_at", options.dateRange.from);
    if (options?.dateRange?.to)   q = q.lte("created_at", options.dateRange.to);

    return q;
  });
}

export async function getStockTransfer(
  tenantId: string,
  transferId: string,
): Promise<ApiResponse<StockTransfer & { items: StockTransferItem[] }>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonGetStockTransfer({ data: { tenantId, transferId } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Transfer tidak ditemukan");
    return ok(result.data as StockTransfer & { items: StockTransferItem[] });
  }
  try {
    const { data, error } = await supabase
      .from("stock_transfers")
      .select("*, items:stock_transfer_items(*)")
      .eq("tenant_id", tenantId)
      .eq("id", transferId)
      .single();
    if (error) return fail(error);
    return ok(data as StockTransfer & { items: StockTransferItem[] });
  } catch (err) {
    return fail(err);
  }
}

export async function createStockTransfer(
  tenantId: string,
  transfer: Omit<StockTransferInsert, "tenant_id">,
  items: Omit<StockTransferItemInsert, "transfer_id" | "tenant_id">[],
): Promise<ApiResponse<StockTransfer>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonCreateStockTransfer({ data: { tenantId, transfer, items } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Gagal membuat transfer");
    return ok(result.data);
  }
  try {
    const { data: tf, error: tfError } = await supabase
      .from("stock_transfers")
      .insert({ ...transfer, tenant_id: tenantId, status: "draft" })
      .select()
      .single();

    if (tfError) return fail(tfError);

    const itemsWithIds = items.map((item) => ({
      ...item,
      transfer_id: tf.id,
      tenant_id: tenantId,
    }));

    const { error: itemsError } = await supabase
      .from("stock_transfer_items")
      .insert(itemsWithIds);

    if (itemsError) return fail(itemsError);

    return ok(tf);
  } catch (err) {
    return fail(err);
  }
}

/** Mark transfer as "sent" — deducts stock from origin branch */
export async function sendStockTransfer(
  tenantId: string,
  transferId: string,
  userId: string,
): Promise<ApiResponse<StockTransfer>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonSendStockTransfer({ data: { tenantId, transferId, userId } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Transfer tidak ditemukan");
    return ok(result.data);
  }
  try {
    const transferResult = await getStockTransfer(tenantId, transferId);
    if (transferResult.error) return fail(transferResult.error);

    const transfer = transferResult.data!;
    if (transfer.status !== "draft") return fail("Transfer sudah dikirim atau dibatalkan");

    for (const item of transfer.items) {
      await adjustStock(tenantId, transfer.from_branch_id, item.product_id, -item.sent_qty, "transfer_out", {
        reference: transfer.transfer_number,
        userId,
      });
    }

    const { data, error } = await supabase
      .from("stock_transfers")
      .update({ status: "sent", sent_at: new Date().toISOString() } satisfies StockTransferUpdate)
      .eq("tenant_id", tenantId)
      .eq("id", transferId)
      .select()
      .single();

    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

/** Confirm receipt — adds stock to destination branch */
export async function confirmStockTransferReceived(
  tenantId: string,
  transferId: string,
  userId: string,
  receivedQties: Record<string, number>,
): Promise<ApiResponse<StockTransfer>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonConfirmStockTransferReceived({
        data: { tenantId, transferId, userId, receivedQties },
      }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Transfer tidak ditemukan");
    return ok(result.data);
  }
  try {
    const transferResult = await getStockTransfer(tenantId, transferId);
    if (transferResult.error) return fail(transferResult.error);

    const transfer = transferResult.data!;
    if (transfer.status !== "sent") return fail("Transfer belum dikirim");

    for (const item of transfer.items) {
      const qty = receivedQties[item.id] ?? item.sent_qty;
      await supabase
        .from("stock_transfer_items")
        .update({ received_qty: qty })
        .eq("id", item.id);

      await adjustStock(tenantId, transfer.to_branch_id, item.product_id, qty, "transfer_in", {
        reference: transfer.transfer_number,
        userId,
      });
    }

    const { data, error } = await supabase
      .from("stock_transfers")
      .update({
        status: "received",
        received_at: new Date().toISOString(),
        confirmed_by: userId,
      } satisfies StockTransferUpdate)
      .eq("tenant_id", tenantId)
      .eq("id", transferId)
      .select()
      .single();

    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}

export async function cancelStockTransfer(
  tenantId: string,
  transferId: string,
  userId: string,
): Promise<ApiResponse<StockTransfer>> {
  if (isNeonBackend()) {
    const result = await neonCall(() =>
      neonCancelStockTransfer({ data: { tenantId, transferId, userId } }),
    );
    if (result.error) return fail(result.error);
    if (!result.data) return fail("Transfer tidak ditemukan");
    return ok(result.data);
  }
  try {
    const transferResult = await getStockTransfer(tenantId, transferId);
    if (transferResult.error) return fail(transferResult.error);

    const transfer = transferResult.data!;

    // If already sent, restore stock to origin
    if (transfer.status === "sent") {
      for (const item of transfer.items) {
        await adjustStock(tenantId, transfer.from_branch_id, item.product_id, item.sent_qty, "in", {
          reference: transfer.transfer_number,
          notes: "Transfer dibatalkan — stok dikembalikan",
          userId,
        });
      }
    }

    const { data, error } = await supabase
      .from("stock_transfers")
      .update({ status: "cancelled" } satisfies StockTransferUpdate)
      .eq("tenant_id", tenantId)
      .eq("id", transferId)
      .select()
      .single();

    if (error) return fail(error);
    return ok(data);
  } catch (err) {
    return fail(err);
  }
}
