import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { canViewIcp } from "@/lib/scope";
import { getCategory, type ResourceType } from "@/lib/playbook";
import ResourceForm from "../ResourceForm";

type SP = Promise<{ type?: string }>;

export default async function NewResourcePage({
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
  if (!(await can(session!.user.role, "icp.manage"))) redirect(`/playbooks/${icpId}`);

  const requestedType = (sp.type ?? "OTHER") as ResourceType;
  const category = getCategory(requestedType);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">New {category.label.toLowerCase()}</h1>
        <p className="text-sm text-muted">
          Adding to <strong>{icp.name}</strong> playbook.
        </p>
      </div>
      <ResourceForm
        icpId={icpId}
        mode="create"
        initial={{
          type: category.type,
          title: "",
          body: "",
          version: "1.0",
          fileName: null,
          meta: {},
        }}
      />
    </div>
  );
}
