import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import LeadForm from "../LeadForm";

export default async function NewLeadPage() {
  const session = await auth();
  const [icps, users] = await Promise.all([
    prisma.icp.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      include: { criteria: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">New Lead</h1>
        <p className="text-sm text-muted">
          Quick add — only Company, ICP, Source, and Owner are required.
        </p>
      </div>
      <LeadForm
        icps={icps.map((i) => ({
          id: i.id,
          name: i.name,
          color: i.color,
          customCriteria: i.criteria
            .filter((c) => c.fieldPath.startsWith("custom_fields."))
            .map((c) => ({
              key: c.fieldPath.slice("custom_fields.".length),
              label: c.label,
              dataType: c.dataType,
            })),
        }))}
        users={users}
        defaultUserId={session!.user.id}
      />
    </div>
  );
}
