import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getProducts } from "@/lib/inventory";
import { LabelSheetView } from "@/components/inventory/LabelSheetView";

export const dynamic = "force-dynamic";

// Printable barcode label sheet — outside the app shell (chrome hidden when
// printing via print CSS).
export default async function LabelsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const products = await getProducts();
  return <LabelSheetView products={products} />;
}
