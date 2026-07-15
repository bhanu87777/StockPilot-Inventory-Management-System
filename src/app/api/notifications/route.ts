import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { getNotifications } from "@/lib/notifications";

// GET /api/notifications — the feed + unread count for the bell. Fetching
// also runs the lazy PO-overdue / lot-expiring sweeps (no cron on Vercel).
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const data = await getNotifications(auth.session.user.id);
  return NextResponse.json(data);
}
