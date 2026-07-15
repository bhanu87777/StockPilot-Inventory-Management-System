import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";

// Notifications are global rows (facts about inventory, not about a user);
// per-user read state lives in NotificationRead. `resolvedAt` is the dedup
// anchor: at most one unresolved notification per (type, entityId), so
// repeated OUTs on an already-low SKU don't spam the bell.
//
// Everything is emitted synchronously inside the write transactions (no cron
// on Vercel); PO_OVERDUE and LOT_EXPIRING are swept lazily when the feed is
// fetched.

type Db = PrismaClient | Prisma.TransactionClient;

const DAY = 24 * 60 * 60 * 1000;

async function hasOpen(db: Db, type: "LOW_STOCK" | "STOCKOUT" | "PO_OVERDUE" | "LOT_EXPIRING", entityId: string) {
  const existing = await db.notification.findFirst({
    where: { type, entityId, resolvedAt: null },
    select: { id: true },
  });
  return !!existing;
}

// Called inside the movement / PO-receive / SO-fulfill transactions with the
// product TOTAL before and after (callers hold the relevant row locks).
export async function emitStockLevel(
  db: Db,
  product: { id: string; name: string; sku: string; reorderPoint: number },
  prevQty: number,
  newQty: number
) {
  if (newQty === 0 && prevQty > 0) {
    // Stockout: resolve any open LOW_STOCK, raise STOCKOUT.
    await db.notification.updateMany({
      where: { type: "LOW_STOCK", entityId: product.id, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
    if (!(await hasOpen(db, "STOCKOUT", product.id))) {
      await db.notification.create({
        data: {
          type: "STOCKOUT",
          title: `${product.sku} is out of stock`,
          body: `${product.name} has hit zero on hand.`,
          entityType: "Product",
          entityId: product.id,
          href: `/inventory?q=${encodeURIComponent(product.sku)}`,
        },
      });
    }
    return;
  }

  if (newQty > 0 && newQty <= product.reorderPoint && prevQty > product.reorderPoint) {
    if (!(await hasOpen(db, "LOW_STOCK", product.id))) {
      await db.notification.create({
        data: {
          type: "LOW_STOCK",
          title: `${product.sku} fell below its reorder point`,
          body: `${product.name} is at ${newQty} on hand (reorder point ${product.reorderPoint}).`,
          entityType: "Product",
          entityId: product.id,
          href: `/inventory?q=${encodeURIComponent(product.sku)}`,
        },
      });
    }
    return;
  }

  if (newQty > product.reorderPoint && prevQty <= product.reorderPoint) {
    // Recovered: resolve open low/stockout alerts.
    await db.notification.updateMany({
      where: { type: { in: ["LOW_STOCK", "STOCKOUT"] }, entityId: product.id, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
  }
}

export async function emitPoReceived(db: Db, po: { id: string; number: string }, lineCount: number, units: number) {
  await db.notification.updateMany({
    where: { type: "PO_OVERDUE", entityId: po.id, resolvedAt: null },
    data: { resolvedAt: new Date() },
  });
  await db.notification.create({
    data: {
      type: "PO_RECEIVED",
      title: `${po.number} received`,
      body: `${lineCount} line${lineCount === 1 ? "" : "s"}, +${units} units into stock.`,
      entityType: "PurchaseOrder",
      entityId: po.id,
      href: "/purchase-orders",
    },
  });
}

export async function emitSoFulfilled(db: Db, so: { id: string; number: string }, customerName: string, units: number) {
  await db.notification.create({
    data: {
      type: "SO_FULFILLED",
      title: `${so.number} fulfilled`,
      body: `${units} units shipped to ${customerName}.`,
      entityType: "SalesOrder",
      entityId: so.id,
      href: "/sales-orders",
    },
  });
}

// Cancelling a PO clears its overdue alert.
export async function resolvePoNotifications(db: Db, poId: string) {
  await db.notification.updateMany({
    where: { type: "PO_OVERDUE", entityId: poId, resolvedAt: null },
    data: { resolvedAt: new Date() },
  });
}

// Lazy sweeps, run when the feed is fetched. Idempotent and cheap.
export async function sweepPoOverdue(db: PrismaClient) {
  const overdue = await db.purchaseOrder.findMany({
    where: { status: "ORDERED", expectedAt: { lt: new Date() } },
    select: { id: true, number: true, expectedAt: true, supplier: { select: { name: true } } },
  });
  for (const po of overdue) {
    if (await hasOpen(db, "PO_OVERDUE", po.id)) continue;
    const days = Math.max(1, Math.floor((Date.now() - po.expectedAt!.getTime()) / DAY));
    await db.notification.create({
      data: {
        type: "PO_OVERDUE",
        title: `${po.number} is overdue`,
        body: `Expected ${days} day${days === 1 ? "" : "s"} ago from ${po.supplier.name}.`,
        entityType: "PurchaseOrder",
        entityId: po.id,
        href: "/purchase-orders",
      },
    });
  }
}

export async function sweepLotsExpiring(db: PrismaClient, withinDays = 30) {
  const soon = new Date(Date.now() + withinDays * DAY);
  const lots = await db.lot.findMany({
    where: { qtyRemaining: { gt: 0 }, expiryDate: { lte: soon } },
    select: {
      id: true,
      lotCode: true,
      expiryDate: true,
      qtyRemaining: true,
      product: { select: { sku: true, name: true } },
      warehouse: { select: { code: true } },
    },
  });
  for (const lot of lots) {
    if (await hasOpen(db, "LOT_EXPIRING", lot.id)) continue;
    const days = Math.ceil((lot.expiryDate.getTime() - Date.now()) / DAY);
    await db.notification.create({
      data: {
        type: "LOT_EXPIRING",
        title:
          days < 0
            ? `${lot.product.sku} lot ${lot.lotCode} has expired`
            : `${lot.product.sku} lot ${lot.lotCode} expires in ${days}d`,
        body: `${lot.qtyRemaining} units of ${lot.product.name} in ${lot.warehouse.code}.`,
        entityType: "Lot",
        entityId: lot.id,
        href: "/warehouses",
      },
    });
  }
}

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
  resolvedAt: string | null;
  read: boolean;
};

export async function getNotifications(userId: string, limit = 30) {
  await sweepPoOverdue(prisma);
  await sweepLotsExpiring(prisma);
  const rows = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { reads: { where: { userId }, select: { userId: true } } },
  });
  const unreadCount = await prisma.notification.count({
    where: { reads: { none: { userId } } },
  });
  const notifications: NotificationRow[] = rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    href: n.href,
    createdAt: n.createdAt.toISOString(),
    resolvedAt: n.resolvedAt ? n.resolvedAt.toISOString() : null,
    read: n.reads.length > 0,
  }));
  return { notifications, unreadCount };
}
