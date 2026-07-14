import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Shell } from "@/components/Shell";
import { MovementsView } from "@/components/movements/MovementsView";
import { getMovements, getProducts } from "@/lib/inventory";

export const dynamic = "force-dynamic";

export default async function MovementsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [movements, products] = await Promise.all([getMovements(400), getProducts()]);

  return (
    <Shell user={session.user ?? {}}>
      <MovementsView movements={movements} products={products} />
    </Shell>
  );
}
