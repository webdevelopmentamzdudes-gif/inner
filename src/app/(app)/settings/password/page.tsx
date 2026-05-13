import PasswordForm from "./PasswordForm";

export default function PasswordPage() {
  return (
    <div className="card p-5 space-y-4">
      <div>
        <h2 className="font-semibold">Change password</h2>
        <p className="text-xs text-muted">
          You'll stay signed in after changing your password — other sessions are unaffected.
        </p>
      </div>
      <PasswordForm />
    </div>
  );
}
