import { getValuationReport } from "@/lib/reports";
import { ReportsView } from "@/components/reports/ReportsView";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const valuation = await getValuationReport();
  return <ReportsView valuation={valuation} />;
}
