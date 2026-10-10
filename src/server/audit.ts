import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type AuditEntry = {
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
};

/** Catat satu aksi admin (bisa di dalam transaksi perubahan datanya). */
export function recordAudit(entry: AuditEntry, tx: Tx | typeof db = db) {
  tx.insert(auditLogs)
    .values({ actorId: entry.actorId, action: entry.action, entity: entry.entity, entityId: entry.entityId ?? null, summary: entry.summary })
    .run();
}

/** Jejak aksi admin terbaru beserta nama pencatat. */
export function listAudit(limit = 50) {
  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entity: auditLogs.entity,
      entityId: auditLogs.entityId,
      summary: auditLogs.summary,
      actorId: auditLogs.actorId,
      actorName: users.name,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorId))
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(Math.min(Math.max(limit, 1), 500))
    .all()
    .map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}
