import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";

// POST /api/purchase-orders — create a draft PO with line items.
export async function POST(req: Request) {
  const auth = await requirePermission("po.create");
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));
  const supplierId = typeof body.supplierId === "string" ? body.supplierId : "";
  const rawItems: unknown = body.items;

  if (!supplierId || !Array.isArray(rawItems) || rawItems.length === 0) {
    return NextResponse.json({ error: "A supplier and at least one line item are required." }, { status: 400 });
  }

  const items: { productId: string; quantity: number }[] = [];
  for (const it of rawItems as { productId?: unknown; quantity?: unknown }[]) {
    const productId = typeof it.productId === "string" ? it.productId : "";
    const quantity = Math.floor(Number(it.quantity));
    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: "Every line needs a product and a positive quantity." }, { status: 400 });
    }
    items.push({ productId, quantity });
  }

  const products = await prisma.product.findMany({ where: { id: { in: items.map((i) => i.productId) } } });
  const costById = new Map(products.map((p) => [p.id, p.unitCost]));
  if (products.length !== new Set(items.map((i) => i.productId)).size) {
    return NextResponse.json({ error: "Unknown product on the order." }, { status: 400 });
  }

  // PO-2026-XXXX, next in sequence.
  const last = await prisma.purchaseOrder.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  const lastSeq = last ? Number(last.number.split("-").pop()) : 400;
  const number = `PO-2026-0${lastSeq + 1}`;

  const po = await prisma.$transaction(async (tx) => {
    const created = await tx.purchaseOrder.create({
      data: {
        number,
        supplierId,
        status: "DRAFT",
        items: {
          create: items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitCost: costById.get(i.productId) ?? 0 })),
        },
      },
      include: { items: true },
    });
    await audit(tx, session.user, {
      action: "po.create",
      entityType: "PurchaseOrder",
      entityId: created.id,
      summary: `Created draft ${number} (${items.length} lines)`,
    });
    return created;
  });
  return NextResponse.json(po, { status: 201 });
}
