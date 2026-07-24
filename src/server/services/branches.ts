// =============================================================================
// Branch service — Neon/Drizzle
// =============================================================================

import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { toBranch } from "@/server/db/mappers";
import {
  branches,
  cashierSessions,
  posCarts,
  profiles,
  salesOrders,
  stockTransfers,
  userBranches,
} from "@/server/db/schema";
import type { Branch, BranchInsert, BranchUpdate, Profile } from "@/types/database";

export function deriveBranchCode(name: string): string {
  const letters = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return (letters.slice(0, 3) || "CBG").padEnd(3, "X").slice(0, 3);
}

export function ensureUniqueBranchCode(preferred: string, existingCodes: string[]): string {
  const taken = new Set(existingCodes.map((c) => c.toUpperCase()));
  const base = preferred.toUpperCase() || "CBG";
  if (!taken.has(base)) return base;
  const stem = base.length >= 2 ? base.slice(0, 2) : `${base}X`.slice(0, 2);
  for (let n = 2; n < 1000; n++) {
    const candidate = `${stem}${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error("Terlalu banyak cabang dengan kode serupa — coba nama cabang lain");
}

export async function listBranches(tenantId: string, activeOnly = false): Promise<Branch[]> {
  const db = getDb();
  const rows = await db.query.branches.findMany({
    where: activeOnly
      ? and(eq(branches.tenantId, tenantId), eq(branches.isActive, true))
      : eq(branches.tenantId, tenantId),
    orderBy: asc(branches.name),
  });
  return rows.map(toBranch);
}

export async function getBranch(tenantId: string, branchId: string): Promise<Branch | null> {
  const db = getDb();
  const row = await db.query.branches.findFirst({
    where: and(eq(branches.tenantId, tenantId), eq(branches.id, branchId)),
  });
  return row ? toBranch(row) : null;
}

export interface BranchWithManager extends Branch {
  manager: Pick<Profile, "id" | "name" | "email"> | null;
}

export async function countActiveBranches(tenantId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(branches)
    .where(and(eq(branches.tenantId, tenantId), eq(branches.isActive, true)));
  return row?.count ?? 0;
}

export async function listBranchesWithManager(tenantId: string): Promise<BranchWithManager[]> {
  const db = getDb();
  const rows = await db
    .select({
      branch: branches,
      manager: {
        id: profiles.id,
        name: profiles.name,
        email: profiles.email,
      },
    })
    .from(branches)
    .leftJoin(profiles, eq(branches.managerId, profiles.id))
    .where(eq(branches.tenantId, tenantId))
    .orderBy(asc(branches.name));

  return rows.map(({ branch, manager }) => ({
    ...toBranch(branch),
    manager: manager?.id ? manager : null,
  }));
}

export async function listUserBranches(tenantId: string, userId: string): Promise<Branch[]> {
  const db = getDb();
  const rows = await db
    .select({ branch: branches })
    .from(userBranches)
    .innerJoin(branches, eq(userBranches.branchId, branches.id))
    .where(and(eq(userBranches.tenantId, tenantId), eq(userBranches.userId, userId)));

  return rows.map(({ branch }) => toBranch(branch));
}

export async function createBranch(
  tenantId: string,
  payload: Omit<BranchInsert, "tenant_id">,
): Promise<Branch> {
  const db = getDb();
  const all = await listBranches(tenantId);
  const preferred = payload.code?.trim() || deriveBranchCode(payload.name);
  const code = ensureUniqueBranchCode(preferred, all.map((b) => b.code));

  try {
    const [row] = await db
      .insert(branches)
      .values({
        id: payload.id,
        tenantId,
        code,
        name: payload.name.trim(),
        address: payload.address?.trim() || null,
        phone: payload.phone?.trim() || null,
        managerId: payload.manager_id,
        isActive: payload.is_active ?? true,
      })
      .returning();
    return toBranch(row);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique") || msg.includes("23505")) {
      throw new Error(
        `Kode cabang "${code}" sudah dipakai. Gunakan nama cabang lain atau buka kembali toko lama.`,
      );
    }
    throw new Error("Gagal membuat cabang — periksa data dan coba lagi");
  }
}

/**
 * Selesai onboarding: perbarui cabang placeholder dari registrasi (HQ),
 * bukan INSERT baru — menghindari bentrok unique (tenant_id, code).
 */
export async function finalizeOnboardingPrimaryBranch(
  tenantId: string,
  payload: Omit<BranchInsert, "tenant_id">,
): Promise<Branch> {
  const all = await listBranches(tenantId);

  const sameCode = all.find((b) => b.code === payload.code);
  if (sameCode) {
    const updated = await updateBranch(tenantId, sameCode.id, {
      name: payload.name,
      address: payload.address,
      phone: payload.phone,
      is_active: true,
    });
    if (!updated) throw new Error("Gagal memperbarui cabang");
    await deactivatePlaceholderBranches(tenantId, sameCode.id);
    return updated;
  }

  const placeholder = all.find((b) => b.code === "HQ" && b.name === "Cabang Utama");
  if (placeholder) {
    const updated = await updateBranch(tenantId, placeholder.id, {
      code: payload.code,
      name: payload.name,
      address: payload.address,
      phone: payload.phone,
      is_active: true,
    });
    if (!updated) throw new Error("Gagal memperbarui cabang utama");
    return updated;
  }

  if (all.length === 1) {
    const only = all[0]!;
    const updated = await updateBranch(tenantId, only.id, {
      code: payload.code,
      name: payload.name,
      address: payload.address,
      phone: payload.phone,
      is_active: true,
    });
    if (!updated) throw new Error("Gagal memperbarui cabang");
    return updated;
  }

  return createBranch(tenantId, payload);
}

async function deactivatePlaceholderBranches(tenantId: string, keepBranchId: string): Promise<void> {
  const all = await listBranches(tenantId);
  for (const b of all) {
    if (b.id === keepBranchId) continue;
    if (b.code === "HQ" && b.name === "Cabang Utama" && b.is_active) {
      await updateBranch(tenantId, b.id, { is_active: false });
    }
  }
}

export interface OpenCashierSessionInfo {
  id: string;
  cashier_id: string;
  cashier_name: string;
  opened_at: string;
  expected_cash_balance: number;
  active_carts: number;
}

export interface BranchCloseBlockers {
  openCashierSessions: number;
  openSessions: OpenCashierSessionInfo[];
  pendingTransfers: number;
  activeSalesOrders: number;
  blocked: boolean;
  blockReason: string | null;
  warnings: string[];
}

export async function getBranchCloseBlockers(
  tenantId: string,
  branchId: string,
): Promise<BranchCloseBlockers> {
  const db = getDb();
  const branch = await getBranch(tenantId, branchId);
  if (!branch) {
    return {
      openCashierSessions: 0,
      openSessions: [],
      pendingTransfers: 0,
      activeSalesOrders: 0,
      blocked: true,
      blockReason: "Toko tidak ditemukan",
      warnings: [],
    };
  }

  const openSessionRows = await db
    .select({
      id: cashierSessions.id,
      cashierId: cashierSessions.cashierId,
      cashierName: profiles.name,
      openedAt: cashierSessions.openedAt,
      expectedCashBalance: cashierSessions.expectedCashBalance,
    })
    .from(cashierSessions)
    .innerJoin(profiles, eq(cashierSessions.cashierId, profiles.id))
    .where(
      and(
        eq(cashierSessions.tenantId, tenantId),
        eq(cashierSessions.branchId, branchId),
        eq(cashierSessions.status, "open"),
      ),
    );

  const sessionIds = openSessionRows.map((r) => r.id);
  const cartCountBySession = new Map<string, number>();
  if (sessionIds.length > 0) {
    const cartRows = await db
      .select({
        sessionId: posCarts.sessionId,
        count: sql<number>`count(*)::int`,
      })
      .from(posCarts)
      .where(
        and(
          eq(posCarts.tenantId, tenantId),
          inArray(posCarts.sessionId, sessionIds),
          inArray(posCarts.status, ["active", "hold"]),
        ),
      )
      .groupBy(posCarts.sessionId);
    for (const row of cartRows) {
      cartCountBySession.set(row.sessionId, row.count);
    }
  }

  const openSessions: OpenCashierSessionInfo[] = openSessionRows.map((row) => ({
    id: row.id,
    cashier_id: row.cashierId,
    cashier_name: row.cashierName,
    opened_at: row.openedAt.toISOString(),
    expected_cash_balance: row.expectedCashBalance,
    active_carts: cartCountBySession.get(row.id) ?? 0,
  }));

  const openCashierSessions = openSessions.length;

  const [transferRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(stockTransfers)
    .where(
      and(
        eq(stockTransfers.tenantId, tenantId),
        or(
          eq(stockTransfers.fromBranchId, branchId),
          eq(stockTransfers.toBranchId, branchId),
        ),
        inArray(stockTransfers.status, ["draft", "sent"]),
      ),
    );

  const [soRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(salesOrders)
    .where(
      and(
        eq(salesOrders.tenantId, tenantId),
        eq(salesOrders.branchId, branchId),
        inArray(salesOrders.status, ["draft", "confirmed", "partial_delivered"]),
      ),
    );

  const pendingTransfers = transferRow?.count ?? 0;
  const activeSalesOrders = soRow?.count ?? 0;

  const warnings: string[] = [];
  if (pendingTransfers > 0) {
    warnings.push(`${pendingTransfers} transfer stok masih draft/dikirim`);
  }
  if (activeSalesOrders > 0) {
    warnings.push(`${activeSalesOrders} sales order masih aktif`);
  }

  const blocked = openCashierSessions > 0;
  const blockReason = blocked
    ? `${openCashierSessions} sesi kasir masih terbuka — tutup sesi kasir di POS atau gunakan tombol di bawah`
    : null;

  return {
    openCashierSessions,
    openSessions,
    pendingTransfers,
    activeSalesOrders,
    blocked,
    blockReason,
    warnings,
  };
}

async function assertCanDeactivateBranch(tenantId: string, branchId: string): Promise<void> {
  const branch = await getBranch(tenantId, branchId);
  if (!branch) throw new Error("Toko tidak ditemukan");
  if (!branch.is_active) return;

  const blockers = await getBranchCloseBlockers(tenantId, branchId);
  if (blockers.blocked && blockers.blockReason) {
    throw new Error(blockers.blockReason);
  }
}

export async function updateBranch(
  tenantId: string,
  branchId: string,
  updates: BranchUpdate,
): Promise<Branch | null> {
  const db = getDb();
  const patch: Partial<typeof branches.$inferInsert> = {};
  if (updates.code !== undefined) patch.code = updates.code;
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.address !== undefined) patch.address = updates.address;
  if (updates.phone !== undefined) patch.phone = updates.phone;
  if (updates.manager_id !== undefined) {
    if (updates.manager_id) {
      const db = getDb();
      const manager = await db.query.profiles.findFirst({
        where: and(
          eq(profiles.id, updates.manager_id),
          eq(profiles.tenantId, tenantId),
          eq(profiles.isActive, true),
          inArray(profiles.role, ["owner", "manager"]),
        ),
      });
      if (!manager) throw new Error("Manager tidak valid");
    }
    patch.managerId = updates.manager_id;
  }
  if (updates.is_active !== undefined) {
    if (updates.is_active === false) {
      await assertCanDeactivateBranch(tenantId, branchId);
    }
    patch.isActive = updates.is_active;
  }

  const [row] = await db
    .update(branches)
    .set(patch)
    .where(and(eq(branches.tenantId, tenantId), eq(branches.id, branchId)))
    .returning();
  return row ? toBranch(row) : null;
}

export async function assignUserToBranch(
  tenantId: string,
  userId: string,
  branchId: string,
): Promise<void> {
  const db = getDb();
  await db
    .insert(userBranches)
    .values({ userId, branchId, tenantId })
    .onConflictDoNothing();
}

export async function removeUserFromBranch(
  tenantId: string,
  userId: string,
  branchId: string,
): Promise<void> {
  const db = getDb();
  await db
    .delete(userBranches)
    .where(
      and(
        eq(userBranches.tenantId, tenantId),
        eq(userBranches.userId, userId),
        eq(userBranches.branchId, branchId),
      ),
    );
}
