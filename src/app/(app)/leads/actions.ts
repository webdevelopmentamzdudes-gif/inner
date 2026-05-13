"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { scoreLead } from "@/lib/scoring";
import { toJson } from "@/lib/json";
import { notify } from "@/lib/notify";

const leadCreate = z.object({
  icpId: z.string().min(1),
  companyName: z.string().min(1),
  companyWebsite: z.string().url().optional().or(z.literal("")).transform((v) => (v ? v : null)),
  industry: z.string().optional().nullable(),
  geography: z.string().optional().nullable(),
  headcount: z.coerce.number().int().min(0).optional().nullable(),
  annualRevenue: z.coerce.number().int().min(0).optional().nullable(),
  contactFirstName: z.string().optional().nullable(),
  contactLastName: z.string().optional().nullable(),
  contactTitle: z.string().optional().nullable(),
  contactEmail: z.string().email().optional().or(z.literal("")).transform((v) => (v ? v : null)),
  contactPhone: z.string().optional().nullable(),
  contactLinkedin: z.string().url().optional().or(z.literal("")).transform((v) => (v ? v : null)),
  leadSource: z.enum(["LINKEDIN", "APOLLO", "REFERRAL", "EVENT", "MANUAL", "CSV", "OTHER"]),
  sourceDetail: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  customFields: z.record(z.string(), z.unknown()).optional().default({}),
});

function nullify<T extends Record<string, unknown>>(o: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    out[k] = v === "" ? null : v;
  }
  return out as T;
}

async function recomputeScore(leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return;
  const criteria = await prisma.icpCriterion.findMany({ where: { icpId: lead.icpId } });
  const result = scoreLead(lead, criteria);
  await prisma.lead.update({
    where: { id: leadId },
    data: { score: result.score, scoreBreakdown: toJson(result.breakdown) },
  });
}

export async function createLead(raw: unknown) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const data = leadCreate.parse(nullify(raw as Record<string, unknown>));

  const firstStage = await prisma.icpStage.findFirst({
    where: { icpId: data.icpId },
    orderBy: { sortOrder: "asc" },
  });
  if (!firstStage) throw new Error("ICP has no pipeline stages");

  const lead = await prisma.lead.create({
    data: {
      icpId: data.icpId,
      stageId: firstStage.id,
      companyName: data.companyName,
      companyWebsite: data.companyWebsite,
      industry: data.industry,
      geography: data.geography,
      headcount: data.headcount,
      annualRevenue: data.annualRevenue ? BigInt(data.annualRevenue) : null,
      contactFirstName: data.contactFirstName,
      contactLastName: data.contactLastName,
      contactTitle: data.contactTitle,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone,
      contactLinkedin: data.contactLinkedin,
      leadSource: data.leadSource,
      sourceDetail: data.sourceDetail,
      assignedToId: data.assignedToId ?? session.user.id,
      createdById: session.user.id,
      customFields: toJson(data.customFields ?? {}),
    },
  });

  await prisma.leadActivity.create({
    data: {
      leadId: lead.id,
      type: "CREATED",
      performedById: session.user.id,
      payload: toJson({}),
    },
  });
  await recomputeScore(lead.id);

  const icp = await prisma.icp.findUnique({ where: { id: lead.icpId }, select: { name: true } });
  await notify({
    type: "LEAD_CREATED",
    leadId: lead.id,
    leadName: lead.companyName,
    icpName: icp?.name ?? "Unknown ICP",
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email ?? "Someone",
  });
  if (lead.assignedToId && lead.assignedToId !== session.user.id) {
    await notify({
      type: "LEAD_ASSIGNED",
      leadId: lead.id,
      leadName: lead.companyName,
      toUserId: lead.assignedToId,
      actorId: session.user.id,
      actorName: session.user.name ?? session.user.email ?? "Someone",
    });
  }

  revalidatePath("/leads");
  redirect(`/leads/${lead.id}`);
}

const leadUpdate = leadCreate.partial();

export async function updateLead(id: string, raw: unknown) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) throw new Error("Not found");

  const isOwner = lead.assignedToId === session.user.id;
  if (!isOwner && !(await can(session.user.role, "lead.editAny"))) {
    throw new Error("Forbidden");
  }

  const data = leadUpdate.parse(nullify(raw as Record<string, unknown>));

  // Build a precise update payload — leave unchanged keys absent.
  const updateData: Record<string, unknown> = { lastActivityAt: new Date() };
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (k === "annualRevenue") {
      updateData.annualRevenue = v == null ? null : BigInt(v as number);
    } else if (k === "customFields") {
      updateData.customFields = toJson(v);
    } else {
      updateData[k] = v;
    }
  }

  await prisma.lead.update({ where: { id }, data: updateData });

  await prisma.leadActivity.create({
    data: {
      leadId: id,
      type: "FIELD_EDITED",
      performedById: session.user.id,
      payload: toJson({ fields: Object.keys(data) }),
    },
  });

  await recomputeScore(id);
  revalidatePath(`/leads/${id}`);
  revalidatePath("/leads");
}

