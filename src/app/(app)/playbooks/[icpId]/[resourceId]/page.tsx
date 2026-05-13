import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { canViewIcp } from "@/lib/scope";
import { parseJson } from "@/lib/json";
import { getCategory, type ResourceType } from "@/lib/playbook";
import { Download, Pencil, Eye } from "lucide-react";
import ResourceForm from "../ResourceForm";

type SP = Promise<{ edit?: string }>;

export default async function ResourceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ icpId: string; resourceId: string }>;
  searchParams: SP;
}) {
  const { icpId, resourceId } = await params;
  const sp = await searchParams;
  const session = await auth();

  const resource = await prisma.resource.findUnique({
    where: { id: resourceId },
    include: { icp: true, createdBy: { select: { name: true } } },
  });
  if (!resource || resource.icpId !== icpId) notFound();
  if (!(await canViewIcp(session!.user.role, session!.user.id, resource.icp))) notFound();

  const canEdit = await can(session!.user.role, "icp.manage");
  const editing = canEdit && sp.edit === "1";
  const cat = getCategory(resource.type);
  const meta = parseJson<{ subject?: string }>(resource.meta, {});

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Link href={`/playbooks/${icpId}`} className="text-xs text-muted hover:text-brand">
            ← {resource.icp.name} playbook
          </Link>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            {resource.title}
            {resource.status === "ARCHIVED" && <span className="pill-slate text-xs">Archived</span>}
          </h1>
          <div className="text-xs text-muted">
            {cat.label} · v{resource.version} · created by {resource.createdBy.name} on{" "}
            {new Date(resource.createdAt).toLocaleDateString()}
          </div>
        </div>
        {canEdit && (
          <Link
            href={`/playbooks/${icpId}/${resourceId}${editing ? "" : "?edit=1"}`}
            className="btn-secondary btn-sm"
          >
            {editing ? <><Eye className="size-4" /> View</> : <><Pencil className="size-4" /> Edit</>}
          </Link>
        )}
      </div>

      {editing ? (
        <ResourceForm
          icpId={icpId}
          mode="edit"
          initial={{
            id: resource.id,
            type: resource.type as ResourceType,
            title: resource.title,
            body: resource.body ?? "",
            version: resource.version,
            fileName: resource.fileName,
            meta,
            status: resource.status,
          }}
        />
      ) : (
        <div className="space-y-4">
          {resource.fileName && resource.filePath && (
            <div className="card p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{resource.fileName}</div>
                <div className="text-xs text-muted">
                  {resource.fileMime ?? "file"} ·{" "}
                  {resource.fileSize
                    ? `${(resource.fileSize / 1024 / 1024).toFixed(2)} MB`
                    : "size unknown"}
                </div>
              </div>
              <a
                href={`/api/files/${resource.id}`}
                target="_blank"
                rel="noreferrer"
                className="btn-primary btn-sm"
              >
                <Download className="size-4" /> Open
              </a>
            </div>
          )}

          {resource.type === "EMAIL_TEMPLATE" && meta.subject && (
            <div className="card p-4">
              <div className="label">Subject</div>
              <div className="font-medium mt-1">{meta.subject}</div>
            </div>
          )}

          {resource.body ? (
            <div className="card p-5">
              <div className="label mb-2">Body</div>
              <pre className="whitespace-pre-wrap text-sm font-sans">{resource.body}</pre>
            </div>
          ) : !resource.fileName ? (
            <div className="card p-5 text-sm text-muted">
              No body or attached file yet.{" "}
              {canEdit && (
                <Link href={`/playbooks/${icpId}/${resourceId}?edit=1`} className="text-brand">
                  Add some →
                </Link>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
