"use client";

import { useState, useTransition } from "react";
import { Plus, KeyRound } from "lucide-react";
import { createUser, updateUser, resetUserPassword } from "../actions";
import type { Role, UserStatus } from "@/lib/types";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
};

const ROLES: Role[] = ["ADMIN", "MANAGER", "REP", "VIEWER"];

export default function UsersClient({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const [showInvite, setShowInvite] = useState(false);
  const [globalErr, setGlobalErr] = useState<string | null>(null);
  const [globalOk, setGlobalOk] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Users</h2>
            <p className="text-xs text-muted">
              {users.length} total. Role changes take effect after the user signs out and back in.
            </p>
          </div>
          <button
            className="btn-primary btn-sm"
            onClick={() => {
              setShowInvite((v) => !v);
              setGlobalErr(null);
              setGlobalOk(null);
            }}
          >
            <Plus className="size-3" /> {showInvite ? "Cancel" : "Add user"}
          </button>
        </div>

        {showInvite && (
          <InviteForm
            onCreated={(name) => {
              setShowInvite(false);
              setGlobalOk(`User “${name}” created.`);
              setGlobalErr(null);
            }}
            onError={(msg) => setGlobalErr(msg)}
          />
        )}

        {globalErr && <div className="text-sm text-danger">{globalErr}</div>}
        {globalOk && <div className="text-sm text-success">{globalOk}</div>}

        <div className="overflow-x-auto -mx-5">
          <table className="table-base">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last login</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  isSelf={u.id === currentUserId}
                  onError={setGlobalErr}
                  onOk={setGlobalOk}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function InviteForm({
  onCreated,
  onError,
}: {
  onCreated: (name: string) => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("REP");
  const [password, setPassword] = useState(genTempPassword());
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await createUser({ name: name.trim(), email: email.trim(), role, password });
        onCreated(name.trim());
        setName("");
        setEmail("");
        setRole("REP");
        setPassword(genTempPassword());
      } catch (e) {
        onError(e instanceof Error ? e.message : "Failed to create user");
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-md border border-slate-200 p-4 space-y-3 bg-slate-50"
    >
      <div className="grid md:grid-cols-2 gap-3">
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
        </div>
        <div className="space-y-1.5">
          <label className="label">Role</label>
          <select
            className="input"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="label">Temporary password</label>
          <div className="flex gap-2">
            <input
              className="input flex-1 font-mono"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => setPassword(genTempPassword())}
            >
              Regen
            </button>
          </div>
          <p className="text-xs text-muted">Share this with the user — they should change it after first login.</p>
        </div>
      </div>

      <div>
        <button className="btn-primary btn-sm" disabled={pending}>
          {pending ? "Creating…" : "Create user"}
        </button>
      </div>
    </form>
  );
}

function UserRow({
  user,
  isSelf,
  onError,
  onOk,
}: {
  user: UserRow;
  isSelf: boolean;
  onError: (msg: string) => void;
  onOk: (msg: string) => void;
}) {
  const [pending, startTransition] = useTransition();

  function setRole(role: Role) {
    onError("");
    startTransition(async () => {
      try {
        await updateUser({ id: user.id, role });
        onOk(`Role for ${user.name} updated to ${role}.`);
      } catch (e) {
        onError(e instanceof Error ? e.message : "Failed to change role");
      }
    });
  }

  function setStatus(status: UserStatus) {
    onError("");
    startTransition(async () => {
      try {
        await updateUser({ id: user.id, status });
        onOk(`${user.name} ${status === "ACTIVE" ? "reactivated" : "disabled"}.`);
      } catch (e) {
        onError(e instanceof Error ? e.message : "Failed to change status");
      }
    });
  }

  function resetPassword() {
    const pw = prompt(
      `Set a new temporary password for ${user.name}. (At least 8 characters; share with the user securely.)`,
      genTempPassword(),
    );
    if (!pw) return;
    onError("");
    startTransition(async () => {
      try {
        await resetUserPassword({ id: user.id, password: pw });
        onOk(`Password reset for ${user.name}.`);
      } catch (e) {
        onError(e instanceof Error ? e.message : "Failed to reset password");
      }
    });
  }

  const isActive = user.status === "ACTIVE";

  return (
    <tr>
      <td>
        <div className="font-medium">{user.name}{isSelf && <span className="ml-2 text-xs text-muted">(you)</span>}</div>
      </td>
      <td className="text-muted">{user.email}</td>
      <td>
        <select
          className="input h-7 text-xs w-28"
          value={user.role}
          disabled={pending || (isSelf && user.role === "ADMIN")}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </td>
      <td>
        {isActive ? (
          <span className="pill-green">Active</span>
        ) : user.status === "INVITED" ? (
          <span className="pill-amber">Invited</span>
        ) : (
          <span className="pill-red">Disabled</span>
        )}
      </td>
      <td className="text-xs text-muted">
        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "—"}
      </td>
      <td className="text-right">
        <div className="inline-flex gap-1">
          <button
            type="button"
            onClick={resetPassword}
            disabled={pending}
            className="btn-ghost btn-sm"
            title="Reset password"
          >
            <KeyRound className="size-3" />
          </button>
          {isActive ? (
            <button
              type="button"
              onClick={() => setStatus("DISABLED")}
              disabled={pending || isSelf}
              className="btn-ghost btn-sm text-danger"
            >
              Disable
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStatus("ACTIVE")}
              disabled={pending}
              className="btn-ghost btn-sm text-success"
            >
              Enable
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function genTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const len = 12;
  let out = "";
  const arr = new Uint32Array(len);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < len; i++) arr[i] = Math.floor(Math.random() * 0xffffffff);
  }
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}
