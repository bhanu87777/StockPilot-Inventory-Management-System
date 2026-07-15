import { getSession } from "@/lib/session";
import { getNotifications } from "@/lib/notifications";
import { NotificationsView } from "@/components/notifications/NotificationsView";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await getSession();
  const { notifications } = await getNotifications(session!.user.id, 100);

  return <NotificationsView notifications={notifications} />;
}
