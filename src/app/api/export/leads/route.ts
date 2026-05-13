import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { leadScopeWhere } from "@/lib/scope";
import { can } from "@/lib/rbac";
import { summarizeAttempts } from "@/lib/outreach";
import type { Prisma } from "@prisma/client";

// CSV export of (filtered) leads. Same filter contract as /leads page.
// Respects scope: rep without lead.viewAll only exports their own leads.

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await can(session.user.role, "export.run"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const sp = url.searchParams;
  const scope = await leadScopeWhere(session.user.role, session.user.id);
  const where: Prisma.LeadWhereInput = { status: "ACTIVE", ...scope };
  if (sp.get("icp")) where.icpId = sp.get("icp")!;
  if (sp.get("stage")) where.stageId = sp.get("stage")!;
  if (sp.get("source")) where.leadSource = sp.get("source")!;
  if (sp.get("mine") === "1") where.assignedToId = session.user.id;
  const bucket = sp.get("bucket");
  if (bucket === "A") where.score = { gte: 80 };
  else if (bucket === "B") where.score = { gte: 50, lte: 79 };
  else if (bucket === "C") where.score = { lte: 49 };
  const q = sp.get("q");
  if (q) {
    where.OR = [
      { companyName: { contains: q } },
      { contactEmail: { contains: q } },
      { contactFirstName: { contains: q } },
      { contactLastName: { contains: q } },
      { companyWebsite: { contains: q } },
    ];
  }

  const leads = await prisma.lead.findMany({
    where,
    include: {
      icp: { select: { name: true } },
      stage: { select: { name: true } },
      assignedTo: { select: { name: true, email: true } },
      contactAttempts: { select: { channel: true, direction: true, status: true } },
    },
    orderBy: [{ score: "desc" }, { lastActivityAt: "desc" }],
    take: 50000,
  });

  const headers = [
    "lead_id",
    "company_name",
    "company_website",
    "industry",
    "geography",
    "headcount",
    "annual_revenue",
    "contact_first_name",
    "contact_last_name",
    "contact_title",
    "contact_email",
    "contact_phone",
    "contact_linkedin",
    "icp",
    "stage",
    "score",
    "lead_source",
    "source_detail",
    "assigned_to",
    "assigned_email",
    "next_action_due",
    "last_activity_at",
    "created_at",
    "channels_attempted",
    "channels_responded",
  ];

  const rows = leads.map((l) => {
    const cov = summarizeAttempts(l.contactAttempts);
    const attempted = cov
      .filter((c) => c.attempts > 0)
      .map((c) => `${c.channel}:${c.attempts}`)
      .join("|");
    const responded = cov
      .filter((c) => c.hasResponse)
      .map((c) => c.channel)
      .join("|");
    return [
      l.id,
      l.companyName,
      l.companyWebsite,
      l.industry,
      l.geography,
      l.headcount,
      l.annualRevenue ? Number(l.annualRevenue) : "",
      l.contactFirstName,
      l.contactLastName,
      l.contactTitle,
      l.contactEmail,
      l.contactPhone,
      l.contactLinkedin,
      l.icp.name,
      l.stage.name,
      l.score,
      l.leadSource,
      l.sourceDetail,
      l.assignedTo?.name ?? "",
      l.assignedTo?.email ?? "",
      l.nextActionDue ? new Date(l.nextActionDue).toISOString() : "",
      new Date(l.lastActivityAt).toISOString(),
      new Date(l.createdAt).toISOString(),
      attempted,
      responded,
    ].map(csvEscape).join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads_${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
