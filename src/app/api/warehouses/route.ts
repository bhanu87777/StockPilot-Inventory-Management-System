import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";

// POST /api/warehouses — create a warehouse.
export async function POST(req: Request) {
  const auth = await requirePermission("warehouse.create");
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const city = typeof body.city === "string" && body.city.trim() ? body.city.trim() : null;

  if (!code || !name) {
    return NextResponse.json({ error: "Code and name are required." }, { status: 400 });
  }
  if (!/^[A-Z0-9-]{2,10}$/.test(code)) {
    return NextResponse.json({ error: "Code must be 2–10 letters/digits (e.g. EAST)." }, { status: 400 });
  }

  const dup = await prisma.warehouse.findUnique({ where: { code } });
  if (dup) return NextResponse.json({ error: `Warehouse code ${code} already exists.` }, { status: 409 });

  const warehouse = await prisma.$transaction(async (tx) => {
    const w = await tx.warehouse.create({ data: { code, name, city } });
    await audit(tx, session.user, {
      action: "warehouse.create",
      entityType: "Warehouse",
      entityId: w.id,
      summary: `Created warehouse ${code} — ${name}`,
    });
    return w;
  });

  return NextResponse.json(warehouse, { status: 201 });
}
