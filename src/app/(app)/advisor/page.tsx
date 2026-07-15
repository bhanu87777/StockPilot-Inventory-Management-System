import { getSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getLatestRun } from "@/lib/advisor";
import { AdvisorView, type AdvisorRunView } from "@/components/advisor/AdvisorView";

export const dynamic = "force-dynamic";

export default async function AdvisorPage() {
  const [session, latest] = await Promise.all([getSession(), getLatestRun()]);
  const run: AdvisorRunView = latest
    ? {
        id: latest.id,
        summary: latest.summary,
        source: latest.source,
        createdAt: latest.createdAt.toISOString(),
        suggestions: latest.suggestions.map((s) => ({
          id: s.id,
          productName: s.productName,
          sku: s.sku,
          urgency: s.urgency,
          suggestedQty: s.suggestedQty,
          daysOfCover: s.daysOfCover,
          rationale: s.rationale,
        })),
      }
    : null;

  return <AdvisorView run={run} canRun={can(session?.user.role, "advisor.run")} />;
}
