import { getSession } from "@/lib/session";
import { CustomersView } from "@/components/customers/CustomersView";
import { getCustomers } from "@/lib/sales";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const [session, customers] = await Promise.all([getSession(), getCustomers()]);

  return <CustomersView customers={customers} canCreate={can(session?.user.role, "customer.create")} />;
}
