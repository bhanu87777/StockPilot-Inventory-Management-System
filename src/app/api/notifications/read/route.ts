import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

// POST /api/notifications/read — mark notifications read for the current
// user. Body: { ids: string[] } or { all: true }.
export async function POST(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const userId = auth.session.user.id;

  const body = await req.json().catch(() => ({}));
  let ids: string[] = [];
  if (body.all === true) {
    const unread = await prisma.notification.findMany({
      where: { reads: { none: { userId } } },
      select: { id: true },
    });
    ids = unread.map((n) => n.id);
  } else if (Array.isArray(body.ids)) {
    ids = body.ids.filter((x: unknown): x is string => typeof x === "string");
  }
  if (ids.length === 0) return NextResponse.json({ marked: 0 });

  const res = await prisma.notificationRead.createMany({
    data: ids.map((notificationId) => ({ notificationId, userId })),
    skipDuplicates: true,
  });
  return NextResponse.json({ marked: res.count });
}
