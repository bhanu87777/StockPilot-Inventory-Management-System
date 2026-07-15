import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { can } from "@/lib/permissions";
import { getAuditLogs } from "@/lib/audit";
import { AuditView } from "@/components/audit/AuditView";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const session = await getSession();
  if (!can(session?.user.role, "audit.view")) redirect("/dashboard");

  const logs = await getAuditLogs(500);
  return <AuditView logs={logs} />;
}
