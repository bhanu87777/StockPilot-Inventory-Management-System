import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { validateProductInput, createProductWithOpeningBalance, type ProductInput } from "@/lib/products";
import { getDefaultWarehouseId } from "@/lib/warehouses";

// POST /api/products/import — bulk create from the CSV importer. The client
// pre-validates for UX; everything is re-validated here, and the whole batch
// commits in ONE transaction: any bad row rejects the lot (ledger ethos —
// nothing partial).
export async function POST(req: Request) {
  const auth = await requirePermission("product.create");
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));
  const rows: unknown = body.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows to import." }, { status: 400 });
  }
  if (rows.length > 500) {
    return NextResponse.json({ error: "Import is capped at 500 rows per batch." }, { status: 400 });
  }

  // Re-resolve suppliers by case-insensitive name.
  const suppliers = await prisma.supplier.findMany({ select: { id: true, name: true } });
  const supplierByName = new Map(suppliers.map((s) => [s.name.toLowerCase(), s.id]));

  const parsed: ProductInput[] = [];
  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i] as Record<string, unknown>;
    const supplierName = typeof raw.supplier === "string" ? raw.supplier.trim().toLowerCase() : "";
    const supplierId = supplierByName.get(supplierName);
    if (!supplierId) {
      return NextResponse.json({ error: `Row ${i + 1}: unknown supplier "${raw.supplier}".`, row: i }, { status: 400 });
    }
    const check = validateProductInput({ ...raw, supplierId });
    if (!check.ok) {
      return NextResponse.json({ error: `Row ${i + 1}: ${check.error}`, row: i }, { status: 400 });
    }
    parsed.push(check.data);
  }

  // SKU uniqueness — within the file and against the catalog.
  const skus = parsed.map((p) => p.sku);
  if (new Set(skus).size !== skus.length) {
    return NextResponse.json({ error: "The file contains duplicate SKUs." }, { status: 400 });
  }
  const existing = await prisma.product.findMany({ where: { sku: { in: skus } }, select: { sku: true } });
  if (existing.length > 0) {
    return NextResponse.json(
      { error: `These SKUs already exist: ${existing.map((e) => e.sku).join(", ")}.` },
      { status: 409 }
    );
  }

  const warehouseId = await getDefaultWarehouseId();
  const created = await prisma.$transaction(async (tx) => {
    let n = 0;
    for (const data of parsed) {
      await createProductWithOpeningBalance(tx, data, warehouseId, session.user.id);
      n++;
    }
    await audit(tx, session.user, {
      action: "product.import",
      entityType: "Product",
      summary: `Imported ${n} products from CSV`,
      metadata: { count: n },
    });
    return n;
  });

  return NextResponse.json({ created }, { status: 201 });
}
