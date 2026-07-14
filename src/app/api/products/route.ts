import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// POST /api/products — add a SKU. An opening-balance movement is written in
// the same transaction when initial stock is provided, so the ledger stays
// the single source of truth.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const sku = typeof body.sku === "string" ? body.sku.trim().toUpperCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const supplierId = typeof body.supplierId === "string" ? body.supplierId : "";
  const unitCost = Number(body.unitCost);
  const price = Number(body.price);
  const initialQty = Math.max(0, Math.floor(Number(body.initialQty) || 0));
  const reorderPoint = Math.max(0, Math.floor(Number(body.reorderPoint) || 0));
  const reorderQty = Math.max(1, Math.floor(Number(body.reorderQty) || 1));

  if (!sku || !name || !category || !supplierId) {
    return NextResponse.json({ error: "SKU, name, category, and supplier are required." }, { status: 400 });
  }
  if (!Number.isFinite(unitCost) || unitCost < 0 || !Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: "Cost and price must be non-negative numbers." }, { status: 400 });
  }
  const dup = await prisma.product.findUnique({ where: { sku } });
  if (dup) return NextResponse.json({ error: `SKU ${sku} already exists.` }, { status: 409 });

  const product = await prisma.$transaction(async (tx) => {
    const p = await tx.product.create({
      data: { sku, name, category, unitCost, price, quantity: initialQty, reorderPoint, reorderQty, supplierId },
    });
    if (initialQty > 0) {
      await tx.stockMovement.create({
        data: { productId: p.id, type: "IN", quantity: initialQty, balance: initialQty, reason: "Opening balance" },
      });
    }
    return p;
  });

  return NextResponse.json(product, { status: 201 });
}
