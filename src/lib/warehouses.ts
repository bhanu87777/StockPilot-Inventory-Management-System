import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";

type Db = PrismaClient | Prisma.TransactionClient;

// Movements, PO receives, and product creation fall back to the default
// warehouse when no destination is chosen.
export async function getDefaultWarehouseId(db: Db = prisma): Promise<string> {
  const wh =
    (await db.warehouse.findFirst({ where: { isDefault: true }, select: { id: true } })) ??
    (await db.warehouse.findFirst({ select: { id: true } }));
  if (!wh) throw new Error("No warehouse configured — run the seed or create one.");
  return wh.id;
}

export type WarehouseRow = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  isDefault: boolean;
  skuCount: number;
  totalUnits: number;
  stockValue: number;
};

export async function getWarehouses(): Promise<WarehouseRow[]> {
  const rows = await prisma.warehouse.findMany({
    orderBy: [{ isDefault: "desc" }, { code: "asc" }],
    include: {
      stockLevels: {
        where: { quantity: { gt: 0 } },
        select: { quantity: true, product: { select: { unitCost: true } } },
      },
    },
  });
  return rows.map((w) => ({
    id: w.id,
    code: w.code,
    name: w.name,
    city: w.city,
    isDefault: w.isDefault,
    skuCount: w.stockLevels.length,
    totalUnits: w.stockLevels.reduce((s, l) => s + l.quantity, 0),
    stockValue: w.stockLevels.reduce((s, l) => s + l.quantity * l.product.unitCost, 0),
  }));
}
