import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/products/:id — edit catalog fields. Quantity is deliberately NOT
// editable here: stock only changes through movements or PO receipts.
export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const product = await prisma.product.update({ where: { id }, data });
  return NextResponse.json(product);
}

// DELETE /api/products/:id — remove a SKU (cascades its movements). Blocked
// while the SKU sits on a non-cancelled purchase order.
export async function DELETE(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const onOpenPo = await prisma.purchaseOrderItem.count({
    where: { productId: id, po: { status: { in: ["DRAFT", "ORDERED"] } } },
  });
  if (onOpenPo > 0) {
    return NextResponse.json({ error: "This SKU is on an open purchase order — cancel or receive it first." }, { status: 409 });
  }
  await prisma.purchaseOrderItem.deleteMany({ where: { productId: id } }); // items on RECEIVED/CANCELLED POs
  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
