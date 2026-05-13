export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-br from-brand-navy via-brand to-brand-accent p-6">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
