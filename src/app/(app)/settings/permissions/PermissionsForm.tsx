"use client";

import { useState, useTransition } from "react";
import { savePermissions, resetPermissionsToDefault } from "../actions";
import type { Capability, PermissionMatrix } from "@/lib/rbac";
import type { Role } from "@/lib/types";

const ROLES: Role[] = ["ADMIN", "MANAGER", "REP", "VIEWER"];

// Locked: can never be removed from ADMIN. Mirrors the back-end guard so the
// UI doesn't pretend you can turn them off.
const ADMIN_LOCKED: Capability[] = [
  "users.manage",
  "users.changeRole",
  "system.configure",
  "icp.manage",
];

export default function PermissionsForm({
  initial,
  capabilities,
}: {
  initial: PermissionMatrix;
  capabilities: { id: Capability; label: string }[];
}) {
  const [matrix, setMatrix] = useState<PermissionMatrix>(initial);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function isOn(role: Role, cap: Capability) {
    return matrix[role].includes(cap);
  }

  function toggle(role: Role, cap: Capability) {
    if (role === "ADMIN" && ADMIN_LOCKED.includes(cap)) return;
    setMatrix((m) => {
      const present = m[role].includes(cap);
      const next: Capability[] = present
        ? m[role].filter((c) => c !== cap)
        : [...m[role], cap];
      return { ...m, [role]: next };
    });
  }

  function onSave() {
    setMsg(null);
    startTransition(async () => {
      try {
        await savePermissions(matrix);
        setMsg({ type: "ok", text: "Permissions updated." });
      } catch (e) {
        setMsg({ type: "err", text: e instanceof Error ? e.message : "Failed to save" });
      }
    });
  }

  function onReset() {
    if (!confirm("Reset all permissions to defaults? This will replace your current matrix.")) return;
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await resetPermissionsToDefault();
        // Re-pull defaults into local state — server has already saved them.
        if (res.ok) location.reload();
      } catch (e) {
        setMsg({ type: "err", text: e instanceof Error ? e.message : "Failed to reset" });
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto -mx-5">
        <table className="table-base">
          <thead>
            <tr>
              <th>Capability</th>
              {ROLES.map((r) => (
                <th key={r} className="text-center">{r}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {capabilities.map((cap) => (
              <tr key={cap.id}>
                <td>
                  <div className="font-medium">{cap.label}</div>
                  <div className="text-xs text-muted font-mono">{cap.id}</div>
                </td>
                {ROLES.map((r) => {
                  const locked = r === "ADMIN" && ADMIN_LOCKED.includes(cap.id);
                  return (
                    <td key={r} className="text-center">
                      <input
                        type="checkbox"
                        checked={isOn(r, cap.id)}
                        disabled={locked || pending}
                        onChange={() => toggle(r, cap.id)}
                        title={locked ? "Locked for Admin to prevent lockout" : undefined}
                        className="size-4 cursor-pointer disabled:cursor-not-allowed"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {msg && (
        <div className={msg.type === "ok" ? "text-sm text-success" : "text-sm text-danger"}>
          {msg.text}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button onClick={onSave} className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save permissions"}
        </button>
        <button onClick={onReset} className="btn-secondary" disabled={pending}>
          Reset to defaults
        </button>
      </div>

      <div className="text-xs text-muted">
        <p className="font-medium">How the data-scope toggles work:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li><span className="font-mono">lead.viewAll</span> off → that role only sees leads assigned to them.</li>
          <li><span className="font-mono">icp.viewAll</span> off → that role only sees ICPs where they have at least one assigned lead (or are the default assignee).</li>
        </ul>
      </div>
    </div>
  );
}
