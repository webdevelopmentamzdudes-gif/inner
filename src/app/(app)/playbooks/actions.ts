"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { canViewIcp } from "@/lib/scope";
import { saveFileForResource, deleteFileForResource } from "@/lib/storage";
import { toJson } from "@/lib/json";
import { RESOURCE_TYPE_VALUES, getCategory } from "@/lib/playbook";

// Reps can read playbooks (they need them) but only icp.manage holders can
// edit / upload / delete. This separates "playbook authoring" from "lead use".
async function requireAuthor() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!(await can(session.user.role, "icp.manage"))) {
    throw new Error("Only Admins and Managers can edit the playbook.");
  }
  return session;
}

async function requireIcpAccess(icpId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const icp = await prisma.icp.findUnique({ where: { id: icpId } });
  if (!icp) throw new Error("ICP not found");
  if (!(await canViewIcp(session.user.role, session.user.id, icp))) {
    throw new Error("You don't have access to this ICP.");
  }
  return { session, icp };
}

const baseFields = z.object({
  icpId: z.string().min(1),
  type: z.enum(RESOURCE_TYPE_VALUES as [string, ...string[]]),
  title: z.string().min(1).max(200),
  body: z.string().optional().default(""),
  version: z.string().max(40).optional().default("1.0"),
  emailSubject: z.string().max(300).optional().default(""),
});

export async function createResource(formData: FormData) {
  const session = await requireAuthor();

  const parsed = baseFields.parse({
    icpId: formData.get("icpId"),
    type: formData.get("type"),
    title: formData.get("title"),
    body: formData.get("body") ?? "",
    version: formData.get("version") ?? "1.0",
    emailSubject: formData.get("emailSubject") ?? "",
  });

  // Confirm ICP exists (saveIcp uniqueness handled separately).
  await requireIcpAccess(parsed.icpId);

  const file = formData.get("file");
  const meta: Record<string, unknown> = {};
  if (parsed.type === "EMAIL_TEMPLATE" && parsed.emailSubject) {
    meta.subject = parsed.emailSubject;
  }

  const created = await prisma.resource.create({
    data: {
      icpId: parsed.icpId,
      type: parsed.type,
      title: parsed.title,
      body: parsed.body || null,
      meta: toJson(meta),
      version: parsed.version || "1.0",
      createdById: session.user.id,
    },
  });

  if (file && file instanceof File && file.size > 0) {
    const cat = getCategory(parsed.type);
    if (!cat.supportsFile) {
      // Roll back the row — this category doesn't accept files.
      await prisma.resource.delete({ where: { id: created.id } });
      throw new Error(`${cat.label} doesn't support file uploads.`);
    }
    try {
      const saved = await saveFileForResource(created.id, file);
      await prisma.resource.update({
        where: { id: created.id },
        data: saved,
      });
    } catch (e) {
      await prisma.resource.delete({ where: { id: created.id } });
      throw e;
    }
  }

  revalidatePath(`/playbooks/${parsed.icpId}`);
  redirect(`/playbooks/${parsed.icpId}/${created.id}`);
}

const updateSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200).optional(),
  body: z.string().optional(),
  version: z.string().max(40).optional(),
  emailSubject: z.string().max(300).optional(),
  removeFile: z.boolean().optional(),
});

export async function updateResource(formData: FormData) {
  const session = await requireAuthor();

  const parsed = updateSchema.parse({
    id: formData.get("id"),
    title: formData.get("title") ?? undefined,
    body: formData.get("body") ?? undefined,
    version: formData.get("version") ?? undefined,
    emailSubject: formData.get("emailSubject") ?? undefined,
    removeFile: formData.get("removeFile") === "1",
  });

  const existing = await prisma.resource.findUnique({
    where: { id: parsed.id },
    include: { icp: true },
  });
  if (!existing) throw new Error("Resource not found");
  if (!(await canViewIcp(session.user.role, session.user.id, existing.icp))) {
    throw new Error("Forbidden");
  }

  const data: Record<string, unknown> = {};
  if (parsed.title !== undefined) data.title = parsed.title;
  if (parsed.body !== undefined) data.body = parsed.body || null;
  if (parsed.version !== undefined) data.version = parsed.version;
  if (parsed.emailSubject !== undefined) {
    data.meta = toJson({ subject: parsed.emailSubject });
  }

  // File replacement.
  const file = formData.get("file");
  if (file && file instanceof File && file.size > 0) {
    const cat = getCategory(existing.type);
    if (!cat.supportsFile) throw new Error(`${cat.label} doesn't support file uploads.`);
    if (existing.filePath) await deleteFileForResource(existing.id);
    const saved = await saveFileForResource(existing.id, file);
    Object.assign(data, saved);
  } else if (parsed.removeFile && existing.filePath) {
    await deleteFileForResource(existing.id);
    Object.assign(data, { fileName: null, filePath: null, fileMime: null, fileSize: null });
  }

  await prisma.resource.update({
    where: { id: existing.id },
    data,
  });

  revalidatePath(`/playbooks/${existing.icpId}`);
  revalidatePath(`/playbooks/${existing.icpId}/${existing.id}`);
}

export async function archiveResource(id: string) {
  const session = await requireAuthor();
  const existing = await prisma.resource.findUnique({
    where: { id },
    include: { icp: true },
  });
  if (!existing) throw new Error("Not found");
  if (!(await canViewIcp(session.user.role, session.user.id, existing.icp))) {
    throw new Error("Forbidden");
  }
  await prisma.resource.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });
  revalidatePath(`/playbooks/${existing.icpId}`);
}

export async function restoreResource(id: string) {
  await requireAuthor();
  const existing = await prisma.resource.findUnique({
    where: { id },
  });
  if (!existing) throw new Error("Not found");
  await prisma.resource.update({
    where: { id },
    data: { status: "ACTIVE" },
  });
  revalidatePath(`/playbooks/${existing.icpId}`);
}

export async function deleteResource(id: string) {
  await requireAuthor();
  const existing = await prisma.resource.findUnique({ where: { id } });
  if (!existing) throw new Error("Not found");
  if (existing.filePath) await deleteFileForResource(existing.id);
  await prisma.resource.delete({ where: { id } });
  revalidatePath(`/playbooks/${existing.icpId}`);
  redirect(`/playbooks/${existing.icpId}`);
}
