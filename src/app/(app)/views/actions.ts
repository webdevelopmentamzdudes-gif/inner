"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { toJson } from "@/lib/json";
import type { SavedFilter } from "@/lib/savedView";

// Saved-view filter shape — mirrors the lead-list URL search params.
const filterSchema = z.object({
  q: z.string().optional().default(""),
  icp: z.string().optional().default(""),
  stage: z.string().optional().default(""),
  bucket: z.string().optional().default(""),
  source: z.string().optional().default(""),
  mine: z.string().optional().default(""),
});

const saveSchema = z.object({
  name: z.string().min(1).max(80),
  filter: filterSchema,
  isShared: z.boolean().optional().default(false),
});

export async function saveView(input: { name: string; filter: SavedFilter; isShared?: boolean }) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const data = saveSchema.parse(input);

  await prisma.savedView.create({
    data: {
      userId: session.user.id,
      name: data.name,
      filterConfig: toJson(data.filter),
      isShared: !!data.isShared,
    },
  });
  revalidatePath("/views");
  revalidatePath("/leads");
  return { ok: true as const };
}

const updateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(80).optional(),
  filter: filterSchema.optional(),
  isShared: z.boolean().optional(),
});

export async function updateView(input: {
  id: string;
  name?: string;
  filter?: SavedFilter;
  isShared?: boolean;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const data = updateSchema.parse(input);
  const existing = await prisma.savedView.findUnique({ where: { id: data.id } });
  if (!existing) throw new Error("View not found");
  if (existing.userId !== session.user.id) throw new Error("You can only edit your own views.");

  await prisma.savedView.update({
    where: { id: data.id },
    data: {
      ...(data.name ? { name: data.name } : {}),
      ...(data.filter ? { filterConfig: toJson(data.filter) } : {}),
      ...(data.isShared !== undefined ? { isShared: data.isShared } : {}),
    },
  });
  revalidatePath("/views");
}

export async function deleteView(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const existing = await prisma.savedView.findUnique({ where: { id } });
  if (!existing) return;
  if (existing.userId !== session.user.id && session.user.role !== "ADMIN") {
    throw new Error("You can only delete your own views.");
  }
  await prisma.savedView.delete({ where: { id } });
  revalidatePath("/views");
}

export async function saveViewFromQuery(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required.");
  const isShared = formData.get("isShared") === "1";

  const filter: SavedFilter = filterSchema.parse({
    q: formData.get("q") ?? "",
    icp: formData.get("icp") ?? "",
    stage: formData.get("stage") ?? "",
    bucket: formData.get("bucket") ?? "",
    source: formData.get("source") ?? "",
    mine: formData.get("mine") ?? "",
  });

  await prisma.savedView.create({
    data: {
      userId: session.user.id,
      name,
      filterConfig: toJson(filter),
      isShared,
    },
  });

  // Redirect back to the leads page with the same filters intact so the user
  // doesn't lose their place.
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filter)) {
    if (v) params.set(k, String(v));
  }
  const qs = params.toString();
  redirect(`/leads${qs ? `?${qs}` : ""}`);
}
