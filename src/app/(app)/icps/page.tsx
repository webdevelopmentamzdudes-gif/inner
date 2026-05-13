import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { icpScopeWhere } from "@/lib/scope";
import { Plus, Target } from "lucide-react";

export default async function IcpListPage() {
  const session = await auth();
  const role = session!.user.role;
  const canManage = await can(role, "icp.manage");
  const scopeWhere = await icpScopeWhere(role, session!.user.id);

  const icps = await prisma.icp.findMany({
    where: scopeWhere,
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { leads: true, criteria: true, stages: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">ICPs</h1>
          <p className="text-sm text-muted">Ideal Customer Profiles — criteria, weights, pipeline stages.</p>
        </div>
        {canManage && (
          <Link href="/icps/new" className="btn-primary">
            <Plus className="size-4" /> New ICP
          </Link>
        )}
      </div>

      {icps.length === 0 ? (
        <div className="card p-10 text-center">
          <Target className="size-8 mx-auto text-muted" />
          <h2 className="mt-3 font-semibold">No ICPs yet</h2>
          <p className="text-sm text-muted mt-1">
            Create your first ICP to start qualifying leads.
          </p>
          {canManage && (
            <Link href="/icps/new" className="btn-primary mt-4">
              <Plus className="size-4" /> Create your first ICP
            </Link>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {icps.map((icp) => (
            <Link
              key={icp.id}
              href={`/icps/${icp.id}`}
              className="card p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <span
                  className="size-10 rounded-md shrink-0"
                  style={{ background: icp.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{icp.name}</h3>
                    {icp.status === "ARCHIVED" && (
                      <span className="pill-slate">Archived</span>
                    )}
                  </div>
                  {icp.description && (
                    <p className="text-xs text-muted mt-1 line-clamp-2">
                      {icp.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-xl font-semibold">{icp._count.leads}</div>
                  <div className="text-xs text-muted">leads</div>
                </div>
                <div>
                  <div className="text-xl font-semibold">{icp._count.criteria}</div>
                  <div className="text-xs text-muted">criteria</div>
                </div>
                <div>
                  <div className="text-xl font-semibold">{icp._count.stages}</div>
                  <div className="text-xs text-muted">stages</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
