import { getSession } from "@/lib/session";
import { MovementsView } from "@/components/movements/MovementsView";
import { getMovements, getProducts, getLots } from "@/lib/inventory";
import { getWarehouses } from "@/lib/warehouses";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function MovementsPage() {
  const [session, movements, products, warehouses, lots] = await Promise.all([
    getSession(),
    getMovements(400),
    getProducts(),
    getWarehouses(),
    getLots(),
  ]);

  return (
    <MovementsView
      movements={movements}
      products={products}
      warehouses={warehouses}
      lots={lots}
      canRecord={can(session?.user.role, "movement.create")}
    />
  );
}
