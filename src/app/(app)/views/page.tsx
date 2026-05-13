import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/json";
import { filterToQuery, type SavedFilter } from "@/lib/savedView";
import { Bookmark, Trash2, ExternalLink, Share2 } from "lucide-react";
import ViewActions from "./ViewActions";

export default async function ViewsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [mine, shared, icps, stages] = await Promise.all([
    prisma.savedView.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.savedView.findMany({
      where: { isShared: true, NOT: { userId } },
      orderBy: { updatedAt: "desc" },
      include: { user: { select: { name: true } } },
    }),
    prisma.icp.findMany({ select: { id: true, name: true, color: true } }),
    prisma.icpStage.findMany({ select: { id: true, name: true } }),
  ]);

  const icpMap = new Map(icps.map((i) => [i.id, i]));
  const stageMap = new Map(stages.map((s) => [s.id, s]));

  function summarize(filter: SavedFilter): string[] {
    const bits: string[] = [];
    if (filter.q) bits.push(`search "${filter.q}"`);
    if (filter.icp) bits.push(`ICP: ${icpMap.get(filter.icp)?.name ?? "?"}`);
    if (filter.stage) bits.push(`stage: ${stageMap.get(filter.stage)?.name ?? "?"}`);
    if (filter.bucket) bits.push(`score: ${filter.bucket}`);
    if (filter.source) bits.push(`source: ${filter.source}`);
    if (filter.mine === "1") bits.push("mine only");
    return bits.length ? bits : ["no filters"];
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Saved Views</h1>
          <p className="text-sm text-muted">
            Reusable filter combinations for the Leads page. Save from /leads via the &ldquo;Save view&rdquo; button.
          </p>
        </div>
        <Link href="/leads" className="btn-primary btn-sm">
          <ExternalLink className="size-4" /> Go to Leads
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">My views</h2>
        {mine.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted">
            No saved views yet. Apply filters on{" "}
            <Link href="/leads" className="text-brand">/leads</Link> and click &ldquo;Save view&rdquo;.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {mine.map((v) => {
              const filter = parseJson<SavedFilter>(v.filterConfig, {} as SavedFilter);
              const qs = filterToQuery(filter);
              return (
                <div key={v.id} className="card p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <Bookmark className="size-4 text-brand mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{v.name}</div>
                      <div className="text-xs text-muted mt-0.5 line-clamp-2">
                        {summarize(filter).join(" · ")}
                      </div>
                    </div>
                    {v.isShared && (
                      <span title="Shared with team" className="text-muted">
                        <Share2 className="size-3" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <Link
                      href={`/leads${qs ? `?${qs}` : ""}`}
                      className="text-xs text-brand font-medium"
                    >
                      Open →
                    </Link>
                    <ViewActions id={v.id} initial={{ name: v.name, isShared: v.isShared }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
          Shared by team
        </h2>
        {shared.length === 0 ? (
          <div className="card p-6 text-center text-sm text-muted">
            No team-shared views yet.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {shared.map((v) => {
              const filter = parseJson<SavedFilter>(v.filterConfig, {} as SavedFilter);
              const qs = filterToQuery(filter);
              return (
                <div key={v.id} className="card p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <Share2 className="size-4 text-brand-accent mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{v.name}</div>
                      <div className="text-xs text-muted mt-0.5 line-clamp-2">
                        {summarize(filter).join(" · ")}
                      </div>
                      <div className="text-[10px] text-muted mt-1">
                        by {v.user.name}
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/leads${qs ? `?${qs}` : ""}`}
                    className="text-xs text-brand font-medium"
                  >
                    Open →
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
