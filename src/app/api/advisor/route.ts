import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { generateAndSavePlan } from "@/lib/advisor";

// POST /api/advisor — run the reorder planner (Claude, or the heuristic
// fallback) over the whole catalog and persist the run.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const run = await generateAndSavePlan();
  return NextResponse.json({ id: run.id, source: run.source, count: run.suggestions.length });
}
