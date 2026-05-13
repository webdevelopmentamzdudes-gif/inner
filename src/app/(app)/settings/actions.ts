"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth, signOut } from "@/auth";
import {
  can,
  CAPABILITIES,
  DEFAULT_PERMISSIONS,
  type Capability,
  type PermissionMatrix,
} from "@/lib/rbac";
import { toJson } from "@/lib/json";
import { notify } from "@/lib/notify";
import type { Role, UserStatus } from "@/lib/types";

// ---------- Profile ----------

const profileSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

export async function updateProfile(input: { name: string; email: string }) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const data = profileSchema.parse(input);

  // Email uniqueness check (excluding self)
  const existing = await prisma.user.findFirst({
    where: { email: data.email, NOT: { id: session.user.id } },
    select: { id: true },
  });
  if (existing) throw new Error("Email already in use by another user.");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: data.name, email: data.email },
  });
  revalidatePath("/settings/profile");
  return { ok: true as const };
}

// ---------- Password ----------

const passwordSchema = z
  .object({
    current: z.string().min(1),
    next: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string().min(8),
  })
  .refine((d) => d.next === d.confirm, {
    message: "New password and confirmation do not match",
    path: ["confirm"],
  });

export async function changePassword(input: {
  current: string;
  next: string;
  confirm: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const data = passwordSchema.parse(input);

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || !user.hashedPassword) throw new Error("User has no password set.");

  const ok = await bcrypt.compare(data.current, user.hashedPassword);
  if (!ok) throw new Error("Current password is incorrect.");

  const hashed = await bcrypt.hash(data.next, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { hashedPassword: hashed },
  });
  return { ok: true as const };
}

// ---------- Notifications ----------

export async function updateNotificationPrefs(prefs: Record<string, boolean>) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  await prisma.user.update({
    where: { id: session.user.id },
    data: { notifPrefs: toJson(prefs) },
  });
  revalidatePath("/settings/notifications");
  return { ok: true as const };
}

// ---------- Users (admin only) ----------

const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(["ADMIN", "MANAGER", "REP", "VIEWER"]),
  password: z.string().min(8),
});

export async function createUser(input: {
  name: string;
  email: string;
  role: Role;
  password: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!(await can(session.user.role, "users.manage"))) throw new Error("Forbidden");

  const data = createUserSchema.parse(input);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new Error("A user with that email already exists.");

  const hashed = await bcrypt.hash(data.password, 10);
  const created = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      role: data.role,
      status: "ACTIVE",
      hashedPassword: hashed,
    },
  });

  await notify({
    type: "USER_CREATED",
    userId: created.id,
    userName: created.name,
    role: created.role,
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email ?? "Someone",
  });

  revalidatePath("/settings/users");
  return { ok: true as const };
}

const updateUserSchema = z.object({
  id: z.string(),
  role: z.enum(["ADMIN", "MANAGER", "REP", "VIEWER"]).optional(),
  status: z.enum(["ACTIVE", "INVITED", "DISABLED"]).optional(),
  name: z.string().min(1).max(100).optional(),
});

export async function updateUser(input: {
  id: string;
  role?: Role;
  status?: UserStatus;
  name?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!(await can(session.user.role, "users.manage"))) throw new Error("Forbidden");

  const data = updateUserSchema.parse(input);

  // Don't let an admin lock themselves out by demoting/disabling their own account.
  if (data.id === session.user.id) {
    if (data.role && data.role !== "ADMIN") {
      throw new Error("You can't change your own role from Admin.");
    }
    if (data.status && data.status !== "ACTIVE") {
      throw new Error("You can't disable your own account.");
    }
  }

  // Prevent removing the last active admin.
  if (data.role && data.role !== "ADMIN") {
    const target = await prisma.user.findUnique({ where: { id: data.id } });
    if (target?.role === "ADMIN") {
      const otherAdmins = await prisma.user.count({
        where: { role: "ADMIN", status: "ACTIVE", NOT: { id: data.id } },
      });
      if (otherAdmins === 0) throw new Error("Cannot demote the last active admin.");
    }
  }
  if (data.status && data.status !== "ACTIVE") {
    const target = await prisma.user.findUnique({ where: { id: data.id } });
    if (target?.role === "ADMIN" && target.status === "ACTIVE") {
      const otherAdmins = await prisma.user.count({
        where: { role: "ADMIN", status: "ACTIVE", NOT: { id: data.id } },
      });
      if (otherAdmins === 0) throw new Error("Cannot disable the last active admin.");
    }
  }

  await prisma.user.update({
    where: { id: data.id },
    data: {
      ...(data.role ? { role: data.role } : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(data.name ? { name: data.name } : {}),
    },
  });
  revalidatePath("/settings/users");
  return { ok: true as const };
}

export async function resetUserPassword(input: { id: string; password: string }) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!(await can(session.user.role, "users.manage"))) throw new Error("Forbidden");

  if (input.password.length < 8) throw new Error("Password must be at least 8 characters.");

  const hashed = await bcrypt.hash(input.password, 10);
  await prisma.user.update({
    where: { id: input.id },
    data: { hashedPassword: hashed },
  });
  return { ok: true as const };
}

// Sign out — used after profile/email change so JWT picks up new claims.
export async function signOutAfterUpdate() {
  await signOut({ redirectTo: "/login" });
}

// ---------- Permissions matrix (admin only) ----------

const ROLES: Role[] = ["ADMIN", "MANAGER", "REP", "VIEWER"];

export async function savePermissions(input: PermissionMatrix) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!(await can(session.user.role, "system.configure"))) throw new Error("Forbidden");

  const validCaps = new Set<string>(CAPABILITIES);
  const sanitized: PermissionMatrix = {} as PermissionMatrix;
  for (const role of ROLES) {
    const list = (input[role] ?? []).filter((c): c is Capability => validCaps.has(c));
    sanitized[role] = list;
  }

  // Force ADMIN to retain at minimum the lockout-prevention caps.
  const required: Capability[] = ["users.manage", "users.changeRole", "system.configure", "icp.manage"];
  sanitized.ADMIN = Array.from(new Set([...sanitized.ADMIN, ...required]));

  await prisma.settings.upsert({
    where: { id: "default" },
    create: { id: "default", permissions: toJson(sanitized) },
    update: { permissions: toJson(sanitized) },
  });

  revalidatePath("/settings/permissions");
  revalidatePath("/leads");
  revalidatePath("/icps");
  return { ok: true as const };
}

export async function resetPermissionsToDefault() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!(await can(session.user.role, "system.configure"))) throw new Error("Forbidden");

  await prisma.settings.upsert({
    where: { id: "default" },
    create: { id: "default", permissions: toJson(DEFAULT_PERMISSIONS) },
    update: { permissions: toJson(DEFAULT_PERMISSIONS) },
  });
  revalidatePath("/settings/permissions");
  revalidatePath("/leads");
  revalidatePath("/icps");
  return { ok: true as const };
}
