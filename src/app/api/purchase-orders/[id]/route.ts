import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { emitPoReceived, emitStockLevel, resolvePoNotifications } from "@/lib/notifications";
import { getDefaultWarehouseId } from "@/lib/warehouses";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/purchase-orders/:id — drive the status machine.
// action: "order" (DRAFT→ORDERED), "receive" (ORDERED→RECEIVED, increments
// stock + writes IN movements atomically at the destination warehouse,
// creating lots for perishable lines), "cancel" (DRAFT/ORDERED→CANCELLED).
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requirePermission("po.transition");
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: { include: { product: true } }, supplier: true },
  });
  if (!po) return NextResponse.json({ error: "Purchase order not found." }, { status: 404 });

  if (action === "order") {
    if (po.status !== "DRAFT") return NextResponse.json({ error: "Only a draft can be marked as ordered." }, { status: 409 });
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: "ORDERED",
          orderedAt: new Date(),
          expectedAt: new Date(Date.now() + po.supplier.leadTimeDays * 86_400_000),
        },
      });
      await audit(tx, session.user, {
        action: "po.order",
        entityType: "PurchaseOrder",
        entityId: id,
        summary: `Marked ${po.number} as ordered (${po.items.length} lines, expected in ${po.supplier.leadTimeDays}d)`,
      });
      return u;
    });
    return NextResponse.json(updated);
  }

  if (action === "receive") {
    if (po.status !== "ORDERED") return NextResponse.json({ error: "Only an ordered PO can be received." }, { status: 409 });
    const warehouseId =
      typeof body.warehouseId === "string" && body.warehouseId ? body.warehouseId : await getDefaultWarehouseId();
    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId }, select: { id: true, code: true } });
    if (!warehouse) return NextResponse.json({ error: "Destination warehouse not found." }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const receivedAt = new Date();
      let totalUnits = 0;
      // Each line locks its (product, warehouse) level, increments stock, and
      // writes an IN movement with the new per-warehouse balance.
      for (const item of po.items) {
        await tx.stockLevel.upsert({
          where: { productId_warehouseId: { productId: item.productId, warehouseId } },
          create: { productId: item.productId, warehouseId, quantity: 0 },
          update: {},
        });
        const rows = await tx.$queryRaw<{ id: string; quantity: number }[]>`
          SELECT id, quantity FROM "StockLevel"
          WHERE "productId" = ${item.productId} AND "warehouseId" = ${warehouseId} FOR UPDATE`;
        const level = rows[0];
        const balance = level.quantity + item.quantity;

        // Perishable lines land as a lot so FEFO has something to pick.
        let lotId: string | null = null;
        if (item.product.isPerishable && item.product.shelfLifeDays) {
          const lotCount = await tx.lot.count({ where: { productId: item.productId, warehouseId } });
          const yymm = `${String(receivedAt.getUTCFullYear()).slice(2)}${String(receivedAt.getUTCMonth() + 1).padStart(2, "0")}`;
          const lot = await tx.lot.create({
            data: {
              productId: item.productId,
              warehouseId,
              lotCode: `LOT-${yymm}-${String(lotCount + 1).padStart(3, "0")}`,
              expiryDate: new Date(receivedAt.getTime() + item.product.shelfLifeDays * 86_400_000),
              receivedAt,
              qtyReceived: item.quantity,
              qtyRemaining: item.quantity,
            },
          });
          lotId = lot.id;
        }

        await tx.stockLevel.update({ where: { id: level.id }, data: { quantity: balance } });
        const p = await tx.product.update({
          where: { id: item.productId },
          data: { quantity: { increment: item.quantity } },
          select: { quantity: true },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            warehouseId,
            type: "IN",
            quantity: item.quantity,
            balance,
            reason: "PO received",
            reference: po.number,
            lotId,
            createdById: session.user.id,
          },
        });
        // INs only ever resolve low/stockout alerts.
        await emitStockLevel(tx, item.product, p.quantity - item.quantity, p.quantity);
        totalUnits += item.quantity;
      }

      const u = await tx.purchaseOrder.update({ where: { id }, data: { status: "RECEIVED", receivedAt } });
      await emitPoReceived(tx, po, po.items.length, totalUnits);
      await audit(tx, session.user, {
        action: "po.receive",
        entityType: "PurchaseOrder",
        entityId: id,
        summary: `Received ${po.number} into ${warehouse.code} (${po.items.length} lines, +${totalUnits} units)`,
      });
      return u;
    });
    return NextResponse.json(updated);
  }

  if (action === "cancel") {
    if (po.status !== "DRAFT" && po.status !== "ORDERED") {
      return NextResponse.json({ error: "Only a draft or ordered PO can be cancelled." }, { status: 409 });
    }
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.purchaseOrder.update({ where: { id }, data: { status: "CANCELLED" } });
      await resolvePoNotifications(tx, id);
      await audit(tx, session.user, {
        action: "po.cancel",
        entityType: "PurchaseOrder",
        entityId: id,
        summary: `Cancelled ${po.number}`,
      });
      return u;
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
