// =============================================================================
// useGoodsReceipt — penerimaan barang (Fase 10).
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import { useAuthStore, MOCK_TENANT_ID } from "@/stores/auth.store";
import { isNeonBackend } from "@/lib/api/backend";
import { useBranchStore } from "@/stores/branch.store";
import { usePurchasingStore } from "@/stores/purchasing.store";
import { getGoodsReceipts, createGoodsReceipt, getPurchaseOrders } from "@/lib/api/purchasing";
import type { MockGrWithItems, MockPoWithItems } from "@/lib/mock-purchasing";

export function useGoodsReceipt() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const activeBranch = useBranchStore((s) => s.activeBranch);
  const mockGoodsReceipts = usePurchasingStore((s) => s.mockGoodsReceipts);
  const getAllMockPos = usePurchasingStore((s) => s.getAllMockPos);
  const pendingGrPoId = usePurchasingStore((s) => s.pendingGrPoId);
  const setPendingGrPoId = usePurchasingStore((s) => s.setPendingGrPoId);
  const receiveMockGoods = usePurchasingStore((s) => s.receiveMockGoods);

  const user = currentUser?.profile ?? null;
  const tenantId = currentUser?.tenantId ?? "";
  const branchId = activeBranch?.id ?? "";
  const isMockTenant = tenantId === MOCK_TENANT_ID && !isNeonBackend();

  const [receipts, setReceipts] = useState<MockGrWithItems[]>([]);
  const [pendingPosList, setPendingPosList] = useState<MockPoWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPo, setSelectedPo] = useState<MockPoWithItems | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const pendingPos = isMockTenant
    ? getAllMockPos().filter(
        (p) =>
          (p.status === "sent" || p.status === "partial_received") &&
          (!branchId || p.branch_id === branchId),
      )
    : pendingPosList;

  const loadPendingPos = useCallback(async () => {
    if (isMockTenant || !tenantId) return;
    const result = await getPurchaseOrders(tenantId, branchId);
    setPendingPosList(
      ((result.data ?? []) as MockPoWithItems[]).filter(
        (p) => p.status === "sent" || p.status === "partial_received",
      ),
    );
  }, [isMockTenant, tenantId, branchId]);

  const loadReceipts = useCallback(async () => {
    setLoading(true);
    if (isMockTenant) {
      let list = mockGoodsReceipts;
      if (branchId) list = list.filter((g) => g.branch_id === branchId);
      setReceipts(list);
      setLoading(false);
      return;
    }
    const result = await getGoodsReceipts(tenantId, branchId);
    setReceipts((result.data ?? []) as MockGrWithItems[]);
    setLoading(false);
  }, [isMockTenant, mockGoodsReceipts, branchId, tenantId]);

  useEffect(() => {
    void loadReceipts();
    void loadPendingPos();
  }, [loadReceipts, loadPendingPos]);

  const openReceiveForm = useCallback((po: MockPoWithItems) => {
    setSelectedPo(po);
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setSelectedPo(null);
  }, []);

  useEffect(() => {
    if (!pendingGrPoId) return;
    const po = pendingPos.find((p) => p.id === pendingGrPoId);
    if (po) openReceiveForm(po);
    setPendingGrPoId(null);
  }, [pendingGrPoId, pendingPos, openReceiveForm, setPendingGrPoId]);

  const submitReceipt = useCallback(
    async (receivedQties: Record<string, number>, notes: string | null) => {
      if (!user || !selectedPo) return { success: false, error: "PO tidak dipilih" };
      setActionLoading(true);
      if (isMockTenant) {
        const result = receiveMockGoods(selectedPo.id, user.id, receivedQties, notes);
        setActionLoading(false);
        if (!result.ok) return { success: false, error: result.error };
        closeForm();
        await loadReceipts();
        await loadPendingPos();
        return { success: true, grNumber: result.grNumber };
      }
      const grItems = selectedPo.items.map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        ordered_qty: item.ordered_qty,
        received_qty: receivedQties[item.id] ?? item.ordered_qty - item.received_qty,
        unit: item.unit,
      }));

      const result = await createGoodsReceipt(
        tenantId,
        {
          branch_id: selectedPo.branch_id,
          gr_number: "",
          purchase_order_id: selectedPo.id,
          supplier_id: selectedPo.supplier_id,
          received_by: user.id,
          received_at: new Date().toISOString(),
          notes,
        },
        grItems,
        user.id,
      );
      setActionLoading(false);
      if (result.error) return { success: false, error: result.error };
      closeForm();
      await loadReceipts();
      await loadPendingPos();
      return { success: true, grNumber: result.data?.gr_number };
    },
    [user, selectedPo, isMockTenant, receiveMockGoods, closeForm, loadReceipts, loadPendingPos, tenantId],
  );

  return {
    user,
    loading,
    receipts,
    pendingPos,
    selectedPo,
    formOpen,
    actionLoading,
    openReceiveForm,
    closeForm,
    submitReceipt,
    loadReceipts,
  };
}
