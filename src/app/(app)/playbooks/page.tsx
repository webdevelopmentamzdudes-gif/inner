import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { icpScopeWhere } from "@/lib/scope";
import { BookOpen } from "lucide-react";

export default async function PlaybooksIndex() {
  const session = await auth();
  const scope = await icpScopeWhere(session!.user.role, session!.user.id);

  const icps = await prisma.icp.findMany({
    where: { status: "ACTIVE", ...scope },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { resources: { where: { status: "ACTIVE" } } } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Playbooks</h1>
        <p className="text-sm text-muted">
          Pitch decks, email templates, call scripts, SOPs, contracts, and pricing — organized per ICP.
        </p>
      </div>

      {icps.length === 0 ? (
        <div className="card p-10 text-center">
          <BookOpen className="size-8 mx-auto text-muted" />
          <h2 className="mt-3 font-semibold">No ICPs available</h2>
          <p className="text-sm text-muted mt-1">
            Once ICPs exist, you'll find each one's playbook here.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {icps.map((icp) => (
            <Link
              key={icp.id}
              href={`/playbooks/${icp.id}`}
              className="card p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <span
                  className="size-10 rounded-md shrink-0"
                  style={{ background: icp.color }}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{icp.name}</h3>
                  {icp.description && (
                    <p className="text-xs text-muted mt-1 line-clamp-2">{icp.description}</p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm">
                <BookOpen className="size-4 text-muted" />
                <span>{icp._count.resources} resources</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
