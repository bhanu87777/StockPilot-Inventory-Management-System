import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/purchase-orders/:id — drive the status machine.
// action: "order" (DRAFT→ORDERED), "receive" (ORDERED→RECEIVED, increments
// stock + writes IN movements atomically), "cancel" (DRAFT/ORDERED→CANCELLED).
export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: true, supplier: true },
  });
  if (!po) return NextResponse.json({ error: "Purchase order not found." }, { status: 404 });

  if (action === "order") {
    if (po.status !== "DRAFT") return NextResponse.json({ error: "Only a draft can be marked as ordered." }, { status: 409 });
    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: "ORDERED",
        orderedAt: new Date(),
        expectedAt: new Date(Date.now() + po.supplier.leadTimeDays * 86_400_000),
      },
    });
    return NextResponse.json(updated);
  }

  if (action === "receive") {
    if (po.status !== "ORDERED") return NextResponse.json({ error: "Only an ordered PO can be received." }, { status: 409 });
    const updated = await prisma.$transaction(async (tx) => {
      // Each line increments stock and writes an IN movement with the new balance.
      for (const item of po.items) {
        const p = await tx.product.update({
          where: { id: item.productId },
          data: { quantity: { increment: item.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: "IN",
            quantity: item.quantity,
            balance: p.quantity,
            reason: "PO received",
            reference: po.number,
          },
        });
      }
      return tx.purchaseOrder.update({ where: { id }, data: { status: "RECEIVED", receivedAt: new Date() } });
    });
    return NextResponse.json(updated);
  }

  if (action === "cancel") {
    if (po.status !== "DRAFT" && po.status !== "ORDERED") {
      return NextResponse.json({ error: "Only a draft or ordered PO can be cancelled." }, { status: 409 });
    }
    const updated = await prisma.purchaseOrder.update({ where: { id }, data: { status: "CANCELLED" } });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
