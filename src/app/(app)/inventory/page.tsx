import { getSession } from "@/lib/session";
import { InventoryView } from "@/components/inventory/InventoryView";
import { getProducts, getSuppliers } from "@/lib/inventory";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const [session, products, suppliers] = await Promise.all([getSession(), getProducts(), getSuppliers()]);

  return (
    <InventoryView
      products={products}
      suppliers={suppliers}
      canEdit={can(session?.user.role, "product.edit")}
      canDelete={can(session?.user.role, "product.delete")}
    />
  );
}
