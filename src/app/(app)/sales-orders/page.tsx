import { getSession } from "@/lib/session";
import { SoView } from "@/components/sales-orders/SoView";
import { getProducts } from "@/lib/inventory";
import { getCustomers, getSalesOrders } from "@/lib/sales";
import { getWarehouses } from "@/lib/warehouses";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function SalesOrdersPage() {
  const [session, sos, products, customers, warehouses] = await Promise.all([
    getSession(),
    getSalesOrders(),
    getProducts(),
    getCustomers(),
    getWarehouses(),
  ]);

  return (
    <SoView
      sos={sos}
      products={products}
      customers={customers}
      warehouses={warehouses}
      canTransition={can(session?.user.role, "so.transition")}
    />
  );
}
