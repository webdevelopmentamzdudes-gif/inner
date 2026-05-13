import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { scoreBucket, bucketLabel, relativeTime } from "@/lib/utils";
import LeadDetailClient from "./LeadDetailClient";
import { parseJson } from "@/lib/json";
import { canViewLead } from "@/lib/scope";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      icp: { include: { stages: { orderBy: { sortOrder: "asc" } }, criteria: true } },
      stage: true,
      assignedTo: true,
      createdBy: true,
      tags: true,
      notes: { orderBy: { createdAt: "desc" }, include: { createdBy: true } },
      tasks: { orderBy: { dueDate: "asc" }, include: { assignedTo: true } },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { performedBy: true },
      },
      contactAttempts: {
        orderBy: { occurredAt: "desc" },
        take: 200,
        include: { performedBy: { select: { name: true } } },
      },
    },
  });
  if (!lead) notFound();
  if (!(await canViewLead(session!.user.role, session!.user.id, lead))) {
    notFound();
  }

  // Convert BigInt + parse JSON string columns for the client component.
  const safeLead = {
    ...lead,
    annualRevenue: lead.annualRevenue ? Number(lead.annualRevenue) : null,
    scoreBreakdown: parseJson<unknown[]>(lead.scoreBreakdown, []),
    customFields: parseJson<Record<string, unknown>>(lead.customFields, {}),
    contactAttempts: lead.contactAttempts.map((a) => ({
      id: a.id,
      channel: a.channel,
      direction: a.direction,
      status: a.status,
      occurredAt: a.occurredAt.toISOString(),
      summary: a.summary,
      performedBy: a.performedBy?.name ?? "Unknown",
      performedById: a.performedById,
    })),
  };

  const bucket = scoreBucket(lead.score);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Link href="/leads" className="text-xs text-muted hover:text-brand">
            ← Back to leads
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{lead.companyName}</h1>
            {lead.companyWebsite && (
              <a
                href={lead.companyWebsite}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-brand"
              >
                {new URL(lead.companyWebsite).hostname}
              </a>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/playbooks/${lead.icpId}`}
              className="pill hover:opacity-80"
              style={{ background: `${lead.icp.color}1a`, color: lead.icp.color }}
              title="Open ICP playbook"
            >
              {lead.icp.name} ↗
            </Link>
            <span
              className={
                bucket === "A" ? "pill-green" : bucket === "B" ? "pill-amber" : "pill-red"
              }
            >
              {lead.score} · {bucketLabel(bucket)}
            </span>
            <span className="pill-slate">{lead.stage.name}</span>
            <span className="text-xs text-muted">
              Last activity {relativeTime(lead.lastActivityAt)}
            </span>
          </div>
        </div>
      </div>

      <LeadDetailClient
        lead={safeLead}
        currentUserId={session!.user.id}
        currentUserRole={session!.user.role}
      />
    </div>
  );
}
