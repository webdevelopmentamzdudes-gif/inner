import Link from "next/link";
import { Search, Plus } from "lucide-react";
import { signOut } from "@/auth";
import NotificationBell from "@/components/NotificationBell";

export default function TopNav({
  user,
}: {
  user: { name?: string | null; email?: string | null; role: string };
}) {
  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <header className="h-14 shrink-0 border-b border-slate-200 bg-white flex items-center px-4 gap-4">
      <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
        <span className="size-7 rounded bg-brand grid place-items-center text-white text-xs font-bold">
          LG
        </span>
        <span className="hidden md:inline">Lead Platform</span>
      </Link>

      <div className="flex-1 max-w-xl ml-6 hidden md:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
          <input
            placeholder="Search leads, companies, contacts…"
            className="input pl-9"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Link href="/leads/new" className="btn-primary">
          <Plus className="size-4" />
          Add Lead
        </Link>
        <NotificationBell />
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          <Link href="/settings/profile" className="text-right text-xs leading-tight hover:text-brand">
            <div className="font-medium">{user.name ?? user.email}</div>
            <div className="text-muted">{user.role.toLowerCase()}</div>
          </Link>
          <form action={logout}>
            <button className="btn-secondary btn-sm">Sign out</button>
          </form>
        </div>
      </div>
    </header>
  );
}
