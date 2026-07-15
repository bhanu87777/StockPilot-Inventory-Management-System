import { getSession } from "@/lib/session";
import { WarehousesView } from "@/components/warehouses/WarehousesView";
import { getProducts, getLots } from "@/lib/inventory";
import { getWarehouses } from "@/lib/warehouses";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function WarehousesPage() {
  const [session, warehouses, products, lots] = await Promise.all([
    getSession(),
    getWarehouses(),
    getProducts(),
    getLots(),
  ]);

  return (
    <WarehousesView
      warehouses={warehouses}
      products={products}
      lots={lots}
      canTransfer={can(session?.user.role, "transfer.create")}
      canCreate={can(session?.user.role, "warehouse.create")}
    />
  );
}
