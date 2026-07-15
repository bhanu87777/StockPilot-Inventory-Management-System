import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

const ROLES = ["ADMIN", "PURCHASING", "VIEWER"] as const;

// PATCH /api/users/:id — change a user's role (admin only). The last admin
// can never be demoted. Role changes apply at the target's next sign-in
// (role rides in the JWT).
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requirePermission("user.manage");
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const role = ROLES.includes(body.role) ? (body.role as (typeof ROLES)[number]) : null;
  if (!role) return NextResponse.json({ error: "A valid role is required." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (user.role === "ADMIN" && role !== "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return NextResponse.json({ error: "You can't demote the last admin." }, { status: 409 });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    await audit(tx, session.user, {
      action: "user.role_change",
      entityType: "User",
      entityId: id,
      summary: `Changed ${user.email} from ${user.role} to ${role}`,
      metadata: { from: user.role, to: role },
    });
    return u;
  });
  return NextResponse.json(updated);
}

// DELETE /api/users/:id — remove a user (admin only). Self-delete and
// deleting the last admin are blocked.
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requirePermission("user.manage");
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json({ error: "You can't delete your own account." }, { status: 409 });
  }
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (user.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return NextResponse.json({ error: "You can't delete the last admin." }, { status: 409 });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.delete({ where: { id } }); // movements keep history via SetNull
    await audit(tx, session.user, {
      action: "user.delete",
      entityType: "User",
      entityId: id,
      summary: `Deleted user ${user.email}`,
    });
  });
  return NextResponse.json({ ok: true });
}
