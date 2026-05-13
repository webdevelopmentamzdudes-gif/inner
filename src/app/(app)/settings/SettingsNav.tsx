"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

const items = [
  { href: "/settings/profile", label: "Profile", roles: ["ADMIN", "MANAGER", "REP", "VIEWER"] as Role[] },
  { href: "/settings/password", label: "Password", roles: ["ADMIN", "MANAGER", "REP", "VIEWER"] as Role[] },
  { href: "/settings/notifications", label: "Notifications", roles: ["ADMIN", "MANAGER", "REP", "VIEWER"] as Role[] },
  { href: "/settings/users", label: "Users", roles: ["ADMIN"] as Role[] },
  { href: "/settings/permissions", label: "Permissions", roles: ["ADMIN"] as Role[] },
];

export default function SettingsNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const visible = items.filter((i) => i.roles.includes(role));
  return (
    <nav className="space-y-1">
      {visible.map((i) => {
        const active = pathname === i.href || pathname.startsWith(`${i.href}/`);
        return (
          <Link
            key={i.href}
            href={i.href}
            className={cn(
              "block rounded-md px-3 py-2 text-sm",
              active
                ? "bg-brand text-white"
                : "text-brand-navy hover:bg-slate-100",
            )}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
