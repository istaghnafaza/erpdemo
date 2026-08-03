// =============================================================================
// Neon RPC — Sales returns
// =============================================================================

import { createServerFn } from "@tanstack/react-start";
import type {
  CompleteReturnRefundInput,
  CreateReturnInput,
  QcReturnLineInput,
  SalesReturnRecord,
} from "@/types/sales-returns";

async function requireTenant(tenantId: string) {
  const { assertTenant, requireRequestSession } = await import("@/server/auth/request-session");
  const session = await requireRequestSession();
  assertTenant(session, tenantId);
  return session;
}

export const neonCreateReturnRequest = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      branchId: string;
      userId: string;
      input: CreateReturnInput;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { createReturnRequest } = await import("@/server/services/sales-returns");
    return createReturnRequest(data.tenantId, data.branchId, data.userId, data.input);
  });

export const neonCompleteReturnQc = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      returnId: string;
      userId: string;
      lines: QcReturnLineInput[];
      qcNotes?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { completeReturnQc } = await import("@/server/services/sales-returns");
    return completeReturnQc(
      data.tenantId,
      data.returnId,
      data.userId,
      data.lines,
      data.qcNotes,
    );
  });

export const neonChooseReturnSettlement = createServerFn({ method: "POST" })
  .validator(
    (data: {
      tenantId: string;
      returnId: string;
      settlement: "standalone_refund" | "offset_in_new_sale";
      requestLateCash?: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { chooseReturnSettlement } = await import("@/server/services/sales-returns");
    return chooseReturnSettlement(data.tenantId, data.returnId, data.settlement, {
      requestLateCash: data.requestLateCash,
    });
  });

export const neonApproveLateReturnRefund = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; returnId: string; approverId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { approveLateReturnRefund } = await import("@/server/services/sales-returns");
    return approveLateReturnRefund(data.tenantId, data.returnId, data.approverId);
  });

export const neonCompleteReturnRefund = createServerFn({ method: "POST" })
  .validator(
    (data: { tenantId: string; userId: string; input: CompleteReturnRefundInput }) => data,
  )
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { completeReturnRefund } = await import("@/server/services/sales-returns");
    return completeReturnRefund(data.tenantId, data.userId, data.input);
  });

export const neonListActiveReturns = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; branchId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { listActiveReturns } = await import("@/server/services/sales-returns");
    return listActiveReturns(data.tenantId, data.branchId);
  });

export const neonListPendingQcReturns = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; branchId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { listPendingQcReturns } = await import("@/server/services/sales-returns");
    return listPendingQcReturns(data.tenantId, data.branchId);
  });

export const neonListPendingOffsetReturns = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; branchId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { listPendingOffsetReturns } = await import("@/server/services/sales-returns");
    return listPendingOffsetReturns(data.tenantId, data.branchId);
  });

export const neonGetReturnById = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; returnId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { getReturnById } = await import("@/server/services/sales-returns");
    const row = await getReturnById(data.tenantId, data.returnId);
    if (!row) throw new Error("Retur tidak ditemukan");
    return row;
  });

export const neonGetTransactionForReturn = createServerFn({ method: "POST" })
  .validator((data: { tenantId: string; transactionId: string }) => data)
  .handler(async ({ data }) => {
    await requireTenant(data.tenantId);
    const { getTransactionForReturn } = await import("@/server/services/sales-returns");
    const result = await getTransactionForReturn(data.tenantId, data.transactionId);
    if (!result) throw new Error("Transaksi tidak ditemukan");
    return result;
  });

export type NeonReturnRecord = SalesReturnRecord;
