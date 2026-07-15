import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// POST /api/register — create an operator account.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

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

  // New signups are read-only until an admin promotes them; the schema's
  // ADMIN default exists only to backfill pre-RBAC rows.
  await prisma.user.create({
    data: { email, name: name || null, role: "VIEWER", password: await bcrypt.hash(password, 10) },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
