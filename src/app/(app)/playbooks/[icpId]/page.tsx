import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { canViewIcp } from "@/lib/scope";
import { can } from "@/lib/rbac";
import { RESOURCE_CATEGORIES, type ResourceType } from "@/lib/playbook";
import {
  Plus,
  FileText,
  Mail,
  Phone,
  ClipboardList,
  FileSignature,
  Tag,
  Folder,
  Paperclip,
} from "lucide-react";

const ICONS: Record<ResourceType, React.ComponentType<{ className?: string }>> = {
  PITCH_DECK: FileText,
  EMAIL_TEMPLATE: Mail,
  CALL_SCRIPT: Phone,
  REPORT_SOP: ClipboardList,
  CONTRACT: FileSignature,
  PRICING: Tag,
  OTHER: Folder,
};

type SP = Promise<{ archived?: string }>;

export default async function IcpPlaybookPage({
  params,
  searchParams,
}: {
  params: Promise<{ icpId: string }>;
  searchParams: SP;
}) {
  const { icpId } = await params;
  const sp = await searchParams;
  const session = await auth();

  const icp = await prisma.icp.findUnique({ where: { id: icpId } });
  if (!icp) notFound();
  if (!(await canViewIcp(session!.user.role, session!.user.id, icp))) notFound();
  const canEdit = await can(session!.user.role, "icp.manage");

  const showArchived = sp.archived === "1";
  const resources = await prisma.resource.findMany({
    where: {
      icpId,
      ...(showArchived ? {} : { status: "ACTIVE" }),
    },
    orderBy: [{ type: "asc" }, { updatedAt: "desc" }],
    include: { createdBy: { select: { name: true } } },
  });

  const grouped = new Map<ResourceType, typeof resources>();
  for (const c of RESOURCE_CATEGORIES) grouped.set(c.type, []);
  for (const r of resources) {
    const arr = grouped.get(r.type as ResourceType) ?? [];
    arr.push(r);
    grouped.set(r.type as ResourceType, arr);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Link href="/playbooks" className="text-xs text-muted hover:text-brand">
            ← All playbooks
          </Link>
          <div className="flex items-center gap-3">
            <span className="size-8 rounded-md" style={{ background: icp.color }} />
            <h1 className="text-2xl font-semibold">{icp.name} — Playbook</h1>
          </div>
          <p className="text-sm text-muted">
            Everything reps need to work this ICP. Editable by Admins and Managers.
          </p>
        </div>
        <Link href={`/playbooks/${icpId}?archived=${showArchived ? "0" : "1"}`} className="btn-ghost btn-sm">
          {showArchived ? "Hide archived" : "Show archived"}
        </Link>
      </div>

      <div className="space-y-6">
        {RESOURCE_CATEGORIES.map((cat) => {
          const items = grouped.get(cat.type) ?? [];
          const Icon = ICONS[cat.type];
          return (
            <section key={cat.type} className="card p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Icon className="size-5 text-brand mt-0.5" />
                  <div>
                    <h2 className="font-semibold">{cat.label}</h2>
                    <p className="text-xs text-muted">{cat.description}</p>
                  </div>
                </div>
                {canEdit && (
                  <Link
                    href={`/playbooks/${icpId}/new?type=${cat.type}`}
                    className="btn-secondary btn-sm shrink-0"
                  >
                    <Plus className="size-3" /> Add
                  </Link>
                )}
              </div>

              {items.length === 0 ? (
                <div className="text-xs text-muted pl-8">
                  None yet.
                  {canEdit && (
                    <>
                      {" "}
                      <Link
                        href={`/playbooks/${icpId}/new?type=${cat.type}`}
                        className="text-brand"
                      >
                        Add the first one →
                      </Link>
                    </>
                  )}
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 -mx-5">
                  {items.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/playbooks/${icpId}/${r.id}`}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate flex items-center gap-2">
                            {r.title}
                            {r.status === "ARCHIVED" && (
                              <span className="pill-slate text-xs">Archived</span>
                            )}
                          </div>
                          <div className="text-xs text-muted flex flex-wrap gap-x-3">
                            <span>v{r.version}</span>
                            {r.fileName && (
                              <span className="flex items-center gap-1">
                                <Paperclip className="size-3" />
                                {r.fileName}
                              </span>
                            )}
                            <span>
                              Updated {new Date(r.updatedAt).toLocaleDateString()} by{" "}
                              {r.createdBy.name}
                            </span>
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
