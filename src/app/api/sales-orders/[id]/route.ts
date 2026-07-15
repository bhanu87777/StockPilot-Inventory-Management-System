import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { emitSoFulfilled, emitStockLevel } from "@/lib/notifications";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/sales-orders/:id — drive the status machine.
// action: "confirm" (DRAFT→CONFIRMED), "fulfill" (CONFIRMED→FULFILLED —
// the mirror of PO receive: locks each (product, warehouse) level, rejects
// the whole order with 409 if any line can't be covered, auto-picks lots
// FEFO for perishables, writes OUT movements), "cancel".
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requirePermission("so.transition");
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  const so = await prisma.salesOrder.findUnique({
    where: { id },
    include: { items: { include: { product: true } }, customer: true, warehouse: true },
  });
  if (!so) return NextResponse.json({ error: "Sales order not found." }, { status: 404 });

  if (action === "confirm") {
    if (so.status !== "DRAFT") return NextResponse.json({ error: "Only a draft can be confirmed." }, { status: 409 });
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.salesOrder.update({
        where: { id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
      });
      await audit(tx, session.user, {
        action: "so.confirm",
        entityType: "SalesOrder",
        entityId: id,
        summary: `Confirmed ${so.number} for ${so.customer.name}`,
      });
      return u;
    });
    return NextResponse.json(updated);
  }

  if (action === "fulfill") {
    if (so.status !== "CONFIRMED") return NextResponse.json({ error: "Only a confirmed SO can be fulfilled." }, { status: 409 });
    try {
      const updated = await prisma.$transaction(async (tx) => {
        let totalUnits = 0;
        for (const item of so.items) {
          // Lock the level at the order's warehouse; all-or-nothing.
          await tx.stockLevel.upsert({
            where: { productId_warehouseId: { productId: item.productId, warehouseId: so.warehouseId } },
            create: { productId: item.productId, warehouseId: so.warehouseId, quantity: 0 },
            update: {},
          });
          const rows = await tx.$queryRaw<{ id: string; quantity: number }[]>`
            SELECT id, quantity FROM "StockLevel"
            WHERE "productId" = ${item.productId} AND "warehouseId" = ${so.warehouseId} FOR UPDATE`;
          const level = rows[0];
          if (level.quantity < item.quantity) {
            throw new Error(`SHORT:${item.product.sku}:${level.quantity}:${item.quantity}`);
          }

          // FEFO auto-pick for perishables: consume earliest-expiring lots
          // first, one OUT movement per slice; any remainder beyond lot
          // coverage becomes a final un-lotted OUT (lots are advisory).
          let remaining = item.quantity;
          let running = level.quantity;
          const slices: { lotId: string | null; qty: number }[] = [];
          if (item.product.isPerishable) {
            const lots = await tx.lot.findMany({
              where: { productId: item.productId, warehouseId: so.warehouseId, qtyRemaining: { gt: 0 } },
              orderBy: { expiryDate: "asc" },
            });
            for (const lot of lots) {
              if (remaining === 0) break;
              const take = Math.min(lot.qtyRemaining, remaining);
              await tx.lot.update({ where: { id: lot.id }, data: { qtyRemaining: { decrement: take } } });
              slices.push({ lotId: lot.id, qty: take });
              remaining -= take;
            }
          }
          if (remaining > 0) slices.push({ lotId: null, qty: remaining });

          for (const slice of slices) {
            running -= slice.qty;
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                warehouseId: so.warehouseId,
                type: "OUT",
                quantity: slice.qty,
                balance: running,
                reason: "SO fulfilled",
                reference: so.number,
                lotId: slice.lotId,
                createdById: session.user.id,
              },
            });
          }

          await tx.stockLevel.update({
            where: { id: level.id },
            data: { quantity: level.quantity - item.quantity },
          });
          const p = await tx.product.update({
            where: { id: item.productId },
            data: { quantity: { decrement: item.quantity } },
            select: { quantity: true },
          });
          await emitStockLevel(tx, item.product, p.quantity + item.quantity, p.quantity);
          totalUnits += item.quantity;
        }

        const u = await tx.salesOrder.update({
          where: { id },
          data: { status: "FULFILLED", fulfilledAt: new Date() },
        });
        await emitSoFulfilled(tx, so, so.customer.name, totalUnits);
        await audit(tx, session.user, {
          action: "so.fulfill",
          entityType: "SalesOrder",
          entityId: id,
          summary: `Fulfilled ${so.number} from ${so.warehouse.code} (${so.items.length} lines, −${totalUnits} units)`,
        });
        return u;
      });
      return NextResponse.json(updated);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.startsWith("SHORT:")) {
        const [, sku, have, want] = msg.split(":");
        return NextResponse.json(
          { error: `Cannot fulfill — only ${have} of ${sku} at ${so.warehouse.code} (order needs ${want}). Transfer stock in or cancel.` },
          { status: 409 }
        );
      }
      throw e;
    }
  }

  if (action === "cancel") {
    if (so.status !== "DRAFT" && so.status !== "CONFIRMED") {
      return NextResponse.json({ error: "Only a draft or confirmed SO can be cancelled." }, { status: 409 });
    }
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.salesOrder.update({ where: { id }, data: { status: "CANCELLED" } });
      await audit(tx, session.user, {
        action: "so.cancel",
        entityType: "SalesOrder",
        entityId: id,
        summary: `Cancelled ${so.number}`,
      });
      return u;
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
