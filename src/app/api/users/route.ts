import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";

const ROLES = ["ADMIN", "PURCHASING", "VIEWER"] as const;

// GET /api/users — list users (admin only).
export async function GET() {
  const auth = await requirePermission("user.manage");
  if (!auth.ok) return auth.response;

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(users);
}

// POST /api/users — create a user with a role (admin only).
export async function POST(req: Request) {
  const auth = await requirePermission("user.manage");
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = ROLES.includes(body.role) ? (body.role as (typeof ROLES)[number]) : "VIEWER";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { email, name: name || null, role, password: await bcrypt.hash(password, 10) },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    await audit(tx, session.user, {
      action: "user.create",
      entityType: "User",
      entityId: u.id,
      summary: `Created user ${email} as ${role}`,
    });
    return u;
  });
  return NextResponse.json(user, { status: 201 });
}
