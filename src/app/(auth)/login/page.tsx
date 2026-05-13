import { signIn } from "@/auth";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const { error, callbackUrl } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/dashboard",
      });
    } catch (e) {
      if (e instanceof AuthError) {
        redirect(`/login?error=invalid${callbackUrl ? `&callbackUrl=${callbackUrl}` : ""}`);
      }
      throw e;
    }
  }

  return (
    <div className="card p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-muted">Lead Management Platform</p>
      </div>

      <form action={login} className="space-y-4">
        <div className="space-y-1.5">
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoFocus className="input" placeholder="you@company.com" />
        </div>
        <div className="space-y-1.5">
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required className="input" />
        </div>

        {error ? (
          <div className="text-sm text-danger">Invalid email or password.</div>
        ) : null}

        <button type="submit" className="btn-primary w-full">Sign in</button>
      </form>

      <p className="text-xs text-muted">
        Default seeded admin: <code>admin@example.com</code> / <code>ChangeMe123!</code>
      </p>
    </div>
  );
}
