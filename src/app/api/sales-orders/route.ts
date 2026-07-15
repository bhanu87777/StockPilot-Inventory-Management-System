import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";

// POST /api/sales-orders — create a draft SO with line items. Mirrors the PO
// create route: unit prices are snapshotted from the catalog at creation.
export async function POST(req: Request) {
  const auth = await requirePermission("so.create");
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));
  const customerId = typeof body.customerId === "string" ? body.customerId : "";
  const warehouseId = typeof body.warehouseId === "string" ? body.warehouseId : "";
  const rawItems: unknown = body.items;

  if (!customerId || !warehouseId || !Array.isArray(rawItems) || rawItems.length === 0) {
    return NextResponse.json({ error: "A customer, a warehouse, and at least one line item are required." }, { status: 400 });
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

  const [customer, warehouse, products] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId } }),
    prisma.warehouse.findUnique({ where: { id: warehouseId } }),
    prisma.product.findMany({ where: { id: { in: items.map((i) => i.productId) } } }),
  ]);
  if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  if (!warehouse) return NextResponse.json({ error: "Warehouse not found." }, { status: 404 });
  const priceById = new Map(products.map((p) => [p.id, p.price]));
  if (products.length !== new Set(items.map((i) => i.productId)).size) {
    return NextResponse.json({ error: "Unknown product on the order." }, { status: 400 });
  }

  // SO-2026-XXXX, next in sequence.
  const last = await prisma.salesOrder.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  const lastSeq = last ? Number(last.number.split("-").pop()) : 100;
  const number = `SO-2026-0${lastSeq + 1}`;

  const so = await prisma.$transaction(async (tx) => {
    const created = await tx.salesOrder.create({
      data: {
        number,
        customerId,
        warehouseId,
        status: "DRAFT",
        items: {
          create: items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: priceById.get(i.productId) ?? 0 })),
        },
      },
      include: { items: true },
    });
    await audit(tx, session.user, {
      action: "so.create",
      entityType: "SalesOrder",
      entityId: created.id,
      summary: `Created draft ${number} for ${customer.name} (${items.length} lines)`,
    });
    return created;
  });
  return NextResponse.json(so, { status: 201 });
}
