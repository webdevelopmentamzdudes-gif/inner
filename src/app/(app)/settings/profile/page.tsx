import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import ProfileForm from "./ProfileForm";

export default async function ProfilePage() {
  const session = await auth();
  const user = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { id: true, name: true, email: true, role: true, status: true, lastLoginAt: true },
  });

  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-4">
        <div>
          <h2 className="font-semibold">Profile</h2>
          <p className="text-xs text-muted">Update your name and email address.</p>
        </div>
        <ProfileForm
          initial={{ name: user!.name, email: user!.email }}
          role={user!.role}
        />
      </div>

      <div className="card p-5 text-xs text-muted space-y-1">
        <div><span className="label">Role:</span> {user!.role}</div>
        <div><span className="label">Status:</span> {user!.status}</div>
        <div>
          <span className="label">Last login:</span>{" "}
          {user!.lastLoginAt ? new Date(user!.lastLoginAt).toLocaleString() : "—"}
        </div>
      </div>
    </div>
  );
}
