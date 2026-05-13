import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/json";
import NotificationsForm from "./NotificationsForm";

export default async function NotificationsPage() {
  const session = await auth();
  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { notifPrefs: true },
  });
  const prefs = parseJson<Record<string, boolean>>(user?.notifPrefs ?? "{}", {});

  return (
    <div className="card p-5 space-y-4">
      <div>
        <h2 className="font-semibold">Notification preferences</h2>
        <p className="text-xs text-muted">
          Toggle which events you receive in-app and via email. Email delivery isn't wired up
          yet — these preferences are stored on your user.
        </p>
      </div>
      <NotificationsForm initial={prefs} />
    </div>
  );
}
