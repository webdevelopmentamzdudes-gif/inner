import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { redirect } from "next/navigation";
import IcpBuilderForm from "../IcpBuilderForm";

export default async function NewIcpPage() {
  const session = await auth();
  if (!(await can(session!.user.role, "icp.manage"))) redirect("/icps");

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">New ICP</h1>
        <p className="text-sm text-muted">
          Define qualification criteria, scoring weights, and pipeline stages.
        </p>
      </div>
      <IcpBuilderForm />
    </div>
  );
}
