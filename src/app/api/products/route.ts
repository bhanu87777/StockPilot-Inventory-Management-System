import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { validateProductInput, createProductWithOpeningBalance } from "@/lib/products";
import { getDefaultWarehouseId } from "@/lib/warehouses";

// POST /api/products — add a SKU. An opening-balance movement is written in
// the same transaction when initial stock is provided, so the ledger stays
// the single source of truth.
export async function POST(req: Request) {
  const auth = await requirePermission("product.create");
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));
  const parsed = validateProductInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  const dup = await prisma.product.findUnique({ where: { sku: data.sku } });
  if (dup) return NextResponse.json({ error: `SKU ${data.sku} already exists.` }, { status: 409 });
  if (data.barcode) {
    const dupBc = await prisma.product.findUnique({ where: { barcode: data.barcode } });
    if (dupBc) return NextResponse.json({ error: `Barcode ${data.barcode} is already assigned to ${dupBc.sku}.` }, { status: 409 });
  }

  const warehouseId = await getDefaultWarehouseId();
  const product = await prisma.$transaction(async (tx) => {
    const p = await createProductWithOpeningBalance(tx, data, warehouseId, session.user.id);
    await audit(tx, session.user, {
      action: "product.create",
      entityType: "Product",
      entityId: p.id,
      summary: `Created SKU ${p.sku} — ${p.name} (opening ${data.initialQty})`,
    });
    return p;
  });

  return NextResponse.json(product, { status: 201 });
}
