import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import UsersClient from "./UsersClient";

export default async function UsersPage() {
  const session = await auth();
  if (!(await can(session!.user.role, "users.manage"))) redirect("/settings/profile");

  const users = await prisma.user.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  return (
    <UsersClient
      users={users.map((u) => ({
        ...u,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
      }))}
      currentUserId={session!.user.id}
    />
  );
}
