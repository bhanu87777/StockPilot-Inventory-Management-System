import { prisma } from "./prisma";

// Plain-JSON shapes for the sales-side pages, mirroring lib/inventory.ts.

export type CustomerRow = {
  id: string;
  name: string;
  email: string;
  country: string;
  orderCount: number;
  lifetimeRevenue: number; // fulfilled orders only
};

export type SoRow = {
  id: string;
  number: string;
  status: string;
  createdAt: string;
  confirmedAt: string | null;
  fulfilledAt: string | null;
  customerId: string;
  customerName: string;
  warehouseId: string;
  warehouseCode: string;
  totalRevenue: number;
  items: { id: string; productId: string; productName: string; sku: string; quantity: number; unitPrice: number }[];
};

export async function getCustomers(): Promise<CustomerRow[]> {
  const rows = await prisma.customer.findMany({
    include: { salesOrders: { select: { status: true, items: { select: { quantity: true, unitPrice: true } } } } },
    orderBy: { name: "asc" },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    country: c.country,
    orderCount: c.salesOrders.length,
    lifetimeRevenue: c.salesOrders
      .filter((o) => o.status === "FULFILLED")
      .reduce((s, o) => s + o.items.reduce((x, i) => x + i.quantity * i.unitPrice, 0), 0),
  }));
}

export async function getSalesOrders(): Promise<SoRow[]> {
  const rows = await prisma.salesOrder.findMany({
    include: {
      customer: { select: { name: true } },
      warehouse: { select: { code: true } },
      items: { include: { product: { select: { name: true, sku: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((so) => ({
    id: so.id,
    number: so.number,
    status: so.status,
    createdAt: so.createdAt.toISOString(),
    confirmedAt: so.confirmedAt?.toISOString() ?? null,
    fulfilledAt: so.fulfilledAt?.toISOString() ?? null,
    customerId: so.customerId,
    customerName: so.customer.name,
    warehouseId: so.warehouseId,
    warehouseCode: so.warehouse.code,
    totalRevenue: so.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0),
    items: so.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.product.name,
      sku: i.product.sku,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
  }));
}

export type SalesStats = {
  revenue30d: number;
  fulfilled30d: number;
  openSoCount: number;
  openSoValue: number;
};

export async function getSalesStats(): Promise<SalesStats> {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [fulfilled, open] = await Promise.all([
    prisma.salesOrder.findMany({
      where: { status: "FULFILLED", fulfilledAt: { gte: since } },
      select: { items: { select: { quantity: true, unitPrice: true } } },
    }),
    prisma.salesOrder.findMany({
      where: { status: { in: ["DRAFT", "CONFIRMED"] } },
      select: { items: { select: { quantity: true, unitPrice: true } } },
    }),
  ]);
  const sum = (orders: { items: { quantity: number; unitPrice: number }[] }[]) =>
    orders.reduce((s, o) => s + o.items.reduce((x, i) => x + i.quantity * i.unitPrice, 0), 0);
  return {
    revenue30d: sum(fulfilled),
    fulfilled30d: fulfilled.length,
    openSoCount: open.length,
    openSoValue: sum(open),
  };
}
