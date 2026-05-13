import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { ArrowUpRight, TrendingUp } from "lucide-react";
import { leadScopeWhere } from "@/lib/scope";

type SP = Promise<{ range?: string }>;

const RANGES: { id: string; label: string; days: number | null }[] = [
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "90d", label: "Last 90 days", days: 90 },
  { id: "all", label: "All time", days: null },
];

export default async function DashboardPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const session = await auth();
  const role = session!.user.role;
  const userId = session!.user.id;

  const range = RANGES.find((r) => r.id === sp.range) ?? RANGES[1];
  const since = range.days
    ? new Date(Date.now() - range.days * 24 * 3600 * 1000)
    : new Date(0);

  // Personal scope toggles for REP without lead.viewAll. (Reps with viewAll
  // see team-wide metrics like Manager/Admin.)
  const scope = await leadScopeWhere(role, userId);

  const [
    totalActive,
    newInRange,
    qualifiedInRange,
    wonInRange,
    lostInRange,
    avgScoreAgg,
    hotCount,
    pipelineByStage,
    sourceBreakdown,
    icpBreakdown,
    leadVolumeRaw,
    repLeaderboardRaw,
    icpsForQuality,
  ] = await Promise.all([
    prisma.lead.count({ where: { status: "ACTIVE", ...scope } }),
    prisma.lead.count({
      where: { status: "ACTIVE", ...scope, createdAt: { gte: since } },
    }),
    prisma.lead.count({
      where: { status: "ACTIVE", ...scope, stage: { name: "Qualified" }, updatedAt: { gte: since } },
    }),
    prisma.lead.count({
      where: { status: "ACTIVE", ...scope, stage: { isWon: true }, updatedAt: { gte: since } },
    }),
    prisma.lead.count({
      where: { status: "ACTIVE", ...scope, stage: { isLost: true }, updatedAt: { gte: since } },
    }),
    prisma.lead.aggregate({
      _avg: { score: true },
      where: { status: "ACTIVE", ...scope },
    }),
    prisma.lead.count({
      where: { status: "ACTIVE", ...scope, score: { gte: 80 } },
    }),
    // Pipeline by stage — count per stage name across all ICPs
    prisma.lead.groupBy({
      by: ["stageId"],
      where: { status: "ACTIVE", ...scope },
      _count: true,
    }),
    prisma.lead.groupBy({
      by: ["leadSource"],
      where: { status: "ACTIVE", ...scope, createdAt: { gte: since } },
      _count: true,
    }),
    prisma.lead.groupBy({
      by: ["icpId"],
      where: { status: "ACTIVE", ...scope },
      _count: true,
    }),
    prisma.lead.findMany({
      where: { status: "ACTIVE", ...scope, createdAt: { gte: since } },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.lead.groupBy({
      by: ["assignedToId"],
      where: { status: "ACTIVE", createdAt: { gte: since } },
      _count: true,
      _avg: { score: true },
    }),
    prisma.icp.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, color: true },
    }),
  ]);

  // Resolve stage IDs to names for pipeline funnel
  const stageMap = await prisma.icpStage.findMany({
    where: { id: { in: pipelineByStage.map((p) => p.stageId) } },
    select: { id: true, name: true, sortOrder: true, isWon: true, isLost: true },
  });
  const stageById = new Map(stageMap.map((s) => [s.id, s]));
  const pipelineRollup = new Map<string, { count: number; sortOrder: number; isTerminal: boolean }>();
  for (const row of pipelineByStage) {
    const s = stageById.get(row.stageId);
    if (!s) continue;
    const existing = pipelineRollup.get(s.name) ?? {
      count: 0,
      sortOrder: s.sortOrder,
      isTerminal: s.isWon || s.isLost,
    };
    existing.count += row._count;
    pipelineRollup.set(s.name, existing);
  }
  const pipeline = Array.from(pipelineRollup.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const pipelineMax = Math.max(1, ...pipeline.map((p) => p.count));

  // ICP rollup with names + colors
  const icpById = new Map(icpsForQuality.map((i) => [i.id, i]));
  const icpRows = icpBreakdown
    .map((row) => ({
      id: row.icpId,
      name: icpById.get(row.icpId)?.name ?? "Unknown",
      color: icpById.get(row.icpId)?.color ?? "#94A3B8",
      count: row._count,
    }))
    .sort((a, b) => b.count - a.count);
  const icpMax = Math.max(1, ...icpRows.map((r) => r.count));

  // Per-day volume for line chart
  const volumeByDay = new Map<string, number>();
  for (const lead of leadVolumeRaw) {
    const key = new Date(lead.createdAt).toISOString().slice(0, 10);
    volumeByDay.set(key, (volumeByDay.get(key) ?? 0) + 1);
  }
  const days = range.days ?? 30;
  const volumeSeries: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10);
    volumeSeries.push({ date: d, count: volumeByDay.get(d) ?? 0 });
  }
  const volumeMax = Math.max(1, ...volumeSeries.map((v) => v.count));

  // Per-rep leaderboard
  const repIds = repLeaderboardRaw
    .map((r) => r.assignedToId)
    .filter((id): id is string => !!id);
  const reps = await prisma.user.findMany({
    where: { id: { in: repIds } },
    select: { id: true, name: true, email: true, role: true },
  });
  const repsById = new Map(reps.map((r) => [r.id, r]));

  // Per-rep won/qualified counts
  const wonPerRep = await prisma.lead.groupBy({
    by: ["assignedToId"],
    where: {
      status: "ACTIVE",
      stage: { isWon: true },
      updatedAt: { gte: since },
      assignedToId: { in: repIds },
    },
    _count: true,
  });
  const qualifiedPerRep = await prisma.lead.groupBy({
    by: ["assignedToId"],
    where: {
      status: "ACTIVE",
      stage: { name: "Qualified" },
      updatedAt: { gte: since },
      assignedToId: { in: repIds },
    },
    _count: true,
  });
  const wonByRep = new Map(wonPerRep.map((r) => [r.assignedToId!, r._count]));
  const qualifiedByRep = new Map(qualifiedPerRep.map((r) => [r.assignedToId!, r._count]));

  const leaderboard = repLeaderboardRaw
    .filter((r) => r.assignedToId)
    .map((r) => {
      const u = repsById.get(r.assignedToId!);
      return {
        id: r.assignedToId!,
        name: u?.name ?? "Unassigned",
        role: u?.role ?? "—",
        added: r._count,
        avgScore: Math.round(r._avg.score ?? 0),
        qualified: qualifiedByRep.get(r.assignedToId!) ?? 0,
        won: wonByRep.get(r.assignedToId!) ?? 0,
      };
    })
    .sort((a, b) => b.added - a.added);

  // Lead-quality bucketing
  const aBucket = await prisma.lead.count({
    where: { status: "ACTIVE", ...scope, score: { gte: 80 } },
  });
  const bBucket = await prisma.lead.count({
    where: { status: "ACTIVE", ...scope, score: { gte: 50, lte: 79 } },
  });
  const cBucket = await prisma.lead.count({
    where: { status: "ACTIVE", ...scope, score: { lte: 49 } },
  });
  const totalForBuckets = aBucket + bBucket + cBucket;

  // Conversion rates
  const conversionNewToQualified =
    newInRange > 0 ? Math.round((qualifiedInRange / newInRange) * 100) : 0;
  const conversionQualifiedToWon =
    qualifiedInRange > 0 ? Math.round((wonInRange / qualifiedInRange) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted">Live KPIs across {role === "REP" ? "your" : "all"} active leads.</p>
        </div>
        <div className="flex gap-1 text-sm">
          {RANGES.map((r) => (
            <Link
              key={r.id}
              href={`/dashboard?range=${r.id}`}
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
      </div>

      {/* Top tiles */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Tile label="Total Leads" value={totalActive} />
        <Tile label="New" value={newInRange} sub={range.label.toLowerCase()} />
        <Tile label="Qualified" value={qualifiedInRange} />
        <Tile label="Won" value={wonInRange} tone="good" />
        <Tile label="Lost" value={lostInRange} tone="bad" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Avg. Lead Score" value={Math.round(avgScoreAgg._avg.score ?? 0)} />
        <Tile label="Hot Leads (A)" value={hotCount} sub={`${totalActive ? Math.round((hotCount / totalActive) * 100) : 0}% of active`} />
        <Tile
          label="New → Qualified"
          value={`${conversionNewToQualified}%`}
          sub={`${qualifiedInRange}/${newInRange}`}
        />
        <Tile
          label="Qualified → Won"
          value={`${conversionQualifiedToWon}%`}
          sub={`${wonInRange}/${qualifiedInRange}`}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Pipeline funnel */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold">Pipeline by stage</h2>
              <p className="text-xs text-muted">Active leads grouped by stage name across all ICPs.</p>
            </div>
            <Link href="/leads" className="text-xs text-brand inline-flex items-center gap-0.5">
              View leads <ArrowUpRight className="size-3" />
            </Link>
          </div>
          {pipeline.length === 0 ? (
            <p className="text-sm text-muted">No leads yet.</p>
          ) : (
            <div className="space-y-2">
              {pipeline.map((p) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="text-xs w-32 shrink-0 truncate">{p.name}</span>
                  <div className="flex-1 h-6 bg-slate-100 rounded-md overflow-hidden">
                    <div
                      className={`h-full ${p.isTerminal ? "bg-success/70" : "bg-brand"}`}
                      style={{ width: `${(p.count / pipelineMax) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium tabular-nums w-10 text-right">{p.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lead quality buckets */}
        <div className="card p-5">
          <h2 className="font-semibold">Lead quality</h2>
          <p className="text-xs text-muted mb-3">Distribution by score bucket.</p>
          {totalForBuckets === 0 ? (
            <p className="text-sm text-muted">No leads scored yet.</p>
          ) : (
            <div className="space-y-2">
              <BucketBar label="A — Hot (80+)" count={aBucket} total={totalForBuckets} colorClass="bg-success" />
              <BucketBar label="B — Warm (50–79)" count={bBucket} total={totalForBuckets} colorClass="bg-warning" />
              <BucketBar label="C — Cold (<50)" count={cBucket} total={totalForBuckets} colorClass="bg-danger" />
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Lead volume over time */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold">Lead volume</h2>
              <p className="text-xs text-muted">New leads created per day, {range.label.toLowerCase()}.</p>
            </div>
            <span className="text-xs text-muted inline-flex items-center gap-1">
              <TrendingUp className="size-3" /> peak {volumeMax}/day
            </span>
          </div>
          <div className="flex items-end gap-px h-32">
            {volumeSeries.map((v) => (
              <div
                key={v.date}
                className="flex-1 bg-brand/80 hover:bg-brand transition-colors rounded-sm relative group"
                style={{ height: `${(v.count / volumeMax) * 100}%`, minHeight: v.count > 0 ? 2 : 0 }}
                title={`${v.date}: ${v.count}`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted mt-1">
            <span>{volumeSeries[0]?.date}</span>
            <span>{volumeSeries[volumeSeries.length - 1]?.date}</span>
          </div>
        </div>

        {/* Source breakdown */}
        <div className="card p-5">
          <h2 className="font-semibold">By source</h2>
          <p className="text-xs text-muted mb-3">{range.label.toLowerCase()}</p>
          {sourceBreakdown.length === 0 ? (
            <p className="text-sm text-muted">No leads in range.</p>
          ) : (
            <div className="space-y-2">
              {sourceBreakdown.map((s) => {
                const total = sourceBreakdown.reduce((a, b) => a + b._count, 0);
                const pct = total ? Math.round((s._count / total) * 100) : 0;
                return (
                  <div key={s.leadSource} className="space-y-0.5">
                    <div className="flex justify-between text-xs">
                      <span>{s.leadSource}</span>
                      <span className="text-muted">{s._count} · {pct}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded">
                      <div className="h-full bg-brand-accent rounded" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* By ICP */}
      <div className="card p-5">
        <h2 className="font-semibold mb-3">Leads by ICP</h2>
        {icpRows.length === 0 ? (
          <p className="text-sm text-muted">No leads yet.</p>
        ) : (
          <div className="space-y-2">
            {icpRows.map((i) => (
              <div key={i.id} className="flex items-center gap-3">
                <span className="size-3 rounded-full shrink-0" style={{ background: i.color }} />
                <span className="text-sm flex-1 truncate">{i.name}</span>
                <div className="w-64 h-2 bg-slate-100 rounded">
                  <div
                    className="h-full rounded"
                    style={{ background: i.color, width: `${(i.count / icpMax) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium tabular-nums w-10 text-right">{i.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-rep leaderboard */}
      {(role === "ADMIN" || role === "MANAGER") && (
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Rep leaderboard</h2>
              <p className="text-xs text-muted">Activity in {range.label.toLowerCase()}.</p>
            </div>
          </div>
          {leaderboard.length === 0 ? (
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
                  <th className="text-right">Avg score</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.name}</td>
                    <td className="text-xs text-muted">{r.role}</td>
                    <td className="text-right tabular-nums">{r.added}</td>
                    <td className="text-right tabular-nums">{r.qualified}</td>
                    <td className="text-right tabular-nums">{r.won}</td>
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
        </div>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone?: "good" | "bad";
}) {
  const valueClass =
    tone === "good"
      ? "text-success"
      : tone === "bad"
        ? "text-danger"
        : "text-brand-navy";
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${valueClass}`}>{value}</div>
      {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function BucketBar({
  label,
  count,
  total,
  colorClass,
}: {
  label: string;
  count: number;
  total: number;
  colorClass: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="text-muted tabular-nums">{count} · {pct}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded">
        <div className={`h-full rounded ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
