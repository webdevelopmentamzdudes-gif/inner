"use client";

import { useState, useTransition } from "react";
import { updateNotificationPrefs } from "../actions";

const TOGGLES: { key: string; label: string; description: string }[] = [
  { key: "lead_assigned_app", label: "Lead assigned to me — in-app", description: "PRD §14.1" },
  { key: "lead_assigned_email", label: "Lead assigned to me — email", description: "PRD §14.2 (immediate)" },
  { key: "stalled_app", label: "Lead stalled in my pipeline — in-app", description: "PRD §14.1" },
  { key: "task_due_app", label: "Task due today — in-app", description: "PRD §14.1" },
  { key: "mention_email", label: "@mention — email", description: "PRD §14.2 (immediate)" },
  { key: "daily_digest", label: "Daily digest email (8am local)", description: "PRD §14.2" },
];

const DEFAULTS: Record<string, boolean> = Object.fromEntries(TOGGLES.map((t) => [t.key, true]));

export default function NotificationsForm({ initial }: { initial: Record<string, boolean> }) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({ ...DEFAULTS, ...initial });
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function toggle(key: string) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      try {
        await updateNotificationPrefs(prefs);
        setMsg({ type: "ok", text: "Preferences saved." });
      } catch (e) {
        setMsg({ type: "err", text: e instanceof Error ? e.message : "Failed to save" });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        {TOGGLES.map((t) => (
          <label key={t.key} className="flex items-start gap-3 p-3 rounded-md border border-slate-200">
            <input
              type="checkbox"
              checked={!!prefs[t.key]}
              onChange={() => toggle(t.key)}
              className="mt-0.5"
            />
            <span className="flex-1">
              <span className="font-medium text-sm">{t.label}</span>
              <span className="block text-xs text-muted">{t.description}</span>
            </span>
          </label>
        ))}
      </div>

      {msg && (
        <div className={msg.type === "ok" ? "text-sm text-success" : "text-sm text-danger"}>
          {msg.text}
        </div>
      )}

      <div>
        <button className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </form>
  );
}
