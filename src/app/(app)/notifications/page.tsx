import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/json";
import { relativeTime } from "@/lib/utils";
import Link from "next/link";
import { markAllRead } from "./actions";
import { Check } from "lucide-react";

export default async function NotificationsPage() {
  const session = await auth();
  const items = await prisma.notification.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const unread = items.filter((i) => !i.isRead).length;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted">
            {unread === 0 ? "All caught up." : `${unread} unread of ${items.length}.`}
          </p>
        </div>
        {unread > 0 && (
          <form action={markAllRead}>
            <button className="btn-secondary btn-sm">
              <Check className="size-3" /> Mark all read
            </button>
          </form>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">
          No notifications yet. They'll show up here as your team works the platform.
        </div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {items.map((n) => {
            const p = parseJson<{ href?: string; text?: string; event?: string }>(n.payload, {});
            const Inner = (
              <div className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50">
                <span
                  className={`size-2 rounded-full mt-2 shrink-0 ${
                    n.isRead ? "bg-slate-300" : "bg-brand"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className={`${n.isRead ? "text-muted" : "font-medium"} text-sm`}>
                    {p.text ?? n.type}
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {n.type.toLowerCase().replace(/_/g, " ")} · {relativeTime(n.createdAt)}
                  </div>
                </div>
              </div>
            );
            return p.href ? (
              <Link key={n.id} href={p.href}>{Inner}</Link>
            ) : (
              <div key={n.id}>{Inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
