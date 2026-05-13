import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import IcpBuilderForm from "../IcpBuilderForm";
import type { IcpInput } from "../actions";
import type { CriterionType, MatchRule, IcpStatus } from "@/lib/types";
import { parseJson } from "@/lib/json";
import { canViewIcp } from "@/lib/scope";

export default async function IcpDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const canManage = await can(session!.user.role, "icp.manage");

  const icp = await prisma.icp.findUnique({
    where: { id },
    include: {
      criteria: { orderBy: { sortOrder: "asc" } },
      stages: { orderBy: { sortOrder: "asc" } },
      _count: { select: { leads: true } },
    },
  });
  if (!icp) notFound();
  if (!(await canViewIcp(session!.user.role, session!.user.id, icp))) {
    notFound();
  }

  const initial: IcpInput = {
    id: icp.id,
    name: icp.name,
    description: icp.description ?? null,
    color: icp.color,
    status: icp.status as IcpStatus,
    criteria: icp.criteria.map((c) => ({
      id: c.id,
      label: c.label,
      fieldPath: c.fieldPath,
      dataType: c.dataType as CriterionType,
      matchRule: c.matchRule as MatchRule,
      matchValue: parseJson(c.matchValue, {}),
      weight: c.weight,
      required: c.required,
    })),
    stages: icp.stages.map((s) => ({
      name: s.name,
      isWon: s.isWon,
      isLost: s.isLost,
      stallThresholdDays: s.stallThresholdDays ?? null,
    })),
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="size-8 rounded-md" style={{ background: icp.color }} />
            <h1 className="text-2xl font-semibold">{icp.name}</h1>
            {icp.status === "ARCHIVED" && <span className="pill-slate">Archived</span>}
          </div>
          <p className="text-sm text-muted mt-1">
            {icp._count.leads} leads · {icp.criteria.length} criteria · {icp.stages.length} stages
          </p>
        </div>
      </div>

      {canManage ? (
        <IcpBuilderForm initial={initial} />
      ) : (
        <ReadOnlyView initial={initial} />
      )}
    </div>
  );
}

function ReadOnlyView({ initial }: { initial: IcpInput }) {
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h2 className="font-semibold mb-2">Criteria</h2>
        <ul className="space-y-1 text-sm">
          {initial.criteria.map((c, i) => (
            <li key={i} className="flex justify-between">
              <span>{c.label} <span className="text-muted">({c.matchRule})</span></span>
              <span className="font-medium">w {c.weight}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="card p-5">
        <h2 className="font-semibold mb-2">Pipeline</h2>
        <ol className="space-y-1 text-sm list-decimal list-inside">
          {initial.stages.map((s, i) => (
            <li key={i}>
              {s.name}
              {s.isWon && <span className="ml-2 pill-green">Won</span>}
              {s.isLost && <span className="ml-2 pill-red">Lost</span>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
