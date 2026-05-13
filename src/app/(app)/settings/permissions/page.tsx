import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { can, CAPABILITIES, getPermissions, describeCapability } from "@/lib/rbac";
import PermissionsForm from "./PermissionsForm";

export default async function PermissionsPage() {
  const session = await auth();
  if (!(await can(session!.user.role, "system.configure"))) {
    redirect("/settings/profile");
  }

  const matrix = await getPermissions();
  const capabilityList = CAPABILITIES.map((c) => ({
    id: c,
    label: describeCapability(c),
  }));

  return (
    <div className="card p-5 space-y-4">
      <div>
        <h2 className="font-semibold">Permissions</h2>
        <p className="text-xs text-muted">
          Toggle which capabilities each role has. Changes apply on the next request the user makes.
          A role's "view all" toggle controls data scope — turning it off restricts that role to
          their own assigned leads / ICPs.
        </p>
      </div>
      <PermissionsForm initial={matrix} capabilities={capabilityList} />
    </div>
  );
}
