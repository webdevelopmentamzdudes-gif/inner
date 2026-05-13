import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { relativeTime, scoreBucket } from "@/lib/utils";
import { Plus, Download } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { leadScopeWhere, icpScopeWhere } from "@/lib/scope";
import { CHANNELS, REQUIRED_CHANNELS, summarizeAttempts, type Channel } from "@/lib/outreach";
import SaveViewButton from "./SaveViewButton";

type SP = Promise<{
  icp?: string;
  stage?: string;
  bucket?: string;
  source?: string;
  q?: string;
  mine?: string;
  page?: string;
}>;

const PAGE_SIZE = 50;

export default async function LeadListPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const session = await auth();

  const page = Math.max(1, Number(sp.page) || 1);
  const scopeWhere = await leadScopeWhere(session!.user.role, session!.user.id);
  const icpWhere = await icpScopeWhere(session!.user.role, session!.user.id);
  const where: Prisma.LeadWhereInput = { status: "ACTIVE", ...scopeWhere };
  if (sp.icp) where.icpId = sp.icp;
  if (sp.stage) where.stageId = sp.stage;
  if (sp.source) where.leadSource = sp.source as Prisma.LeadWhereInput["leadSource"];
  if (sp.mine === "1") where.assignedToId = session!.user.id;
  if (sp.bucket === "A") where.score = { gte: 80 };
  else if (sp.bucket === "B") where.score = { gte: 50, lte: 79 };
  else if (sp.bucket === "C") where.score = { lte: 49 };
  if (sp.q) {
    where.OR = [
      { companyName: { contains: sp.q} },
      { contactEmail: { contains: sp.q} },
      { contactFirstName: { contains: sp.q} },
      { contactLastName: { contains: sp.q} },
      { companyWebsite: { contains: sp.q} },
    ];
  }

  const [leads, total, icps, allStages] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        icp: true,
        stage: true,
        assignedTo: true,
        tags: true,
        contactAttempts: { select: { channel: true, direction: true, status: true } },
      },
      orderBy: [{ score: "desc" }, { lastActivityAt: "desc" }],
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.lead.count({ where }),
    prisma.icp.findMany({
      where: { status: "ACTIVE", ...icpWhere },
      orderBy: { name: "asc" },
    }),
    prisma.icpStage.findMany({ orderBy: [{ icpId: "asc" }, { sortOrder: "asc" }] }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const stagesForFilter = sp.icp ? allStages.filter((s) => s.icpId === sp.icp) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-muted">{total.toLocaleString()} active leads</p>
        </div>
        <div className="flex gap-2">
          <SaveViewButton current={sp} />
          <a
            href={`/api/export/leads?${new URLSearchParams(sp as Record<string, string>).toString()}`}
            className="btn-secondary"
            title="Download filtered leads as CSV"
          >
            <Download className="size-4" /> Export CSV
          </a>
          <Link href="/leads/new" className="btn-primary">
            <Plus className="size-4" /> Add Lead
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <form className="card p-3 flex flex-wrap gap-2 items-end">
        <div className="flex flex-col">
          <label className="label">Search</label>
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Company, contact, email…"
            className="input w-64"
          />
        </div>
        <div className="flex flex-col">
          <label className="label">ICP</label>
          <select name="icp" defaultValue={sp.icp ?? ""} className="input w-44">
            <option value="">All</option>
            {icps.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </div>
        {sp.icp && (
          <div className="flex flex-col">
            <label className="label">Stage</label>
            <select name="stage" defaultValue={sp.stage ?? ""} className="input w-40">
              <option value="">All</option>
              {stagesForFilter.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col">
          <label className="label">Score</label>
          <select name="bucket" defaultValue={sp.bucket ?? ""} className="input w-32">
            <option value="">All</option>
            <option value="A">A — Hot</option>
            <option value="B">B — Warm</option>
            <option value="C">C — Cold</option>
          </select>
        </div>
        <div className="flex flex-col">
          <label className="label">Source</label>
          <select name="source" defaultValue={sp.source ?? ""} className="input w-36">
            <option value="">All</option>
            {["LINKEDIN", "APOLLO", "REFERRAL", "EVENT", "MANUAL", "CSV", "OTHER"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-1.5 text-sm pl-2">
          <input type="checkbox" name="mine" value="1" defaultChecked={sp.mine === "1"} />
          Mine only
        </label>
        <button className="btn-secondary btn-sm">Apply</button>
        <Link href="/leads" className="btn-ghost btn-sm">Reset</Link>
      </form>

      {leads.length === 0 ? (
        <div className="card p-10 text-center">
          <h2 className="font-semibold">No leads match these filters.</h2>
          <p className="text-sm text-muted mt-1">
            <Link href="/leads" className="text-brand">Clear filters</Link>
            {" or "}
            <Link href="/leads/new" className="text-brand">add your first lead</Link>.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="table-base">
            <thead>
              <tr>
                <th>Company</th>
                <th>ICP</th>
                <th>Stage</th>
                <th>Score</th>
                <th>Owner</th>
                <th>Source</th>
                <th>Channels</th>
                <th>Last activity</th>
                <th>Next due</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => {
                const bucket = scoreBucket(l.score);
                return (
                  <tr key={l.id}>
                    <td>
                      <Link href={`/leads/${l.id}`} className="font-medium hover:text-brand">
                        {l.companyName}
                      </Link>
                      {l.contactEmail && (
                        <div className="text-xs text-muted">{l.contactEmail}</div>
                      )}
                    </td>
                    <td>
                      <span
                        className="pill"
                        style={{ background: `${l.icp.color}1a`, color: l.icp.color }}
                      >
                        {l.icp.name}
                      </span>
                    </td>
                    <td>{l.stage.name}</td>
                    <td>
                      <span
                        className={
                          bucket === "A"
                            ? "pill-green"
                            : bucket === "B"
                              ? "pill-amber"
                              : "pill-red"
                        }
                      >
                        {l.score}
                      </span>
                    </td>
                    <td>{l.assignedTo?.name ?? "—"}</td>
                    <td className="text-xs">{l.leadSource}</td>
                    <td>
                      <ChannelBadges attempts={l.contactAttempts} />
                    </td>
                    <td className="text-xs text-muted">{relativeTime(l.lastActivityAt)}</td>
                    <td className="text-xs">
                      {l.nextActionDue
                        ? new Date(l.nextActionDue).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={{ query: { ...sp, page: page - 1 } }}
                className="btn-secondary btn-sm"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={{ query: { ...sp, page: page + 1 } }}
                className="btn-secondary btn-sm"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ChannelBadges({
  attempts,
}: {
  attempts: { channel: string; direction: string; status: string }[];
}) {
  const summary = summarizeAttempts(attempts);
  const visible = CHANNELS.filter(
    (c) =>
      REQUIRED_CHANNELS.includes(c.value as Channel) ||
      summary.find((s) => s.channel === c.value && s.attempts > 0),
  );
  if (visible.length === 0) return <span className="text-xs text-muted">—</span>;
  return (
    <div className="flex items-center gap-1">
      {visible.map((c) => {
        const s = summary.find((x) => x.channel === c.value)!;
        const tone =
          s.hasResponse
            ? "bg-success/15 text-success"
            : s.attempts > 0
              ? "bg-warning/15 text-warning"
              : "bg-slate-200 text-slate-500";
        return (
          <span
            key={c.value}
            title={`${c.label}: ${s.attempts} sent${s.hasResponse ? ", replied" : ""}`}
            className={`inline-flex items-center justify-center min-w-7 h-5 rounded-full px-1.5 text-[10px] font-semibold ${tone}`}
          >
            {c.label.slice(0, 1)}
            {s.attempts > 0 && <span className="ml-0.5">{s.attempts}</span>}
          </span>
        );
      })}
    </div>
  );
}
