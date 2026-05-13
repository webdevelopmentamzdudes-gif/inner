import { auth } from "@/auth";
import SettingsNav from "./SettingsNav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = session!.user.role;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted">Account, security, and (admin) team management.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6">
        <SettingsNav role={role} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
