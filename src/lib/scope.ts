import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import type { Prisma } from "@prisma/client";
import type { Role } from "@/lib/types";

// Returns a Prisma where clause restricting leads to what the user can see.
// If the user has lead.viewAll, no restriction. Otherwise: only leads they own.
// Merge the result with any other lead filters (it returns {} when unrestricted).
export async function leadScopeWhere(
  role: Role,
  userId: string,
): Promise<Prisma.LeadWhereInput> {
  if (await can(role, "lead.viewAll")) return {};
  return { assignedToId: userId };
}

// ICPs the user can see. If icp.viewAll: no restriction. Otherwise: ICPs they
// have any active lead assigned in, OR are the default assignee for.
export async function icpScopeWhere(
  role: Role,
  userId: string,
): Promise<Prisma.IcpWhereInput> {
  if (await can(role, "icp.viewAll")) return {};
  const ownedIcpRows = await prisma.lead.findMany({
    where: { assignedToId: userId, status: "ACTIVE" },
    select: { icpId: true },
    distinct: ["icpId"],
  });
  const ids = ownedIcpRows.map((r) => r.icpId);
  return {
    OR: [{ id: { in: ids } }, { defaultAssigneeId: userId }],
  };
}

// True if the user can read this specific lead.
export async function canViewLead(
  role: Role,
  userId: string,
  lead: { assignedToId: string | null },
): Promise<boolean> {
  if (await can(role, "lead.viewAll")) return true;
  return lead.assignedToId === userId;
}

// True if the user can read this specific ICP.
export async function canViewIcp(
  role: Role,
  userId: string,
  icp: { id: string; defaultAssigneeId: string | null },
): Promise<boolean> {
  if (await can(role, "icp.viewAll")) return true;
  if (icp.defaultAssigneeId === userId) return true;
  const owns = await prisma.lead.findFirst({
    where: { icpId: icp.id, assignedToId: userId, status: "ACTIVE" },
    select: { id: true },
  });
  return !!owns;
}
