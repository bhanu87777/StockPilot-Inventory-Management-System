import { prisma } from "@/lib/prisma";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { getProducts, getMovements, getWeeklyFlows, getExpiringLots } from "@/lib/inventory";
import { getSalesStats } from "@/lib/sales";

// Always render per-request so the numbers reflect the live ledger.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [products, movements, flows, openPos, expiringLots, salesStats] = await Promise.all([
    getProducts(),
    getMovements(9),
    getWeeklyFlows(),
    prisma.purchaseOrder.findMany({
      where: { status: { in: ["DRAFT", "ORDERED"] } },
      include: { items: true },
    }),
    getExpiringLots(30),
    getSalesStats(),
  ]);

  const openPoValue = openPos.reduce((s, po) => s + po.items.reduce((x, i) => x + i.quantity * i.unitCost, 0), 0);

  return (
    <DashboardView
      products={products}
      flows={flows}
      recentMovements={movements}
      openPoValue={openPoValue}
      openPoCount={openPos.length}
      expiringLots={expiringLots}
      salesStats={salesStats}
    />
  );
}
