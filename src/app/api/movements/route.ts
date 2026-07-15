import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { emitStockLevel } from "@/lib/notifications";
import { getDefaultWarehouseId } from "@/lib/warehouses";
import type { MovementType } from "@prisma/client";

// POST /api/movements — record IN / OUT / ADJUST at a warehouse. The
// (product, warehouse) stock level is locked inside the transaction, stock
// can never go negative, and the movement snapshots the resulting
// per-warehouse balance. Optional lot handling: an OUT can draw down a lot,
// an IN on a perishable SKU can create one. Transfers have their own route.
export async function POST(req: Request) {
  const auth = await requirePermission("movement.create");
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));
  const productId = typeof body.productId === "string" ? body.productId : "";
  const type = body.type as MovementType;
  const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : null;
  const reference = typeof body.reference === "string" && body.reference.trim() ? body.reference.trim() : null;
  const lotId = typeof body.lotId === "string" && body.lotId ? body.lotId : null;
  const newLotCode = typeof body.lotCode === "string" && body.lotCode.trim() ? body.lotCode.trim().toUpperCase() : null;
  const newLotExpiry = typeof body.expiryDate === "string" && body.expiryDate ? new Date(body.expiryDate) : null;
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
  if (newLotExpiry && isNaN(newLotExpiry.getTime())) {
    return NextResponse.json({ error: "Lot expiry date is invalid." }, { status: 400 });
  }

  const warehouseId =
    typeof body.warehouseId === "string" && body.warehouseId ? body.warehouseId : await getDefaultWarehouseId();

  try {
    const movement = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true, sku: true, reorderPoint: true, isPerishable: true, shelfLifeDays: true },
      });
      if (!product) throw new Error("NOT_FOUND_PRODUCT");
      const warehouse = await tx.warehouse.findUnique({ where: { id: warehouseId }, select: { id: true, code: true } });
      if (!warehouse) throw new Error("NOT_FOUND_WAREHOUSE");

      // Materialize the per-warehouse level row, then lock it — all writers
      // to this (product, warehouse) serialize here.
      await tx.stockLevel.upsert({
        where: { productId_warehouseId: { productId, warehouseId } },
        create: { productId, warehouseId, quantity: 0 },
        update: {},
      });
      const rows = await tx.$queryRaw<{ id: string; quantity: number }[]>`
        SELECT id, quantity FROM "StockLevel"
        WHERE "productId" = ${productId} AND "warehouseId" = ${warehouseId} FOR UPDATE`;
      const level = rows[0];

      const delta = type === "IN" ? rawQty : type === "OUT" ? -rawQty : rawQty;
      const balance = level.quantity + delta;
      if (balance < 0) throw new Error(`INSUFFICIENT:${level.quantity}`);

      // Lot bookkeeping (advisory layer under the level; movement records the
      // lot for the audit trail).
      let movementLotId: string | null = null;
      if (type === "OUT" && lotId) {
        const res = await tx.lot.updateMany({
          where: { id: lotId, productId, warehouseId, qtyRemaining: { gte: rawQty } },
          data: { qtyRemaining: { decrement: rawQty } },
        });
        if (res.count === 0) {
          const lot = await tx.lot.findUnique({ where: { id: lotId }, select: { qtyRemaining: true } });
          throw new Error(`LOT_INSUFFICIENT:${lot?.qtyRemaining ?? 0}`);
        }
        movementLotId = lotId;
      } else if (type === "IN" && (newLotCode || (product.isPerishable && product.shelfLifeDays))) {
        const expiry =
          newLotExpiry ??
          (product.shelfLifeDays ? new Date(Date.now() + product.shelfLifeDays * 86_400_000) : null);
        if (expiry) {
          const now = new Date();
          const code =
            newLotCode ??
            `LOT-${String(now.getUTCFullYear()).slice(2)}${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(
              Math.floor(Math.random() * 900) + 100
            )}`;
          const lot = await tx.lot.upsert({
            where: { productId_warehouseId_lotCode: { productId, warehouseId, lotCode: code } },
            create: {
              productId,
              warehouseId,
              lotCode: code,
              expiryDate: expiry,
              qtyReceived: rawQty,
              qtyRemaining: rawQty,
            },
            update: { qtyReceived: { increment: rawQty }, qtyRemaining: { increment: rawQty } },
          });
          movementLotId = lot.id;
        }
      }

      await tx.stockLevel.update({ where: { id: level.id }, data: { quantity: balance } });
      // Atomic row-level increment keeps the denormalized total consistent
      // without taking a second lock.
      const updated = await tx.product.update({
        where: { id: productId },
        data: { quantity: { increment: delta } },
        select: { quantity: true },
      });
      const prevTotal = updated.quantity - delta;

      const created = await tx.stockMovement.create({
        data: {
          productId,
          warehouseId,
          type,
          quantity: rawQty,
          balance,
          reason,
          reference,
          lotId: movementLotId,
          createdById: session.user.id,
        },
        include: { product: { select: { name: true, sku: true } }, warehouse: { select: { code: true } } },
      });

      await audit(tx, session.user, {
        action: "movement.create",
        entityType: "StockMovement",
        entityId: created.id,
        summary: `${type} ${Math.abs(rawQty)} × ${product.sku} @ ${warehouse.code} — ${reason}`,
      });
      await emitStockLevel(tx, product, prevTotal, updated.quantity);

      return created;
    });
    return NextResponse.json(movement, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NOT_FOUND_PRODUCT") return NextResponse.json({ error: "Product not found." }, { status: 404 });
    if (msg === "NOT_FOUND_WAREHOUSE") return NextResponse.json({ error: "Warehouse not found." }, { status: 404 });
    if (msg.startsWith("LOT_INSUFFICIENT:")) {
      return NextResponse.json(
        { error: `Lot only has ${msg.split(":")[1]} remaining — split across lots or record without a lot.` },
        { status: 409 }
      );
    }
    if (msg.startsWith("INSUFFICIENT:")) {
      return NextResponse.json(
        { error: `Insufficient stock — only ${msg.split(":")[1]} on hand at this warehouse.` },
        { status: 409 }
      );
    }
    throw e;
  }
}
