import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { UsersView } from "@/components/settings/UsersView";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await getSession();
  if (!can(session?.user.role, "user.manage")) redirect("/dashboard");

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <UsersView
      users={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
      selfId={session!.user.id}
    />
  );
}
