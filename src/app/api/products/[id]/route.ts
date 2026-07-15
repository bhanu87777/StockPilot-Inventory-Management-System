import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { validateImageUrl } from "@/lib/products";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/products/:id — edit catalog fields. Quantity is deliberately NOT
// editable here: stock only changes through movements or PO receipts.
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requirePermission("product.edit");
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  for (const field of ["name", "category", "supplierId"] as const) {
    if (typeof body[field] === "string" && body[field].trim()) data[field] = body[field].trim();
  }
  for (const field of ["unitCost", "price"] as const) {
    if (body[field] !== undefined) {
      const v = Number(body[field]);
      if (!Number.isFinite(v) || v < 0) return NextResponse.json({ error: `Invalid ${field}.` }, { status: 400 });
      data[field] = v;
    }
  }
  for (const field of ["reorderPoint", "reorderQty"] as const) {
    if (body[field] !== undefined) {
      const v = Math.floor(Number(body[field]));
      if (!Number.isFinite(v) || v < 0) return NextResponse.json({ error: `Invalid ${field}.` }, { status: 400 });
      data[field] = v;
    }
  }
  if (body.barcode !== undefined) {
    const barcode = typeof body.barcode === "string" && body.barcode.trim() ? body.barcode.trim() : null;
    if (barcode) {
      const dup = await prisma.product.findUnique({ where: { barcode } });
      if (dup && dup.id !== id) {
        return NextResponse.json({ error: `Barcode ${barcode} is already assigned to ${dup.sku}.` }, { status: 409 });
      }
    }
    data.barcode = barcode;
  }
  if (body.imageUrl !== undefined) {
    data.imageUrl = validateImageUrl(body.imageUrl);
  }
  if (body.isPerishable !== undefined) {
    data.isPerishable = body.isPerishable === true;
  }
  if (body.shelfLifeDays !== undefined) {
    const v = Math.floor(Number(body.shelfLifeDays) || 0);
    data.shelfLifeDays = v > 0 ? v : null;
  }

  const product = await prisma.$transaction(async (tx) => {
    const p = await tx.product.update({ where: { id }, data });
    await audit(tx, session.user, {
      action: "product.update",
      entityType: "Product",
      entityId: id,
      summary: `Updated ${p.sku} (${Object.keys(data).join(", ")})`,
      metadata: { fields: Object.keys(data) },
    });
    return p;
  });
  return NextResponse.json(product);
}

// DELETE /api/products/:id — remove a SKU (cascades its movements and lots).
// Blocked while the SKU sits on an open purchase or sales order.
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requirePermission("product.delete");
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { id } = await params;
  const [onOpenPo, onOpenSo] = await Promise.all([
    prisma.purchaseOrderItem.count({
      where: { productId: id, po: { status: { in: ["DRAFT", "ORDERED"] } } },
    }),
    prisma.salesOrderItem.count({
      where: { productId: id, so: { status: { in: ["DRAFT", "CONFIRMED"] } } },
    }),
  ]);
  if (onOpenPo > 0) {
    return NextResponse.json({ error: "This SKU is on an open purchase order — cancel or receive it first." }, { status: 409 });
  }
  if (onOpenSo > 0) {
    return NextResponse.json({ error: "This SKU is on an open sales order — cancel or fulfill it first." }, { status: 409 });
  }

  const snapshot = await prisma.product.findUnique({ where: { id }, select: { sku: true, name: true } });
  if (!snapshot) return NextResponse.json({ error: "Product not found." }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    // Items on RECEIVED/CANCELLED POs and FULFILLED/CANCELLED SOs.
    await tx.purchaseOrderItem.deleteMany({ where: { productId: id } });
    await tx.salesOrderItem.deleteMany({ where: { productId: id } });
    await tx.product.delete({ where: { id } });
    await audit(tx, session.user, {
      action: "product.delete",
      entityType: "Product",
      entityId: id,
      summary: `Deleted SKU ${snapshot.sku} — ${snapshot.name}`,
    });
  });
  return NextResponse.json({ ok: true });
}
