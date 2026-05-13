"use client";

import { useState, useTransition } from "react";
import { updateProfile, signOutAfterUpdate } from "../actions";

export default function ProfileForm({
  initial,
  role,
}: {
  initial: { name: string; email: string };
  role: string;
}) {
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const emailChanged = email.trim().toLowerCase() !== initial.email.toLowerCase();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      try {
        await updateProfile({ name: name.trim(), email: email.trim() });
        if (emailChanged) {
          // Force re-login so the JWT picks up the new email.
          await signOutAfterUpdate();
          return;
        }
        setMsg({ type: "ok", text: "Profile updated." });
      } catch (e) {
        setMsg({ type: "err", text: e instanceof Error ? e.message : "Failed to update" });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {emailChanged && (
            <p className="text-xs text-muted">
              Changing your email will sign you out — you'll need to log in again with the new email.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <label className="label">Role</label>
          <input className="input bg-slate-50" value={role} disabled />
        </div>
      </div>

      {msg && (
        <div className={msg.type === "ok" ? "text-sm text-success" : "text-sm text-danger"}>
          {msg.text}
        </div>
      )}

      <div>
        <button className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
