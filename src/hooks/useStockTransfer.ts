// =============================================================================
// useStockTransfer — transfer antar cabang (Fase 8).
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore, MOCK_TENANT_ID, MOCK_BRANCHES } from "@/stores/auth.store";
import { isNeonBackend } from "@/lib/api/backend";
import { useBranchStore } from "@/stores/branch.store";
import { usePosStore } from "@/stores/pos.store";
import { useInventoryStore } from "@/stores/inventory.store";
import {
  getStockTransfers,
  createStockTransfer,
  sendStockTransfer,
  confirmStockTransferReceived,
  cancelStockTransfer,
} from "@/lib/api/inventory";
import { getMockPosCatalog } from "@/lib/mock-pos-catalog";
import type { MockTransferWithItems } from "@/lib/mock-inventory";
import type { DbTransferStatus } from "@/types/database";

export interface TransferLineDraft {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  availableStock: number;
  qty: number;
}

export function useStockTransfer() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const activeBranch = useBranchStore((s) => s.activeBranch);
  const branches = useBranchStore((s) => s.branches);
  const mockStockDelta = usePosStore((s) => s.mockStockDelta);
  const mockStockAdjustments = useInventoryStore((s) => s.mockStockAdjustments);
  const mockTransfers = useInventoryStore((s) => s.mockTransfers);
  const createMockTransfer = useInventoryStore((s) => s.createMockTransfer);
  const sendMockTransfer = useInventoryStore((s) => s.sendMockTransfer);
  const receiveMockTransfer = useInventoryStore((s) => s.receiveMockTransfer);
  const cancelMockTransfer = useInventoryStore((s) => s.cancelMockTransfer);

  const user = currentUser?.profile ?? null;
  const tenantId = currentUser?.tenantId ?? "";
  const isMockTenant = tenantId === MOCK_TENANT_ID && !isNeonBackend();
  const branchList =
    branches.length > 0 ? branches : isMockTenant ? MOCK_BRANCHES : [];

  const [transfers, setTransfers] = useState<MockTransferWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<DbTransferStatus | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [detailTransfer, setDetailTransfer] = useState<MockTransferWithItems | null>(null);
  const [fromBranchId, setFromBranchId] = useState("");
  const [toBranchId, setToBranchId] = useState("");
  const [notes, setNotes] = useState("");
  const [draftLines, setDraftLines] = useState<TransferLineDraft[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadTransfers = useCallback(async () => {
    setLoading(true);
    if (isMockTenant) {
      setTransfers(mockTransfers);
      setLoading(false);
      return;
    }
    const branchId = activeBranch?.id;
    const result = await getStockTransfers(tenantId, branchId, {
      status: statusFilter === "all" ? undefined : statusFilter,
    });
    setTransfers((result.data ?? []) as MockTransferWithItems[]);
    setLoading(false);
  }, [isMockTenant, mockTransfers, tenantId, activeBranch, statusFilter]);

  useEffect(() => {
    void loadTransfers();
  }, [loadTransfers]);

  const filteredTransfers = useMemo(() => {
    if (statusFilter === "all") return transfers;
    return transfers.filter((t) => t.status === statusFilter);
  }, [transfers, statusFilter]);

  const computeAvailableStock = useCallback(
    (branchId: string, productId: string, baseStock: number) => {
      const posDelta = mockStockDelta[productId] ?? 0;
      const invDelta = mockStockAdjustments[`${branchId}:${productId}`] ?? 0;
      return Math.max(0, baseStock + posDelta + invDelta);
    },
    [mockStockDelta, mockStockAdjustments],
  );

  const loadOriginCatalog = useCallback(
    (branchId: string): TransferLineDraft[] => {
      if (!branchId) return [];
      const catalog = getMockPosCatalog(branchId);
      return catalog.map((bp) => ({
        productId: bp.product_id,
        sku: bp.product.sku,
        name: bp.product.name,
        unit: bp.product.unit,
        availableStock: computeAvailableStock(branchId, bp.product_id, bp.stock),
        qty: 0,
      }));
    },
    [computeAvailableStock],
  );

  const openCreateForm = useCallback(() => {
    const defaultFrom = activeBranch?.id ?? branchList[0]?.id ?? "";
    setFromBranchId(defaultFrom);
    setToBranchId(branchList.find((b) => b.id !== defaultFrom)?.id ?? "");
    setNotes("");
    setDraftLines(loadOriginCatalog(defaultFrom));
    setFormError(null);
    setFormOpen(true);
  }, [activeBranch, branchList, loadOriginCatalog]);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setFormError(null);
  }, []);

  const handleFromBranchChange = useCallback(
    (branchId: string) => {
      setFromBranchId(branchId);
      setDraftLines(loadOriginCatalog(branchId));
    },
    [loadOriginCatalog],
  );

  const updateLineQty = useCallback((productId: string, qty: number) => {
    setDraftLines((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, qty: Math.max(0, qty) } : l)),
    );
  }, []);

  const addProductLine = useCallback(
    (productId: string) => {
      const line = draftLines.find((l) => l.productId === productId);
      if (!line || line.qty > 0) return;
      updateLineQty(productId, 1);
    },
    [draftLines, updateLineQty],
  );

  const selectedLines = useMemo(
    () => draftLines.filter((l) => l.qty > 0),
    [draftLines],
  );

  const createTransfer = useCallback(async () => {
    if (!user) return { success: false, error: "Sesi tidak valid" };
    if (!fromBranchId || !toBranchId) return { success: false, error: "Pilih cabang asal dan tujuan" };
    if (fromBranchId === toBranchId) return { success: false, error: "Cabang asal dan tujuan harus berbeda" };
    if (selectedLines.length === 0) return { success: false, error: "Tambahkan minimal 1 item" };

    for (const line of selectedLines) {
      if (line.qty > line.availableStock) {
        return {
          success: false,
          error: `Stok ${line.name} tidak cukup (tersedia ${line.availableStock})`,
        };
      }
    }

    setActionLoading(true);
    setFormError(null);

    if (isMockTenant) {
      const fromBranch = branchList.find((b) => b.id === fromBranchId);
      const toBranch = branchList.find((b) => b.id === toBranchId);
      createMockTransfer(
        {
          tenant_id: tenantId,
          from_branch_id: fromBranchId,
          to_branch_id: toBranchId,
          status: "draft",
          notes: notes || null,
          created_by: user.id,
          confirmed_by: null,
          sent_at: null,
          received_at: null,
          from_branch: fromBranch ? { name: fromBranch.name } : undefined,
          to_branch: toBranch ? { name: toBranch.name } : undefined,
        },
        selectedLines.map((l) => ({
          product_id: l.productId,
          product_name: l.name,
          sku: l.sku,
          unit: l.unit,
          requested_qty: l.qty,
          sent_qty: l.qty,
          received_qty: 0,
        })),
      );
      setActionLoading(false);
      setFormOpen(false);
      await loadTransfers();
      return { success: true };
    }

    const result = await createStockTransfer(
      tenantId,
      {
        from_branch_id: fromBranchId,
        to_branch_id: toBranchId,
        transfer_number: "",
        notes: notes || null,
        created_by: user.id,
        confirmed_by: null,
        sent_at: null,
        received_at: null,
        status: "draft",
      },
      selectedLines.map((l) => ({
        product_id: l.productId,
        product_name: l.name,
        sku: l.sku,
        unit: l.unit,
        requested_qty: l.qty,
        sent_qty: l.qty,
        received_qty: 0,
      })),
    );
    setActionLoading(false);
    if (result.error) {
      setFormError(result.error);
      return { success: false, error: result.error };
    }
    setFormOpen(false);
    await loadTransfers();
    return { success: true };
  }, [
    user,
    fromBranchId,
    toBranchId,
    selectedLines,
    notes,
    isMockTenant,
    branchList,
    createMockTransfer,
    tenantId,
    loadTransfers,
  ]);

  const sendTransfer = useCallback(
    async (transferId: string) => {
      if (!user) return { success: false, error: "Sesi tidak valid" };
      setActionLoading(true);
      if (isMockTenant) {
        const result = sendMockTransfer(transferId, user.id);
        setActionLoading(false);
        if (!result.ok) return { success: false, error: result.error };
        await loadTransfers();
        return { success: true };
      }
      const result = await sendStockTransfer(tenantId, transferId, user.id);
      setActionLoading(false);
      if (result.error) return { success: false, error: result.error };
      await loadTransfers();
      return { success: true };
    },
    [user, isMockTenant, sendMockTransfer, tenantId, loadTransfers],
  );

  const receiveTransfer = useCallback(
    async (transferId: string) => {
      if (!user) return { success: false, error: "Sesi tidak valid" };
      setActionLoading(true);
      if (isMockTenant) {
        const result = receiveMockTransfer(transferId, user.id);
        setActionLoading(false);
        if (!result.ok) return { success: false, error: result.error };
        setDetailTransfer(null);
        await loadTransfers();
        return { success: true };
      }
      const tf = transfers.find((t) => t.id === transferId);
      const receivedQties = Object.fromEntries(
        (tf?.items ?? []).map((i) => [i.id, i.sent_qty]),
      );
      const result = await confirmStockTransferReceived(
        tenantId,
        transferId,
        user.id,
        receivedQties,
      );
      setActionLoading(false);
      if (result.error) return { success: false, error: result.error };
      setDetailTransfer(null);
      await loadTransfers();
      return { success: true };
    },
    [user, isMockTenant, receiveMockTransfer, tenantId, transfers, loadTransfers],
  );

  const cancelTransfer = useCallback(
    async (transferId: string) => {
      if (!user) return { success: false, error: "Sesi tidak valid" };
      setActionLoading(true);
      if (isMockTenant) {
        const result = cancelMockTransfer(transferId, user.id);
        setActionLoading(false);
        if (!result.ok) return { success: false, error: result.error };
        setDetailTransfer(null);
        await loadTransfers();
        return { success: true };
      }
      const result = await cancelStockTransfer(tenantId, transferId, user.id);
      setActionLoading(false);
      if (result.error) return { success: false, error: result.error };
      setDetailTransfer(null);
      await loadTransfers();
      return { success: true };
    },
    [user, isMockTenant, cancelMockTransfer, tenantId, loadTransfers],
  );

  const canReceiveTransfer = useCallback(
    (tf: MockTransferWithItems) => {
      if (tf.status !== "sent") return false;
      return activeBranch?.id === tf.to_branch_id;
    },
    [activeBranch],
  );

  return {
    user,
    branchList,
    activeBranch,
    loading,
    transfers: filteredTransfers,
    statusFilter,
    setStatusFilter,
    formOpen,
    detailTransfer,
    setDetailTransfer,
    fromBranchId,
    toBranchId,
    setToBranchId,
    notes,
    setNotes,
    draftLines,
    selectedLines,
    actionLoading,
    formError,
    openCreateForm,
    closeForm,
    handleFromBranchChange,
    updateLineQty,
    addProductLine,
    createTransfer,
    sendTransfer,
    receiveTransfer,
    cancelTransfer,
    canReceiveTransfer,
  };
}
