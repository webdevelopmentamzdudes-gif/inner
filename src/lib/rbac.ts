import { cache } from "react";
import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/json";
import type { Role } from "@/lib/types";

// All grantable capabilities. Each one is checked via can(role, cap).
// Capabilities split into two flavors:
//   - Action capabilities (e.g. icp.manage, lead.editAny) — gate mutating actions
//   - View capabilities (lead.viewAll, icp.viewAll) — gate data scope. When OFF,
//     scope filters in lib/scope.ts narrow the user to their own data.
export const CAPABILITIES = [
  // Lead view scope
  "lead.viewAll",
  // Lead actions
  "lead.editAny",
  "lead.deleteAny",
  "lead.bulkDelete",
  "lead.reassignAny",
  // ICP view scope
  "icp.viewAll",
  // ICP actions
  "icp.manage",
  "icp.delete",
  // User mgmt
  "users.manage",
  "users.changeRole",
  // System
  "trash.hardDelete",
  "system.configure",
  // Bulk ops
  "import.run",
  "export.run",
  // Reporting
  "view.allDashboards",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

// Default matches PRD §15. Admin can override via /settings/permissions.
export const DEFAULT_PERMISSIONS: Record<Role, Capability[]> = {
  ADMIN: [...CAPABILITIES],
  MANAGER: [
    "lead.viewAll",
    "lead.editAny",
    "lead.deleteAny",
    "lead.bulkDelete",
    "lead.reassignAny",
    "icp.viewAll",
    "icp.manage",
    "import.run",
    "export.run",
    "view.allDashboards",
  ],
  REP: [
    // Reps see everything by default per PRD §15. Admin can switch this off
    // in /settings/permissions to restrict them to their own assigned leads.
    "lead.viewAll",
    "icp.viewAll",
    "import.run",
    "export.run",
    "view.allDashboards",
  ],
  VIEWER: ["lead.viewAll", "icp.viewAll", "export.run", "view.allDashboards"],
};

export type PermissionMatrix = Record<Role, Capability[]>;

// Some operations always require ADMIN regardless of toggles, to avoid lock-out.
const ADMIN_ONLY: Capability[] = ["users.manage", "users.changeRole", "system.configure"];

function sanitize(matrix: Partial<Record<Role, string[]>>): PermissionMatrix {
  const valid = new Set<string>(CAPABILITIES);
  const roles: Role[] = ["ADMIN", "MANAGER", "REP", "VIEWER"];
  const out = {} as PermissionMatrix;
  for (const r of roles) {
    const fromInput = (matrix[r] ?? []).filter((c) => valid.has(c)) as Capability[];
    const merged = r === "ADMIN" ? [...new Set([...fromInput, ...ADMIN_ONLY])] : fromInput;
    out[r] = merged.filter((c, i, arr) => arr.indexOf(c) === i);
  }
  return out;
}

// React cache() de-dupes within a single request — settings page edits trigger
// revalidatePath so the next request reads the fresh matrix.
export const getPermissions = cache(async (): Promise<PermissionMatrix> => {
  const row = await prisma.settings.findUnique({ where: { id: "default" } });
  if (!row) return DEFAULT_PERMISSIONS;
  const stored = parseJson<Partial<Record<Role, string[]>>>(row.permissions, {});
  return sanitize({
    ADMIN: stored.ADMIN ?? DEFAULT_PERMISSIONS.ADMIN,
    MANAGER: stored.MANAGER ?? DEFAULT_PERMISSIONS.MANAGER,
    REP: stored.REP ?? DEFAULT_PERMISSIONS.REP,
    VIEWER: stored.VIEWER ?? DEFAULT_PERMISSIONS.VIEWER,
  });
});

export async function can(role: Role, cap: Capability): Promise<boolean> {
  const perms = await getPermissions();
  return perms[role].includes(cap);
}

export async function requireCapability(role: Role, cap: Capability): Promise<void> {
  if (!(await can(role, cap))) {
    throw new Error(`Forbidden: missing capability ${cap}`);
  }
}

// Synchronous helper used by client components that already received a matrix
// from the server (avoids duplicate DB hits).
export function canSync(role: Role, cap: Capability, perms: PermissionMatrix): boolean {
  return perms[role].includes(cap);
}

export function describeCapability(cap: Capability): string {
  const map: Record<Capability, string> = {
    "lead.viewAll": "View all leads (not just assigned to me)",
    "lead.editAny": "Edit any lead (not just owned)",
    "lead.deleteAny": "Delete any lead",
    "lead.bulkDelete": "Bulk-delete leads",
    "lead.reassignAny": "Reassign any lead",
    "icp.viewAll": "View all ICPs (not just ones with assigned leads)",
    "icp.manage": "Create / edit / archive ICPs",
    "icp.delete": "Delete an ICP",
    "users.manage": "Invite / disable users",
    "users.changeRole": "Change another user's role",
    "trash.hardDelete": "Hard-delete from Trash",
    "system.configure": "Configure system settings",
    "import.run": "Run CSV imports",
    "export.run": "Run CSV exports",
    "view.allDashboards": "View team-wide dashboards",
  };
  return map[cap];
}
