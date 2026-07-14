import { prisma } from "./prisma";

// Plain-JSON shapes handed from server components to client components.
export type ProductRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unitCost: number;
  price: number;
  quantity: number;
  reorderPoint: number;
  reorderQty: number;
  supplierId: string;
  supplierName: string;
  leadTimeDays: number;
  velocity30d: number; // avg units OUT per day, last 30 days
  lastOutAt: string | null;
};

export type MovementRow = {
  id: string;
  type: string;
  quantity: number;
  balance: number;
  reason: string;
  reference: string | null;
  occurredAt: string;
  productId: string;
  productName: string;
  sku: string;
};

export type SupplierRow = {
  id: string;
  name: string;
  email: string;
  country: string;
  leadTimeDays: number;
  skuCount: number;
};

export type PoRow = {
  id: string;
  number: string;
  status: string;
  createdAt: string;
  orderedAt: string | null;
  expectedAt: string | null;
  receivedAt: string | null;
  supplierId: string;
  supplierName: string;
  totalCost: number;
  items: { id: string; productId: string; productName: string; sku: string; quantity: number; unitCost: number }[];
};

export function stockStatus(p: { quantity: number; reorderPoint: number }): "OUT" | "LOW" | "OK" {
  if (p.quantity === 0) return "OUT";
  if (p.quantity <= p.reorderPoint) return "LOW";
  return "OK";
}

export async function getProducts(): Promise<ProductRow[]> {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [products, outs] = await Promise.all([
    prisma.product.findMany({ include: { supplier: true }, orderBy: { sku: "asc" } }),
    prisma.stockMovement.groupBy({
      by: ["productId"],
      where: { type: "OUT", occurredAt: { gte: since } },
      _sum: { quantity: true },
      _max: { occurredAt: true },
    }),
  ]);
  // Last OUT ever (dead-stock detection needs more than a 30d window).
  const lastOuts = await prisma.stockMovement.groupBy({
    by: ["productId"],
    where: { type: "OUT" },
    _max: { occurredAt: true },
  });
  const outBySku = new Map(outs.map((o) => [o.productId, o._sum.quantity ?? 0]));
  const lastOutBy = new Map(lastOuts.map((o) => [o.productId, o._max.occurredAt]));

  return products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    category: p.category,
    unitCost: p.unitCost,
    price: p.price,
    quantity: p.quantity,
    reorderPoint: p.reorderPoint,
    reorderQty: p.reorderQty,
    supplierId: p.supplierId,
    supplierName: p.supplier.name,
    leadTimeDays: p.supplier.leadTimeDays,
    velocity30d: Math.round(((outBySku.get(p.id) ?? 0) / 30) * 100) / 100,
    lastOutAt: lastOutBy.get(p.id)?.toISOString() ?? null,
  }));
}

export async function getMovements(limit = 400): Promise<MovementRow[]> {
  const rows = await prisma.stockMovement.findMany({
    orderBy: { occurredAt: "desc" },
    take: limit,
    include: { product: { select: { name: true, sku: true } } },
  });
  return rows.map((m) => ({
    id: m.id,
    type: m.type,
    quantity: m.quantity,
    balance: m.balance,
    reason: m.reason,
    reference: m.reference,
    occurredAt: m.occurredAt.toISOString(),
    productId: m.productId,
    productName: m.product.name,
    sku: m.product.sku,
  }));
}

export async function getSuppliers(): Promise<SupplierRow[]> {
  const rows = await prisma.supplier.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  });
  return rows.map((s) => ({
    id: s.id,
    name: s.name,
    email: s.email,
    country: s.country,
    leadTimeDays: s.leadTimeDays,
    skuCount: s._count.products,
  }));
}

export async function getPurchaseOrders(): Promise<PoRow[]> {
  const rows = await prisma.purchaseOrder.findMany({
    include: { supplier: true, items: { include: { product: { select: { name: true, sku: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((po) => ({
    id: po.id,
    number: po.number,
    status: po.status,
    createdAt: po.createdAt.toISOString(),
    orderedAt: po.orderedAt?.toISOString() ?? null,
    expectedAt: po.expectedAt?.toISOString() ?? null,
    receivedAt: po.receivedAt?.toISOString() ?? null,
    supplierId: po.supplierId,
    supplierName: po.supplier.name,
    totalCost: po.items.reduce((s, i) => s + i.quantity * i.unitCost, 0),
    items: po.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.product.name,
      sku: i.product.sku,
      quantity: i.quantity,
      unitCost: i.unitCost,
    })),
  }));
}

// Weekly IN/OUT totals for the dashboard flow chart (last 12 weeks).
export async function getWeeklyFlows(): Promise<{ week: string; in: number; out: number }[]> {
  const since = new Date(Date.now() - 12 * 7 * 86_400_000);
  const rows = await prisma.stockMovement.findMany({
    where: { occurredAt: { gte: since }, type: { in: ["IN", "OUT"] } },
    select: { type: true, quantity: true, occurredAt: true },
  });
  const buckets = new Map<number, { in: number; out: number }>();
  for (const r of rows) {
    const week = Math.floor(r.occurredAt.getTime() / (7 * 86_400_000));
    const b = buckets.get(week) ?? { in: 0, out: 0 };
    if (r.type === "IN") b.in += r.quantity;
    else b.out += r.quantity;
    buckets.set(week, b);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([week, v]) => {
      const start = new Date(week * 7 * 86_400_000);
      return {
        week: start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
        in: v.in,
        out: v.out,
      };
    });
}
