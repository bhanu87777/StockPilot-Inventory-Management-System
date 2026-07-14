import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Shell } from "@/components/Shell";
import { getLatestRun } from "@/lib/advisor";
import { AdvisorView, type AdvisorRunView } from "@/components/advisor/AdvisorView";

export const dynamic = "force-dynamic";

export default async function AdvisorPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const latest = await getLatestRun();
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

  return (
    <Shell user={session.user ?? {}}>
      <AdvisorView run={run} />
    </Shell>
  );
}
