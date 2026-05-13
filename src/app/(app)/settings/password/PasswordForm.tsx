"use client";

import { useState, useTransition } from "react";
import { changePassword } from "../actions";

export default function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (next.length < 8) {
      setMsg({ type: "err", text: "New password must be at least 8 characters." });
      return;
    }
    if (next !== confirm) {
      setMsg({ type: "err", text: "Passwords do not match." });
      return;
    }

    startTransition(async () => {
      try {
        await changePassword({ current, next, confirm });
        setMsg({ type: "ok", text: "Password updated." });
        setCurrent("");
        setNext("");
        setConfirm("");
      } catch (e) {
        setMsg({ type: "err", text: e instanceof Error ? e.message : "Failed to update" });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-md">
      <div className="space-y-1.5">
        <label className="label">Current password</label>
        <input
          className="input"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>
      <div className="space-y-1.5">
        <label className="label">New password</label>
        <input
          className="input"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          autoComplete="new-password"
          minLength={8}
        />
        <p className="text-xs text-muted">At least 8 characters.</p>
      </div>
      <div className="space-y-1.5">
        <label className="label">Confirm new password</label>
        <input
          className="input"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          minLength={8}
        />
      </div>

      {msg && (
        <div className={msg.type === "ok" ? "text-sm text-success" : "text-sm text-danger"}>
          {msg.text}
        </div>
      )}

      <div>
        <button className="btn-primary" disabled={pending}>
          {pending ? "Updating…" : "Update password"}
        </button>
      </div>
    </form>
  );
}
