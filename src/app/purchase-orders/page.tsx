import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Shell } from "@/components/Shell";
import { PoView } from "@/components/purchase-orders/PoView";
import { getPurchaseOrders, getProducts, getSuppliers } from "@/lib/inventory";

export const dynamic = "force-dynamic";

export default async function PurchaseOrdersPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [pos, products, suppliers] = await Promise.all([getPurchaseOrders(), getProducts(), getSuppliers()]);

  return (
    <Shell user={session.user ?? {}}>
      <PoView pos={pos} products={products} suppliers={suppliers} />
    </Shell>
  );
}
