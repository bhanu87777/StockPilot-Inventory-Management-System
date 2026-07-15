import { prisma } from "./prisma";
import { stockStatus } from "./inventory";

// Report queries — deliberately uncapped (the UI's ledger view stops at 400
// rows; exports get everything in range).

export type ValuationRow = {
  sku: string;
  name: string;
  category: string;
  supplierName: string;
  quantity: number;
  unitCost: number;
  value: number;
  status: string;
  perWarehouse: string; // "MAIN 320 · EAST 80"
};

export async function getValuationReport(): Promise<ValuationRow[]> {
  const products = await prisma.product.findMany({
    include: {
      supplier: { select: { name: true } },
      stockLevels: { where: { quantity: { gt: 0 } }, include: { warehouse: { select: { code: true } } } },
    },
    orderBy: { sku: "asc" },
  });
  return products.map((p) => ({
    sku: p.sku,
    name: p.name,
    category: p.category,
    supplierName: p.supplier.name,
    quantity: p.quantity,
    unitCost: p.unitCost,
    value: Math.round(p.quantity * p.unitCost * 100) / 100,
    status: stockStatus(p),
    perWarehouse: p.stockLevels.map((l) => `${l.warehouse.code} ${l.quantity}`).join(" · "),
  }));
}

export async function getMovementReport(opts: { from?: Date; to?: Date; type?: string }) {
  const where: Record<string, unknown> = {};
  if (opts.from || opts.to) {
    where.occurredAt = {
      ...(opts.from ? { gte: opts.from } : {}),
      ...(opts.to ? { lte: opts.to } : {}),
    };
  }
  if (opts.type && ["IN", "OUT", "ADJUST", "TRANSFER_IN", "TRANSFER_OUT"].includes(opts.type)) {
    where.type = opts.type;
  }
  return prisma.stockMovement.findMany({
    where,
    orderBy: { occurredAt: "desc" },
    include: {
      product: { select: { sku: true, name: true } },
      warehouse: { select: { code: true } },
      lot: { select: { lotCode: true } },
      createdBy: { select: { email: true } },
    },
  });
}

export async function getPoReport() {
  return prisma.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: { supplier: { select: { name: true } }, items: true },
  });
}