export async function moveStage(leadId: string, stageId: string, lostReason?: string, closingNote?: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const [lead, stage] = await Promise.all([
    prisma.lead.findUnique({ where: { id: leadId } }),
    prisma.icpStage.findUnique({ where: { id: stageId } }),
  ]);
  if (!lead || !stage) throw new Error("Not found");
  if (stage.icpId !== lead.icpId) throw new Error("Stage does not belong to lead's ICP");

  const updates: Record<string, unknown> = { stageId, lastActivityAt: new Date() };
  if (stage.isLost) updates.lostReason = lostReason ?? "OTHER";
  if (stage.isWon && closingNote) updates.closingNote = closingNote;

  await prisma.lead.update({ where: { id: leadId }, data: updates });

  await prisma.leadActivity.create({
    data: {
      leadId,
      type: "STAGE_CHANGED",
      performedById: session.user.id,
      payload: toJson({ from: lead.stageId, to: stageId }),
    },
  });

  const fromStage = await prisma.icpStage.findUnique({ where: { id: lead.stageId } });
  const actor = { id: session.user.id, name: session.user.name ?? session.user.email ?? "Someone" };
  if (stage.isWon) {
    await notify({
      type: "LEAD_WON",
      leadId,
      leadName: lead.companyName,
      ownerId: lead.assignedToId,
      actorId: actor.id,
      actorName: actor.name,
    });
  } else if (stage.isLost) {
    await notify({
      type: "LEAD_LOST",
      leadId,
      leadName: lead.companyName,
      ownerId: lead.assignedToId,
      actorId: actor.id,
      actorName: actor.name,
    });
  } else {
    await notify({
      type: "LEAD_STAGE_CHANGED",
      leadId,
      leadName: lead.companyName,
      from: fromStage?.name ?? "previous",
      to: stage.name,
      ownerId: lead.assignedToId,
      actorId: actor.id,
      actorName: actor.name,
    });
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
}

export async function addNote(leadId: string, body: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!body.trim()) return;
  await prisma.leadNote.create({
    data: { leadId, body: body.trim(), createdById: session.user.id },
  });
  await prisma.leadActivity.create({
    data: {
      leadId,
      type: "NOTE_ADDED",
      performedById: session.user.id,
      payload: toJson({}),
    },
  });
  await prisma.lead.update({
    where: { id: leadId },
    data: { lastActivityAt: new Date() },
  });

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { companyName: true, assignedToId: true },
  });
  if (lead) {
    await notify({
      type: "LEAD_NOTE_ADDED",
      leadId,
      leadName: lead.companyName,
      ownerId: lead.assignedToId,
      actorId: session.user.id,
      actorName: session.user.name ?? session.user.email ?? "Someone",
    });
  }

  revalidatePath(`/leads/${leadId}`);
}

export async function archiveLead(leadId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Not found");
  const isOwner = lead.assignedToId === session.user.id;
  if (!isOwner && !(await can(session.user.role, "lead.deleteAny"))) throw new Error("Forbidden");

  await prisma.lead.update({ where: { id: leadId }, data: { status: "ARCHIVED" } });
  await prisma.leadActivity.create({
    data: {
      leadId,
      type: "ARCHIVED",
      performedById: session.user.id,
      payload: toJson({}),
    },
  });

  await notify({
    type: "LEAD_ARCHIVED",
    leadId,
    leadName: lead.companyName,
    ownerId: lead.assignedToId,
    actorId: session.user.id,
    actorName: session.user.name ?? session.user.email ?? "Someone",
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}

export async function checkDuplicate({
  icpId,
  email,
  website,
  companyName,
}: {
  icpId: string;
  email?: string | null;
  website?: string | null;
  companyName?: string | null;
}) {
  // Priority order per PRD §9.6: email → website → fuzzy company name.
  if (email) {
    const m = await prisma.lead.findFirst({
      where: { contactEmail: email, status: "ACTIVE" },
      include: { icp: true, assignedTo: true, stage: true },
    });
    if (m) return { match: m, by: "email" as const };
  }
  if (website) {
    const m = await prisma.lead.findFirst({
      where: { companyWebsite: website, status: "ACTIVE" },
      include: { icp: true, assignedTo: true, stage: true },
    });
    if (m) return { match: m, by: "website" as const };
  }
  if (companyName && companyName.length >= 3) {
    // SQLite contains is case-insensitive by default for ASCII; no `mode` needed.
    const m = await prisma.lead.findFirst({
      where: {
        companyName: { contains: companyName },
        status: "ACTIVE",
        ...(icpId ? { icpId } : {}),
      },
      include: { icp: true, assignedTo: true, stage: true },
    });
    if (m) return { match: m, by: "name" as const };
  }
  return null;
}
