// =============================================================================
// Returns API — sales returns
// =============================================================================

import { isNeonBackend } from "./backend";
import { neonCall } from "./backend";
import { fail, ok } from "./client";
import {
  neonApproveLateReturnRefund,
  neonChooseReturnSettlement,
  neonCompleteReturnQc,
  neonCompleteReturnRefund,
  neonCreateReturnRequest,
  neonGetReturnById,
  neonGetTransactionForReturn,
  neonListActiveReturns,
  neonListPendingOffsetReturns,
  neonListPendingQcReturns,
} from "@/lib/api/neon/return-fns";
import type { ApiResponse } from "@/types/app";
import type { SalesItem, SalesTransaction } from "@/types/database";
import type {
  CompleteReturnRefundInput,
  CreateReturnInput,
  QcReturnLineInput,
  SalesReturnRecord,
} from "@/types/sales-returns";

export async function createReturnRequest(
  tenantId: string,
  branchId: string,
  userId: string,
  input: CreateReturnInput,
): Promise<ApiResponse<SalesReturnRecord>> {
  if (!isNeonBackend()) return fail("Retur barang membutuhkan backend Neon");
  const result = await neonCall(() =>
    neonCreateReturnRequest({ data: { tenantId, branchId, userId, input } }),
  );
  if (result.error) return fail(result.error);
  if (!result.data) return fail("Gagal membuat pengajuan retur");
  return ok(result.data);
}

export async function completeReturnQc(
  tenantId: string,
  returnId: string,
  userId: string,
  lines: QcReturnLineInput[],
  qcNotes?: string,
): Promise<ApiResponse<SalesReturnRecord>> {
  if (!isNeonBackend()) return fail("Retur barang membutuhkan backend Neon");
  const result = await neonCall(() =>
    neonCompleteReturnQc({ data: { tenantId, returnId, userId, lines, qcNotes } }),
  );
  if (result.error) return fail(result.error);
  if (!result.data) return fail("Gagal menyelesaikan QC retur");
  return ok(result.data);
}

export async function chooseReturnSettlement(
  tenantId: string,
  returnId: string,
  settlement: "standalone_refund" | "offset_in_new_sale",
  opts?: { requestLateCash?: boolean },
): Promise<ApiResponse<SalesReturnRecord>> {
  if (!isNeonBackend()) return fail("Retur barang membutuhkan backend Neon");
  const result = await neonCall(() =>
    neonChooseReturnSettlement({ data: { tenantId, returnId, settlement, ...opts } }),
  );
  if (result.error) return fail(result.error);
  if (!result.data) return fail("Gagal memilih penyelesaian retur");
  return ok(result.data);
}

export async function approveLateReturnRefund(
  tenantId: string,
  returnId: string,
  approverId: string,
): Promise<ApiResponse<SalesReturnRecord>> {
  if (!isNeonBackend()) return fail("Retur barang membutuhkan backend Neon");
  const result = await neonCall(() =>
    neonApproveLateReturnRefund({ data: { tenantId, returnId, approverId } }),
  );
  if (result.error) return fail(result.error);
  if (!result.data) return fail("Gagal approve retur");
  return ok(result.data);
}

export async function completeReturnRefund(
  tenantId: string,
  userId: string,
  input: CompleteReturnRefundInput,
): Promise<ApiResponse<SalesReturnRecord>> {
  if (!isNeonBackend()) return fail("Retur barang membutuhkan backend Neon");
  const result = await neonCall(() =>
    neonCompleteReturnRefund({ data: { tenantId, userId, input } }),
  );
  if (result.error) return fail(result.error);
  if (!result.data) return fail("Gagal menyelesaikan refund retur");
  return ok(result.data);
}

export async function listActiveReturns(
  tenantId: string,
  branchId: string,
): Promise<ApiResponse<SalesReturnRecord[]>> {
  if (!isNeonBackend()) return ok([]);
  const result = await neonCall(() =>
    neonListActiveReturns({ data: { tenantId, branchId } }),
  );
  if (result.error) return fail(result.error);
  return ok(result.data ?? []);
}

export async function listPendingQcReturns(
  tenantId: string,
  branchId: string,
): Promise<ApiResponse<SalesReturnRecord[]>> {
  if (!isNeonBackend()) return ok([]);
  const result = await neonCall(() =>
    neonListPendingQcReturns({ data: { tenantId, branchId } }),
  );
  if (result.error) return fail(result.error);
  return ok(result.data ?? []);
}

export async function listPendingOffsetReturns(
  tenantId: string,
  branchId: string,
): Promise<ApiResponse<SalesReturnRecord[]>> {
  if (!isNeonBackend()) return ok([]);
  const result = await neonCall(() =>
    neonListPendingOffsetReturns({ data: { tenantId, branchId } }),
  );
  if (result.error) return fail(result.error);
  return ok(result.data ?? []);
}

export async function getReturnById(
  tenantId: string,
  returnId: string,
): Promise<ApiResponse<SalesReturnRecord>> {
  if (!isNeonBackend()) return fail("Retur barang membutuhkan backend Neon");
  const result = await neonCall(() => neonGetReturnById({ data: { tenantId, returnId } }));
  if (result.error) return fail(result.error);
  if (!result.data) return fail("Retur tidak ditemukan");
  return ok(result.data);
}

export async function getTransactionForReturn(
  tenantId: string,
  transactionId: string,
): Promise<
  ApiResponse<{
    transaction: SalesTransaction;
    items: SalesItem[];
    withinWindow: boolean;
    deadlineLabel: string;
  }>
> {
  if (!isNeonBackend()) return fail("Retur barang membutuhkan backend Neon");
  const result = await neonCall(() =>
    neonGetTransactionForReturn({ data: { tenantId, transactionId } }),
  );
  if (result.error) return fail(result.error);
  if (!result.data) return fail("Transaksi tidak ditemukan");
  return ok(result.data);
}
