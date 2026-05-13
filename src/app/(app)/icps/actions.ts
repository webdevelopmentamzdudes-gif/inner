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

const criterionSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1),
  fieldPath: z.string().min(1),
  dataType: z.enum(["STRING", "NUMBER", "BOOLEAN", "ENUM", "RANGE", "URL"]),
  matchRule: z.enum(["EQUALS", "CONTAINS", "GREATER_THAN", "LESS_THAN", "BETWEEN", "IN_LIST"]),
  matchValue: z.unknown(),
  weight: z.coerce.number().int().min(0).max(100),
  required: z.boolean().optional().default(false),
});

const stageSchema = z.object({
  name: z.string().min(1),
  isWon: z.boolean().optional().default(false),
  isLost: z.boolean().optional().default(false),
  stallThresholdDays: z.coerce.number().int().min(0).optional().nullable(),
});

const icpSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  status: z.enum(["ACTIVE", "ARCHIVED"]).default("ACTIVE"),
  criteria: z.array(criterionSchema).min(1),
  stages: z.array(stageSchema).min(3),
});

export type IcpInput = z.infer<typeof icpSchema>;

export async function saveIcp(input: IcpInput) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!(await can(session.user.role, "icp.manage"))) throw new Error("Forbidden");

  const data = icpSchema.parse(input);

  const sumWeights = data.criteria.reduce((s, c) => s + c.weight, 0);
  if (sumWeights !== 100) {
    throw new Error(`Criterion weights must sum to 100 (got ${sumWeights}).`);
  }
  if (!data.stages.some((s) => s.isWon)) throw new Error("At least one Won stage is required.");
  if (!data.stages.some((s) => s.isLost)) throw new Error("At least one Lost stage is required.");

  const id = data.id;

  const icp = await prisma.$transaction(async (tx) => {
    const upserted = id
      ? await tx.icp.update({
          where: { id },
          data: {
            name: data.name,
            description: data.description ?? null,
            color: data.color,
            status: data.status,
          },
        })
      : await tx.icp.create({
          data: {
            name: data.name,
            description: data.description ?? null,
            color: data.color,
            status: data.status,
            createdById: session.user.id,
          },
        });

    await tx.icpCriterion.deleteMany({ where: { icpId: upserted.id } });
    await tx.icpCriterion.createMany({
      data: data.criteria.map((c, i) => ({
        icpId: upserted.id,
        label: c.label,
        fieldPath: c.fieldPath,
        dataType: c.dataType,
        matchRule: c.matchRule,
        matchValue: toJson(c.matchValue),
        weight: c.weight,
        required: c.required ?? false,
        sortOrder: i,
      })),
    });

    const oldStages = await tx.icpStage.findMany({ where: { icpId: upserted.id } });
    const oldByName = new Map(oldStages.map((s) => [s.name.toLowerCase(), s]));

    const newStageRows = data.stages.map((s, i) => ({
      icpId: upserted.id,
      name: s.name,
      sortOrder: i,
      isWon: s.isWon ?? false,
      isLost: s.isLost ?? false,
      isTerminal: (s.isWon ?? false) || (s.isLost ?? false),
      stallThresholdDays: s.stallThresholdDays ?? null,
    }));

    const newNames = new Set(newStageRows.map((s) => s.name.toLowerCase()));
    const removable = oldStages.filter((s) => !newNames.has(s.name.toLowerCase()));

    if (removable.length) {
      const fallback =
        newStageRows.find((s) => !s.isWon && !s.isLost) ?? newStageRows[0];
      const fallbackRow = await tx.icpStage.upsert({
        where: { icpId_name: { icpId: upserted.id, name: fallback.name } },
        create: fallback,
        update: { ...fallback },
      });
      await tx.lead.updateMany({
        where: { stageId: { in: removable.map((s) => s.id) } },
        data: { stageId: fallbackRow.id },
      });
      await tx.icpStage.deleteMany({
        where: { id: { in: removable.map((s) => s.id) } },
      });
    }

    for (const s of newStageRows) {
      const existing = oldByName.get(s.name.toLowerCase());
      if (existing) {
        await tx.icpStage.update({ where: { id: existing.id }, data: s });
      } else {
        await tx.icpStage.create({ data: s });
      }
    }

    return upserted;
  });

  await rescoreIcpLeads(icp.id);

  if (!id) {
    // Only fire notification on create, not edit.
    await notify({
      type: "ICP_CREATED",
      icpId: icp.id,
      icpName: icp.name,
      actorId: session.user.id,
      actorName: session.user.name ?? session.user.email ?? "Someone",
    });
  }

  revalidatePath("/icps");
  revalidatePath(`/icps/${icp.id}`);
  redirect(`/icps/${icp.id}`);
}

export async function archiveIcp(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!(await can(session.user.role, "icp.manage"))) throw new Error("Forbidden");
  await prisma.icp.update({ where: { id }, data: { status: "ARCHIVED" } });
  revalidatePath("/icps");
}

export async function rescoreIcpLeads(icpId: string) {
  const [criteria, leads] = await Promise.all([
    prisma.icpCriterion.findMany({ where: { icpId } }),
    prisma.lead.findMany({ where: { icpId, status: "ACTIVE" } }),
  ]);

  for (const lead of leads) {
    const result = scoreLead(lead, criteria);
    await prisma.lead.update({
      where: { id: lead.id },
      data: { score: result.score, scoreBreakdown: toJson(result.breakdown) },
    });
  }
}
