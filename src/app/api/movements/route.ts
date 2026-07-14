import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import type { MovementType } from "@prisma/client";

// POST /api/movements — record IN / OUT / ADJUST. The product row is locked
// inside the transaction, stock can never go negative, and the movement
// snapshots the resulting balance.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const productId = typeof body.productId === "string" ? body.productId : "";
  const type = body.type as MovementType;
  const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : null;
  const reference = typeof body.reference === "string" && body.reference.trim() ? body.reference.trim() : null;
  const rawQty = Math.floor(Number(body.quantity));

  if (!productId || !["IN", "OUT", "ADJUST"].includes(type)) {
    return NextResponse.json({ error: "Product and movement type are required." }, { status: 400 });
  }
  if (!Number.isFinite(rawQty) || rawQty === 0) {
    return NextResponse.json({ error: "Quantity must be a non-zero whole number." }, { status: 400 });
  }
  if ((type === "IN" || type === "OUT") && rawQty < 0) {
    return NextResponse.json({ error: `${type} quantity must be positive (use ADJUST for signed corrections).` }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: "A reason is required — the ledger is the audit trail." }, { status: 400 });
  }

  try {
    const movement = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ quantity: number }[]>`SELECT quantity FROM "Product" WHERE id = ${productId} FOR UPDATE`;
      if (rows.length === 0) throw new Error("NOT_FOUND");
      const current = rows[0].quantity;

      const delta = type === "IN" ? rawQty : type === "OUT" ? -rawQty : rawQty;
      const balance = current + delta;
      if (balance < 0) throw new Error(`INSUFFICIENT:${current}`);

      await tx.product.update({ where: { id: productId }, data: { quantity: balance } });
      return tx.stockMovement.create({
        data: { productId, type, quantity: rawQty, balance, reason, reference },
        include: { product: { select: { name: true, sku: true } } },
      });
    });
    return NextResponse.json(movement, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NOT_FOUND") return NextResponse.json({ error: "Product not found." }, { status: 404 });
    if (msg.startsWith("INSUFFICIENT:")) {
      return NextResponse.json({ error: `Insufficient stock — only ${msg.split(":")[1]} on hand.` }, { status: 409 });
    }
    throw e;
  }
}
