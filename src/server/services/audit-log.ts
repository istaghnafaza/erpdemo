// =============================================================================
// Audit log — void, price changes, user actions (Fase C P2-4)
// =============================================================================

import { auditEvents } from "@/server/db/schema";
import { getWriteDb } from "@/server/db";

export interface AuditEventInput {
  tenantId: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}

export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  const db = getWriteDb();
  await db.insert(auditEvents).values({
    tenantId: input.tenantId,
    actorId: input.actorId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    ipAddress: input.ipAddress ?? null,
  });
}
