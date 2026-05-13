import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Download } from "lucide-react";
import PrintButton from "./PrintButton";

type SP = Promise<{ range?: string }>;

const RANGES: { id: string; label: string; days: number | null }[] = [
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "90d", label: "Last 90 days", days: 90 },
  { id: "all", label: "All time", days: null },
];

export default async function ReportsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const session = await auth();
  const range = RANGES.find((r) => r.id === sp.range) ?? RANGES[1];
  const since = range.days
    ? new Date(Date.now() - range.days * 24 * 3600 * 1000)
    : new Date(0);

  // Reports are admin/manager. Reps see their own scope (mostly via dashboard).
  const isPrivileged = session!.user.role === "ADMIN" || session!.user.role === "MANAGER";

  // ---- Per-rep performance ----
  const repAdded = await prisma.lead.groupBy({
    by: ["assignedToId"],
    where: {
      status: "ACTIVE",
      createdAt: { gte: since },
      ...(isPrivileged ? {} : { assignedToId: session!.user.id }),
    },
    _count: true,
    _avg: { score: true },
  });
  const repIds = repAdded.map((r) => r.assignedToId).filter((id): id is string => !!id);

  const repWon = await prisma.lead.groupBy({
    by: ["assignedToId"],
    where: { stage: { isWon: true }, updatedAt: { gte: since }, assignedToId: { in: repIds } },
    _count: true,
  });
  const repLost = await prisma.lead.groupBy({
    by: ["assignedToId"],
    where: { stage: { isLost: true }, updatedAt: { gte: since }, assignedToId: { in: repIds } },
    _count: true,
  });
  const repQualified = await prisma.lead.groupBy({
    by: ["assignedToId"],
    where: {
      stage: { name: "Qualified" },
      updatedAt: { gte: since },
      assignedToId: { in: repIds },
    },
    _count: true,
  });
  const repAttempts = await prisma.contactAttempt.groupBy({
    by: ["performedById"],
    where: {
      occurredAt: { gte: since },
      performedById: { in: repIds },
    },
    _count: true,
  });
  const reps = await prisma.user.findMany({
    where: { id: { in: repIds } },
    select: { id: true, name: true, role: true, email: true },
  });
  const repsById = new Map(reps.map((u) => [u.id, u]));
  const wonById = new Map(repWon.map((r) => [r.assignedToId!, r._count]));
  const lostById = new Map(repLost.map((r) => [r.assignedToId!, r._count]));
  const qualById = new Map(repQualified.map((r) => [r.assignedToId!, r._count]));
  const attemptsByRep = new Map(repAttempts.map((r) => [r.performedById, r._count]));

  const repRows = repAdded
    .filter((r) => r.assignedToId)
    .map((r) => {
      const u = repsById.get(r.assignedToId!);
      const added = r._count;
      const won = wonById.get(r.assignedToId!) ?? 0;
      const lost = lostById.get(r.assignedToId!) ?? 0;
      const qualified = qualById.get(r.assignedToId!) ?? 0;
      const winRate = added > 0 ? Math.round((won / added) * 100) : 0;
      const qualRate = added > 0 ? Math.round((qualified / added) * 100) : 0;
      return {
        id: r.assignedToId!,
        name: u?.name ?? "Unknown",
        role: u?.role ?? "—",
        added,
        qualified,
        won,
        lost,
        qualRate,
        winRate,
        avgScore: Math.round(r._avg.score ?? 0),
        attempts: attemptsByRep.get(r.assignedToId!) ?? 0,
      };
    })
    .sort((a, b) => b.won - a.won || b.added - a.added);

  // ---- Per-ICP performance ----
  const icpAdded = await prisma.lead.groupBy({
    by: ["icpId"],
    where: { status: "ACTIVE", createdAt: { gte: since } },
    _count: true,
    _avg: { score: true },
  });
  const icpIds = icpAdded.map((r) => r.icpId);
  const icps = await prisma.icp.findMany({
    where: { id: { in: icpIds } },
    select: { id: true, name: true, color: true },
  });
  const icpById = new Map(icps.map((i) => [i.id, i]));
  const icpWon = await prisma.lead.groupBy({
    by: ["icpId"],
    where: { stage: { isWon: true }, updatedAt: { gte: since }, icpId: { in: icpIds } },
    _count: true,
  });
  const icpLost = await prisma.lead.groupBy({
    by: ["icpId"],
    where: { stage: { isLost: true }, updatedAt: { gte: since }, icpId: { in: icpIds } },
    _count: true,
  });
  const icpQual = await prisma.lead.groupBy({
    by: ["icpId"],
    where: { stage: { name: "Qualified" }, updatedAt: { gte: since }, icpId: { in: icpIds } },
    _count: true,
  });
  const wonByIcp = new Map(icpWon.map((r) => [r.icpId, r._count]));
  const lostByIcp = new Map(icpLost.map((r) => [r.icpId, r._count]));
  const qualByIcp = new Map(icpQual.map((r) => [r.icpId, r._count]));

  const icpRows = icpAdded
    .map((r) => {
      const i = icpById.get(r.icpId);
      const added = r._count;
      const won = wonByIcp.get(r.icpId) ?? 0;
      const lost = lostByIcp.get(r.icpId) ?? 0;
      const qual = qualByIcp.get(r.icpId) ?? 0;
      return {
        id: r.icpId,
        name: i?.name ?? "Unknown",
        color: i?.color ?? "#94A3B8",
        added,
        qualified: qual,
        won,
        lost,
        qualRate: added > 0 ? Math.round((qual / added) * 100) : 0,
        winRate: added > 0 ? Math.round((won / added) * 100) : 0,
        avgScore: Math.round(r._avg.score ?? 0),
      };
    })
    .sort((a, b) => b.won - a.won || b.added - a.added);

  // ---- Source ROI ----
  const sourceAdded = await prisma.lead.groupBy({
    by: ["leadSource"],
    where: { status: "ACTIVE", createdAt: { gte: since } },
    _count: true,
    _avg: { score: true },
  });
  const sources = sourceAdded.map((s) => s.leadSource);
  const sourceWon = await prisma.lead.groupBy({
    by: ["leadSource"],
    where: { stage: { isWon: true }, updatedAt: { gte: since }, leadSource: { in: sources } },
    _count: true,
  });
  const sourceQual = await prisma.lead.groupBy({
    by: ["leadSource"],
    where: { stage: { name: "Qualified" }, updatedAt: { gte: since }, leadSource: { in: sources } },
    _count: true,
  });
  const wonBySource = new Map(sourceWon.map((s) => [s.leadSource, s._count]));
  const qualBySource = new Map(sourceQual.map((s) => [s.leadSource, s._count]));
  const sourceRows = sourceAdded
    .map((s) => {
      const added = s._count;
      const won = wonBySource.get(s.leadSource) ?? 0;
      const qual = qualBySource.get(s.leadSource) ?? 0;
      return {
        source: s.leadSource,
        added,
        qualified: qual,
        won,
        qualRate: added > 0 ? Math.round((qual / added) * 100) : 0,
        winRate: added > 0 ? Math.round((won / added) * 100) : 0,
        avgScore: Math.round(s._avg.score ?? 0),
      };
    })
    .sort((a, b) => b.added - a.added);

  // ---- Pipeline funnel (rolled up by stage name) ----
  const stageRollups = await prisma.lead.groupBy({
    by: ["stageId"],
    where: { status: "ACTIVE", createdAt: { gte: since } },
    _count: true,
  });
  const stageMeta = await prisma.icpStage.findMany({
    where: { id: { in: stageRollups.map((s) => s.stageId) } },
    select: { id: true, name: true, sortOrder: true, isWon: true, isLost: true },
  });
  const stageById = new Map(stageMeta.map((s) => [s.id, s]));
  const funnelMap = new Map<
    string,
    { count: number; sortOrder: number; isWon: boolean; isLost: boolean }
  >();
  for (const row of stageRollups) {
    const meta = stageById.get(row.stageId);
    if (!meta) continue;
    const existing = funnelMap.get(meta.name) ?? {
      count: 0,
      sortOrder: meta.sortOrder,
      isWon: meta.isWon,
      isLost: meta.isLost,
    };
    existing.count += row._count;
    funnelMap.set(meta.name, existing);
  }
  const funnel = Array.from(funnelMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const funnelTop = funnel[0]?.count ?? 0;

  // ---- Channel coverage rollup ----
  const channelCounts = await prisma.contactAttempt.groupBy({
    by: ["channel", "status"],
    where: { occurredAt: { gte: since } },
    _count: true,
  });
  const channelTotals = new Map<string, { sent: number; replied: number }>();
  for (const c of channelCounts) {
    const slot = channelTotals.get(c.channel) ?? { sent: 0, replied: 0 };
    slot.sent += c._count;
    if (c.status === "RESPONDED") slot.replied += c._count;
    channelTotals.set(c.channel, slot);
  }
  const channelRows = Array.from(channelTotals.entries())
    .map(([channel, v]) => ({
      channel,
      sent: v.sent,
      replied: v.replied,
      replyRate: v.sent > 0 ? Math.round((v.replied / v.sent) * 100) : 0,
    }))
    .sort((a, b) => b.sent - a.sent);

  // Totals across rep table for the footer row
  const totalRow = repRows.reduce(
    (acc, r) => {
      acc.added += r.added;
      acc.qualified += r.qualified;
      acc.won += r.won;
      acc.lost += r.lost;
      acc.attempts += r.attempts;
      return acc;
    },
    { added: 0, qualified: 0, won: 0, lost: 0, attempts: 0 },
  );

  return (
    <div className="space-y-6 print:space-y-3">
      <div className="flex items-end justify-between gap-4 flex-wrap print:hidden">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-muted">
            Period: {range.label}. Tables export as CSV; full page is printable.
          </p>
        </div>
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex gap-1 text-sm">
            {RANGES.map((r) => (
              <Link
                key={r.id}
                href={`/reports?range=${r.id}`}
                className={`px-3 py-1.5 rounded-md ${
                  range.id === r.id
                    ? "bg-brand text-white"
                    : "bg-white border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {r.label}
              </Link>
            ))}
          </div>
          <a
            href={`/api/export/leads?`}
            className="btn-secondary"
            title="Export all leads as CSV"
          >
            <Download className="size-4" /> Export leads
          </a>
          <PrintButton />
        </div>
      </div>

      <div className="hidden print:block">
        <h1 className="text-xl font-semibold">Lead Generation Report — {range.label}</h1>
        <div className="text-xs text-muted">Generated {new Date().toLocaleString()}</div>
      </div>

      {/* Per-rep table */}
      <section className="card overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Per-rep performance</h2>
            <p className="text-xs text-muted">
              Leads added, qualified, won, lost, and avg score in {range.label.toLowerCase()}.
            </p>
          </div>
        </div>
        {repRows.length === 0 ? (
          <p className="p-5 text-sm text-muted">No assigned activity in this range.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Rep</th>
                <th>Role</th>
                <th className="text-right">Added</th>
                <th className="text-right">Qualified</th>
                <th className="text-right">Won</th>
                <th className="text-right">Lost</th>
                <th className="text-right">Outreach</th>
                <th className="text-right">Qual %</th>
                <th className="text-right">Win %</th>
                <th className="text-right">Avg score</th>
              </tr>
            </thead>
            <tbody>
              {repRows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.name}</td>
                  <td className="text-xs text-muted">{r.role}</td>
                  <td className="text-right tabular-nums">{r.added}</td>
                  <td className="text-right tabular-nums">{r.qualified}</td>
                  <td className="text-right tabular-nums text-success">{r.won}</td>
                  <td className="text-right tabular-nums text-danger">{r.lost}</td>
                  <td className="text-right tabular-nums">{r.attempts}</td>
                  <td className="text-right tabular-nums">{r.qualRate}%</td>
                  <td className="text-right tabular-nums">{r.winRate}%</td>
                  <td className="text-right">
                    <span
                      className={
                        r.avgScore >= 80 ? "pill-green" :
                        r.avgScore >= 50 ? "pill-amber" :
                        "pill-red"
                      }
                    >
                      {r.avgScore}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="font-medium bg-slate-50">
                <td colSpan={2}>Total</td>
                <td className="text-right tabular-nums">{totalRow.added}</td>
                <td className="text-right tabular-nums">{totalRow.qualified}</td>
                <td className="text-right tabular-nums">{totalRow.won}</td>
                <td className="text-right tabular-nums">{totalRow.lost}</td>
                <td className="text-right tabular-nums">{totalRow.attempts}</td>
                <td className="text-right tabular-nums">
                  {totalRow.added ? Math.round((totalRow.qualified / totalRow.added) * 100) : 0}%
                </td>
                <td className="text-right tabular-nums">
                  {totalRow.added ? Math.round((totalRow.won / totalRow.added) * 100) : 0}%
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
        )}
      </section>

      {/* Per-ICP table */}
      <section className="card overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h2 className="font-semibold">Per-ICP performance</h2>
          <p className="text-xs text-muted">
            Where leads are coming in and how each ICP is converting.
          </p>
        </div>
        {icpRows.length === 0 ? (
          <p className="p-5 text-sm text-muted">No leads in this range.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>ICP</th>
                <th className="text-right">Added</th>
                <th className="text-right">Qualified</th>
                <th className="text-right">Won</th>
                <th className="text-right">Lost</th>
                <th className="text-right">Qual %</th>
                <th className="text-right">Win %</th>
                <th className="text-right">Avg score</th>
              </tr>
            </thead>
            <tbody>
              {icpRows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="inline-flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ background: r.color }} />
                      {r.name}
                    </span>
                  </td>
                  <td className="text-right tabular-nums">{r.added}</td>
                  <td className="text-right tabular-nums">{r.qualified}</td>
                  <td className="text-right tabular-nums text-success">{r.won}</td>
                  <td className="text-right tabular-nums text-danger">{r.lost}</td>
                  <td className="text-right tabular-nums">{r.qualRate}%</td>
                  <td className="text-right tabular-nums">{r.winRate}%</td>
                  <td className="text-right">
                    <span
                      className={
                        r.avgScore >= 80 ? "pill-green" :
                        r.avgScore >= 50 ? "pill-amber" :
                        "pill-red"
                      }
                    >
                      {r.avgScore}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Source ROI */}
      <section className="card overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h2 className="font-semibold">Source ROI</h2>
          <p className="text-xs text-muted">Which sources bring the best leads.</p>
        </div>
        {sourceRows.length === 0 ? (
          <p className="p-5 text-sm text-muted">No leads in this range.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Source</th>
                <th className="text-right">Added</th>
                <th className="text-right">Qualified</th>
                <th className="text-right">Won</th>
                <th className="text-right">Qual %</th>
                <th className="text-right">Win %</th>
                <th className="text-right">Avg score</th>
              </tr>
            </thead>
            <tbody>
              {sourceRows.map((r) => (
                <tr key={r.source}>
                  <td className="font-medium">{r.source}</td>
                  <td className="text-right tabular-nums">{r.added}</td>
                  <td className="text-right tabular-nums">{r.qualified}</td>
                  <td className="text-right tabular-nums text-success">{r.won}</td>
                  <td className="text-right tabular-nums">{r.qualRate}%</td>
                  <td className="text-right tabular-nums">{r.winRate}%</td>
                  <td className="text-right">
                    <span
                      className={
                        r.avgScore >= 80 ? "pill-green" :
                        r.avgScore >= 50 ? "pill-amber" :
                        "pill-red"
                      }
                    >
                      {r.avgScore}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        {/* Pipeline funnel */}
        <div className="card p-5">
          <h2 className="font-semibold">Pipeline funnel</h2>
          <p className="text-xs text-muted mb-3">
            New leads created in {range.label.toLowerCase()}, by current stage. Drop-off shows what % carried over from the prior stage.
          </p>
          {funnel.length === 0 ? (
            <p className="text-sm text-muted">No leads in this range.</p>
          ) : (
            <div className="space-y-2">
              {funnel.map((s, i) => {
                const pctOfTop = funnelTop > 0 ? (s.count / funnelTop) * 100 : 0;
                const prev = i > 0 ? funnel[i - 1].count : null;
                const carry = prev !== null && prev > 0 ? Math.round((s.count / prev) * 100) : null;
                return (
                  <div key={s.name} className="space-y-0.5">
                    <div className="flex justify-between text-xs">
                      <span>{s.name}</span>
                      <span className="text-muted">
                        {s.count}{carry !== null ? ` · ${carry}% carry` : ""}
                      </span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded">
                      <div
                        className={`h-full rounded ${s.isWon ? "bg-success" : s.isLost ? "bg-danger" : "bg-brand"}`}
                        style={{ width: `${Math.max(2, pctOfTop)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Channel reply rates */}
        <div className="card p-5">
          <h2 className="font-semibold">Outreach by channel</h2>
          <p className="text-xs text-muted mb-3">
            How many touches went out per channel and how many got a reply.
          </p>
          {channelRows.length === 0 ? (
            <p className="text-sm text-muted">No outreach logged in this range.</p>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th className="text-right">Sent</th>
                  <th className="text-right">Replied</th>
                  <th className="text-right">Reply %</th>
                </tr>
              </thead>
              <tbody>
                {channelRows.map((c) => (
                  <tr key={c.channel}>
                    <td className="font-medium">{c.channel}</td>
                    <td className="text-right tabular-nums">{c.sent}</td>
                    <td className="text-right tabular-nums">{c.replied}</td>
                    <td className="text-right tabular-nums">{c.replyRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

