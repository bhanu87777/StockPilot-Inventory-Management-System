import { getSession } from "@/lib/session";
import { PoView } from "@/components/purchase-orders/PoView";
import { getPurchaseOrders, getProducts, getSuppliers } from "@/lib/inventory";
import { getWarehouses } from "@/lib/warehouses";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function PurchaseOrdersPage() {
  const [session, pos, products, suppliers, warehouses] = await Promise.all([
    getSession(),
    getPurchaseOrders(),
    getProducts(),
    getSuppliers(),
    getWarehouses(),
  ]);

  return (
    <PoView
      pos={pos}
      products={products}
      suppliers={suppliers}
      warehouses={warehouses}
      canTransition={can(session?.user.role, "po.transition")}
    />
  );
}
