import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";

// POST /api/transfers — move stock between warehouses as a paired
// TRANSFER_OUT / TRANSFER_IN sharing a TR-YYYY-XXXX reference. The ledger is
// the audit surface (no separate Transfer model) and the product total is
// conserved. Optionally carries a lot: the source lot is drawn down and a
// matching lot (same code/expiry) is upserted at the destination.
export async function POST(req: Request) {
  const auth = await requirePermission("transfer.create");
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));
  const productId = typeof body.productId === "string" ? body.productId : "";
  const fromWarehouseId = typeof body.fromWarehouseId === "string" ? body.fromWarehouseId : "";
  const toWarehouseId = typeof body.toWarehouseId === "string" ? body.toWarehouseId : "";
  const lotId = typeof body.lotId === "string" && body.lotId ? body.lotId : null;
  const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : "Warehouse transfer";
  const qty = Math.floor(Number(body.quantity));

  if (!productId || !fromWarehouseId || !toWarehouseId) {
    return NextResponse.json({ error: "Product, source, and destination are required." }, { status: 400 });
  }
  if (fromWarehouseId === toWarehouseId) {
    return NextResponse.json({ error: "Source and destination must be different warehouses." }, { status: 400 });
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    return NextResponse.json({ error: "Quantity must be a positive whole number." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { id: true, sku: true, name: true },
      });
      if (!product) throw new Error("NOT_FOUND_PRODUCT");
      const warehouses = await tx.warehouse.findMany({
        where: { id: { in: [fromWarehouseId, toWarehouseId] } },
        select: { id: true, code: true },
      });
      if (warehouses.length !== 2) throw new Error("NOT_FOUND_WAREHOUSE");
      const from = warehouses.find((w) => w.id === fromWarehouseId)!;
      const to = warehouses.find((w) => w.id === toWarehouseId)!;

      // Materialize both level rows, then lock them in a deterministic order
      // (warehouseId ascending) so concurrent opposite transfers can't deadlock.
      for (const wid of [fromWarehouseId, toWarehouseId]) {
        await tx.stockLevel.upsert({
          where: { productId_warehouseId: { productId, warehouseId: wid } },
          create: { productId, warehouseId: wid, quantity: 0 },
          update: {},
        });
      }
      const locked = await tx.$queryRaw<{ id: string; warehouseId: string; quantity: number }[]>`
        SELECT id, "warehouseId", quantity FROM "StockLevel"
        WHERE "productId" = ${productId} AND "warehouseId" IN (${fromWarehouseId}, ${toWarehouseId})
        ORDER BY "warehouseId" ASC
        FOR UPDATE`;
      const src = locked.find((l) => l.warehouseId === fromWarehouseId)!;
      const dst = locked.find((l) => l.warehouseId === toWarehouseId)!;

      if (src.quantity < qty) throw new Error(`INSUFFICIENT:${src.quantity}`);
      const srcBalance = src.quantity - qty;
      const dstBalance = dst.quantity + qty;

      // Lot carry-over (optional).
      let dstLotId: string | null = null;
      if (lotId) {
        const res = await tx.lot.updateMany({
          where: { id: lotId, productId, warehouseId: fromWarehouseId, qtyRemaining: { gte: qty } },
          data: { qtyRemaining: { decrement: qty } },
        });
        if (res.count === 0) {
          const lot = await tx.lot.findUnique({ where: { id: lotId }, select: { qtyRemaining: true } });
          throw new Error(`LOT_INSUFFICIENT:${lot?.qtyRemaining ?? 0}`);
        }
        const srcLot = await tx.lot.findUnique({ where: { id: lotId } });
        if (srcLot) {
          const dstLot = await tx.lot.upsert({
            where: {
              productId_warehouseId_lotCode: { productId, warehouseId: toWarehouseId, lotCode: srcLot.lotCode },
            },
            create: {
              productId,
              warehouseId: toWarehouseId,
              lotCode: srcLot.lotCode,
              expiryDate: srcLot.expiryDate,
              receivedAt: srcLot.receivedAt,
              qtyReceived: qty,
              qtyRemaining: qty,
            },
            update: { qtyReceived: { increment: qty }, qtyRemaining: { increment: qty } },
          });
          dstLotId = dstLot.id;
        }
      }

      // TR number mirrors the PO numbering style.
      const year = new Date().getFullYear();
      const prefix = `TR-${year}-`;
      const last = await tx.stockMovement.findFirst({
        where: { reference: { startsWith: prefix } },
        orderBy: { reference: "desc" },
        select: { reference: true },
      });
      const seq = last?.reference ? parseInt(last.reference.slice(prefix.length), 10) + 1 : 1;
      const trNumber = `${prefix}${String(seq).padStart(4, "0")}`;

      await tx.stockLevel.update({ where: { id: src.id }, data: { quantity: srcBalance } });
      await tx.stockLevel.update({ where: { id: dst.id }, data: { quantity: dstBalance } });
      // Product.quantity untouched — the total is conserved.

      const outMove = await tx.stockMovement.create({
        data: {
          productId,
          warehouseId: fromWarehouseId,
          type: "TRANSFER_OUT",
          quantity: qty,
          balance: srcBalance,
          reason,
          reference: trNumber,
          lotId,
          createdById: session.user.id,
        },
      });
      const inMove = await tx.stockMovement.create({
        data: {
          productId,
          warehouseId: toWarehouseId,
          type: "TRANSFER_IN",
          quantity: qty,
          balance: dstBalance,
          reason,
          reference: trNumber,
          lotId: dstLotId,
          createdById: session.user.id,
        },
      });

      await audit(tx, session.user, {
        action: "transfer.create",
        entityType: "StockMovement",
        entityId: outMove.id,
        summary: `Transferred ${qty} × ${product.sku} ${from.code} → ${to.code} (${trNumber})`,
      });

      return { reference: trNumber, out: outMove, in: inMove };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NOT_FOUND_PRODUCT") return NextResponse.json({ error: "Product not found." }, { status: 404 });
    if (msg === "NOT_FOUND_WAREHOUSE") return NextResponse.json({ error: "Warehouse not found." }, { status: 404 });
    if (msg.startsWith("LOT_INSUFFICIENT:")) {
      return NextResponse.json({ error: `Lot only has ${msg.split(":")[1]} remaining at the source.` }, { status: 409 });
    }
    if (msg.startsWith("INSUFFICIENT:")) {
      return NextResponse.json(
        { error: `Insufficient stock — only ${msg.split(":")[1]} at the source warehouse.` },
        { status: 409 }
      );
    }
    throw e;
  }
}
