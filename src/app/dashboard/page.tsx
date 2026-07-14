import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/Shell";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { getProducts, getMovements, getWeeklyFlows } from "@/lib/inventory";

// Always render per-request so the numbers reflect the live ledger.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [products, movements, flows, openPos] = await Promise.all([
    getProducts(),
    getMovements(9),
    getWeeklyFlows(),
    prisma.purchaseOrder.findMany({
      where: { status: { in: ["DRAFT", "ORDERED"] } },
      include: { items: true },
    }),
  ]);

  const openPoValue = openPos.reduce((s, po) => s + po.items.reduce((x, i) => x + i.quantity * i.unitCost, 0), 0);

  return (
    <Shell user={session.user ?? {}}>
      <DashboardView
        products={products}
        flows={flows}
        recentMovements={movements}
        openPoValue={openPoValue}
        openPoCount={openPos.length}
      />
    </Shell>
  );
}
