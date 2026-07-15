import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { searchEntities } from "@/lib/search";

// GET /api/search?q= — entity search for the command palette.
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ hits: [] });

  const hits = await searchEntities(q.slice(0, 60));
  return NextResponse.json({ hits });
}
