import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";

// POST /api/customers — add a customer.
export async function POST(req: Request) {
  const auth = await requirePermission("customer.create");
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const country = typeof body.country === "string" ? body.country.trim() : "";

  if (!name || !country) {
    return NextResponse.json({ error: "Name and country are required." }, { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const customer = await prisma.$transaction(async (tx) => {
    const c = await tx.customer.create({ data: { name, email, country } });
    await audit(tx, session.user, {
      action: "customer.create",
      entityType: "Customer",
      entityId: c.id,
      summary: `Added customer ${name} (${country})`,
    });
    return c;
  });

  return NextResponse.json(customer, { status: 201 });
}
