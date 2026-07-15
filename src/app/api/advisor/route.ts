import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { generateAndSavePlan } from "@/lib/advisor";

// POST /api/advisor — run the reorder planner (Claude, or the heuristic
// fallback) over the whole catalog and persist the run.
export async function POST() {
  const auth = await requirePermission("advisor.run");
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const run = await generateAndSavePlan();
  await audit(prisma, session.user, {
    action: "advisor.run",
    entityType: "AdvisorRun",
    entityId: run.id,
    summary: `Ran the reorder advisor (${run.source}, ${run.suggestions.length} suggestions)`,
  });
  return NextResponse.json({ id: run.id, source: run.source, count: run.suggestions.length });
}
