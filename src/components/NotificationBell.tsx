import Link from "next/link";
import { Bell } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/json";
import { relativeTime } from "@/lib/utils";
import { markAllRead } from "@/app/(app)/notifications/actions";

export default async function NotificationBell() {
  const session = await auth();
  if (!session?.user) return null;

  const [unreadCount, recent] = await Promise.all([
    prisma.notification.count({
      where: { userId: session.user.id, isRead: false },
    }),
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return (
    <details className="relative">
      <summary
        className="btn-ghost relative cursor-pointer list-none"
        aria-label="Notifications"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 inline-flex items-center justify-center size-4 text-[10px] font-semibold rounded-full bg-danger text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </summary>
      <div className="absolute right-0 top-full mt-1 w-80 card shadow-lg z-50 overflow-hidden">
        <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <form action={markAllRead}>
              <button className="text-xs text-brand">Mark all read</button>
            </form>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
          {recent.length === 0 ? (
            <div className="p-5 text-sm text-muted text-center">No notifications yet.</div>
          ) : (
            recent.map((n) => {
              const p = parseJson<{ href?: string; text?: string }>(n.payload, {});
              const Inner = (
                <div className="px-4 py-2.5 hover:bg-slate-50 flex gap-2.5">
                  <span
                    className={`size-2 rounded-full mt-1.5 shrink-0 ${
                      n.isRead ? "bg-transparent" : "bg-brand"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs ${n.isRead ? "text-muted" : "font-medium"}`}>
                      {p.text ?? n.type}
                    </div>
                    <div className="text-[10px] text-muted mt-0.5">
                      {relativeTime(n.createdAt)}
                    </div>
                  </div>
                </div>
              );
              return p.href ? (
                <Link key={n.id} href={p.href}>{Inner}</Link>
              ) : (
                <div key={n.id}>{Inner}</div>
              );
            })
          )}
        </div>
        <Link
          href="/notifications"
          className="block text-center text-xs py-2 border-t border-slate-200 text-brand hover:bg-slate-50"
        >
          View all
        </Link>
      </div>
    </details>
  );
}
