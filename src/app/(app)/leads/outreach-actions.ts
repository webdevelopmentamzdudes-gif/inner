"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { toJson } from "@/lib/json";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { canViewLead } from "@/lib/scope";
import { CHANNELS, STATUSES } from "@/lib/outreach";

const channelValues = CHANNELS.map((c) => c.value) as [string, ...string[]];
const statusValues = STATUSES.map((s) => s.value) as [string, ...string[]];

const logSchema = z.object({
  leadId: z.string().min(1),
  channel: z.enum(channelValues),
  direction: z.enum(["OUTBOUND", "INBOUND"]),
  status: z.enum(statusValues),
  occurredAt: z.string().optional(),
  summary: z.string().max(500).optional(),
});

export async function logContactAttempt(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const parsed = logSchema.parse({
    leadId: formData.get("leadId"),
    channel: formData.get("channel"),
    direction: formData.get("direction") || "OUTBOUND",
    status: formData.get("status") || "ATTEMPTED",
    occurredAt: formData.get("occurredAt") ?? undefined,
    summary: formData.get("summary") ?? undefined,
  });

  const lead = await prisma.lead.findUnique({ where: { id: parsed.leadId } });
  if (!lead) throw new Error("Lead not found");
  if (!(await canViewLead(session.user.role, session.user.id, lead))) {
    throw new Error("Forbidden");
  }

  await prisma.contactAttempt.create({
    data: {
      leadId: parsed.leadId,
      channel: parsed.channel,
      direction: parsed.direction,
      status: parsed.status,
      occurredAt: parsed.occurredAt ? new Date(parsed.occurredAt) : new Date(),
      summary: parsed.summary || null,
      performedById: session.user.id,
    },
  });

  await prisma.lead.update({
    where: { id: parsed.leadId },
    data: { lastActivityAt: new Date() },
  });

  // Inbound RESPONDED is meaningful — log to activity feed too so it shows
  // up in the lead's general timeline.
  await prisma.leadActivity.create({
    data: {
      leadId: parsed.leadId,
      type: parsed.status === "RESPONDED" ? "NOTE_ADDED" : "FIELD_EDITED",
      performedById: session.user.id,
      payload: toJson({
        kind: "contact_attempt",
        channel: parsed.channel,
        direction: parsed.direction,
        status: parsed.status,
      }),
    },
  });

  revalidatePath(`/leads/${parsed.leadId}`);
  revalidatePath("/leads");
}

export async function deleteContactAttempt(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const attempt = await prisma.contactAttempt.findUnique({
    where: { id },
    include: { lead: true },
  });
  if (!attempt) throw new Error("Not found");
  if (!(await canViewLead(session.user.role, session.user.id, attempt.lead))) {
    throw new Error("Forbidden");
  }
  // Anyone with read access can delete their own attempts; managers/admins
  // can delete others'. Keep this lenient since attempts are mostly notes.
  if (
    attempt.performedById !== session.user.id &&
    session.user.role !== "ADMIN" &&
    session.user.role !== "MANAGER"
  ) {
    throw new Error("You can only delete your own contact attempts.");
  }

  await prisma.contactAttempt.delete({ where: { id } });
  revalidatePath(`/leads/${attempt.leadId}`);
}
