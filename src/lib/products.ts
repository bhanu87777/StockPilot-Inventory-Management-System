import type { Prisma } from "@prisma/client";

// Shared product-creation logic: used by POST /api/products, the CSV
// importer, and the seed. Creation writes the opening-balance movement and
// the per-warehouse stock level in the same transaction, so the ledger stays
// the single source of truth.

export type ProductInput = {
  sku: string;
  name: string;
  category: string;
  supplierId: string;
  unitCost: number;
  price: number;
  initialQty: number;
  reorderPoint: number;
  reorderQty: number;
  barcode: string | null;
  imageUrl: string | null;
  isPerishable: boolean;
  shelfLifeDays: number | null;
};

export function validateImageUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s.length > 500) return null;
  try {
    const url = new URL(s);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return s;
  } catch {
    return null;
  }
}

export function validateProductInput(
  body: Record<string, unknown>
): { ok: true; data: ProductInput } | { ok: false; error: string } {
  const sku = typeof body.sku === "string" ? body.sku.trim().toUpperCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const supplierId = typeof body.supplierId === "string" ? body.supplierId : "";
  const unitCost = Number(body.unitCost);
  const price = Number(body.price);
  const initialQty = Math.max(0, Math.floor(Number(body.initialQty) || 0));
  const reorderPoint = Math.max(0, Math.floor(Number(body.reorderPoint) || 0));
  const reorderQty = Math.max(1, Math.floor(Number(body.reorderQty) || 1));
  const barcode = typeof body.barcode === "string" && body.barcode.trim() ? body.barcode.trim() : null;
  const imageUrl = validateImageUrl(body.imageUrl);
  const isPerishable = body.isPerishable === true;
  const shelfLifeRaw = Math.floor(Number(body.shelfLifeDays) || 0);
  const shelfLifeDays = isPerishable && shelfLifeRaw > 0 ? shelfLifeRaw : null;

  if (!sku || !name || !category || !supplierId) {
    return { ok: false, error: "SKU, name, category, and supplier are required." };
  }
  if (!Number.isFinite(unitCost) || unitCost < 0 || !Number.isFinite(price) || price < 0) {
    return { ok: false, error: "Cost and price must be non-negative numbers." };
  }

  return {
    ok: true,
    data: {
      sku, name, category, supplierId, unitCost, price,
      initialQty, reorderPoint, reorderQty,
      barcode, imageUrl, isPerishable, shelfLifeDays,
    },
  };
}

// Runs inside a caller-provided transaction. The caller has already checked
// SKU/barcode uniqueness (or accepts the P2002 rejection).
export async function createProductWithOpeningBalance(
  tx: Prisma.TransactionClient,
  data: ProductInput,
  warehouseId: string,
  createdById?: string
) {
  const p = await tx.product.create({
    data: {
      sku: data.sku,
      name: data.name,
      category: data.category,
      unitCost: data.unitCost,
      price: data.price,
      quantity: data.initialQty,
      reorderPoint: data.reorderPoint,
      reorderQty: data.reorderQty,
      barcode: data.barcode ?? data.sku,
      imageUrl: data.imageUrl,
      isPerishable: data.isPerishable,
      shelfLifeDays: data.shelfLifeDays,
      supplierId: data.supplierId,
    },
  });
  await tx.stockLevel.create({
    data: { productId: p.id, warehouseId, quantity: data.initialQty },
  });
  if (data.initialQty > 0) {
    await tx.stockMovement.create({
      data: {
        productId: p.id,
        warehouseId,
        type: "IN",
        quantity: data.initialQty,
        balance: data.initialQty,
        reason: "Opening balance",
        createdById,
      },
    });
  }
  return p;
}
