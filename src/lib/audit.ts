import type { Prisma, PrismaClient } from "@prisma/client";

// Who-did-what trail. Accepts either the global client or a transaction
// client so mutations and their audit rows commit atomically.
//
// Action strings are dot-namespaced `<entity>.<verb>`:
//   product.create|update|delete · movement.create · transfer.create
//   po.create|order|receive|cancel · so.create|confirm|fulfill|cancel
//   warehouse.create · customer.create · user.create|role_change|delete
//   advisor.run

import { prisma } from "./prisma";

type Db = PrismaClient | Prisma.TransactionClient;

export type Actor = { id: string; email?: string | null };

export type AuditRow = {
  id: string;
  userEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: string;
};

export async function getAuditLogs(limit = 500): Promise<AuditRow[]> {
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    userEmail: r.userEmail,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    summary: r.summary,
    createdAt: r.createdAt.toISOString(),
  }));
}

export function audit(
  db: Db,
  actor: Actor,
  entry: {
    action: string;
    entityType: string;
    entityId?: string;
    summary: string;
    metadata?: Prisma.InputJsonValue;
  }
) {
  return db.auditLog.create({
    data: {
      userId: actor.id,
      userEmail: actor.email ?? "unknown",
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      summary: entry.summary,
      metadata: entry.metadata,
    },
  });
}
