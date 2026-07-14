import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Shell } from "@/components/Shell";
import { InventoryView } from "@/components/inventory/InventoryView";
import { getProducts, getSuppliers } from "@/lib/inventory";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [products, suppliers] = await Promise.all([getProducts(), getSuppliers()]);

  return (
    <Shell user={session.user ?? {}}>
      <InventoryView products={products} suppliers={suppliers} />
    </Shell>
  );
}
