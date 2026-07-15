import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Shell } from "@/components/Shell";
import { GlobalUi } from "@/components/GlobalUi";

// Every authed page lives in this route group: one session check, one Shell.
// The sidebar persists across navigations, per-route loading.tsx skeletons
// render inside it, and the command palette + shortcuts mount exactly once.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <Shell user={session.user}>
      {children}
      <GlobalUi role={session.user.role} />
    </Shell>
  );
}
