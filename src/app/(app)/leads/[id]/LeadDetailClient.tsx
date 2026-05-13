"use client";

import { useState, useTransition } from "react";
import { moveStage, addNote, archiveLead, updateLead } from "../actions";
import { logContactAttempt, deleteContactAttempt } from "../outreach-actions";
import type { Role } from "@/lib/types";
import { Save, Archive, Trash2 } from "lucide-react";
import {
  CHANNELS,
  STATUSES,
  REQUIRED_CHANNELS,
  channelLabel,
  summarizeAttempts,
  type Channel,
} from "@/lib/outreach";

type Lead = {
  id: string;
  icpId: string;
  stageId: string;
  companyName: string;
  companyWebsite: string | null;
  industry: string | null;
  geography: string | null;
  headcount: number | null;
  annualRevenue: number | null;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactTitle: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactLinkedin: string | null;
  leadSource: string;
  sourceDetail: string | null;
  score: number;
  scoreBreakdown: unknown;
  customFields: unknown;
  assignedToId: string | null;
  status: string;
  lastActivityAt: Date | string;
  icp: {
    id: string;
    name: string;
    color: string;
    criteria: { id: string; label: string; fieldPath: string; weight: number }[];
    stages: { id: string; name: string; isWon: boolean; isLost: boolean; sortOrder: number }[];
  };
  notes: {
    id: string;
    body: string;
    createdAt: Date | string;
    createdBy: { name: string };
  }[];
  tasks: {
    id: string;
    title: string;
    dueDate: Date | string | null;
    completedAt: Date | string | null;
    assignedTo: { name: string } | null;
  }[];
  activities: {
    id: string;
    type: string;
    payload: unknown;
    createdAt: Date | string;
    performedBy: { name: string } | null;
  }[];
  contactAttempts: {
    id: string;
    channel: string;
    direction: string;
    status: string;
    occurredAt: string;
    summary: string | null;
    performedBy: string;
    performedById: string;
  }[];
};

type Tab = "overview" | "outreach" | "activity" | "notes" | "tasks" | "custom";

export default function LeadDetailClient({
  lead,
  currentUserId,
  currentUserRole,
}: {
  lead: Lead;
  currentUserId: string;
  currentUserRole: Role;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isOwner = lead.assignedToId === currentUserId;
  const canEdit = isOwner || currentUserRole === "ADMIN" || currentUserRole === "MANAGER";

  const breakdown = (lead.scoreBreakdown ?? []) as {
    label: string;
    weight: number;
    met: boolean;
    missing: boolean;
  }[];

  function move(stageId: string) {
    const stage = lead.icp.stages.find((s) => s.id === stageId);
    let lostReason: string | undefined;
    let closingNote: string | undefined;
    if (stage?.isLost) {
      lostReason =
        prompt(
          "Lost reason? (NOT_INTERESTED, NO_BUDGET, WRONG_FIT, UNRESPONSIVE, COMPETITOR, OTHER)",
          "OTHER",
        ) ?? "OTHER";
    }
    if (stage?.isWon) {
      closingNote = prompt("Closing note (optional)") ?? undefined;
    }
    startTransition(async () => {
      try {
        await moveStage(lead.id, stageId, lostReason, closingNote);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to move stage");
      }
    });
  }

  function onArchive() {
    if (!confirm("Archive this lead?")) return;
    startTransition(async () => {
      try {
        await archiveLead(lead.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to archive");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <label className="text-xs label">Stage:</label>
        <select
          className="input w-44"
          value={lead.stageId}
          onChange={(e) => move(e.target.value)}
          disabled={!canEdit || pending}
        >
          {lead.icp.stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onArchive}
          className="btn-ghost btn-sm text-danger ml-auto"
          disabled={!canEdit || pending}
        >
          <Archive className="size-4" /> Archive
        </button>
      </div>

      <div className="border-b border-slate-200 flex gap-1">
        {(["overview", "outreach", "activity", "notes", "tasks", "custom"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm rounded-t-md ${
              tab === t
                ? "bg-white border border-b-white border-slate-200 -mb-px font-medium"
                : "text-muted hover:text-brand-navy"
            }`}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {error && <div className="card p-3 text-sm text-danger">{error}</div>}

      {tab === "overview" && (
        <OverviewTab lead={lead} canEdit={canEdit} breakdown={breakdown} />
      )}
      {tab === "outreach" && <OutreachTab lead={lead} canEdit={canEdit} currentUserId={currentUserId} />}
      {tab === "activity" && <ActivityTab lead={lead} />}
      {tab === "notes" && <NotesTab lead={lead} canEdit={canEdit} />}
      {tab === "tasks" && (
        <div className="card p-5 text-sm text-muted">
          {lead.tasks.length === 0
            ? "No tasks yet. Task management UI to be added next."
            : `${lead.tasks.length} task(s) — full UI coming soon.`}
        </div>
      )}
      {tab === "custom" && <CustomTab lead={lead} />}
    </div>
  );
}

function OverviewTab({
  lead,
  canEdit,
  breakdown,
}: {
  lead: Lead;
  canEdit: boolean;
  breakdown: { label: string; weight: number; met: boolean; missing: boolean }[];
}) {
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    startTransition(async () => {
      await updateLead(lead.id, data);
      setSavedAt(new Date());
    });
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <form className="card p-5 space-y-3 lg:col-span-2" onSubmit={onSave}>
        <h2 className="font-semibold">Company</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <Field name="companyName" label="Company name" defaultValue={lead.companyName} disabled={!canEdit} />
          <Field name="companyWebsite" label="Website" defaultValue={lead.companyWebsite ?? ""} disabled={!canEdit} />
          <Field name="industry" label="Industry" defaultValue={lead.industry ?? ""} disabled={!canEdit} />
          <Field name="geography" label="Geography" defaultValue={lead.geography ?? ""} disabled={!canEdit} />
          <Field name="headcount" label="Headcount" type="number" defaultValue={lead.headcount ?? ""} disabled={!canEdit} />
          <Field name="annualRevenue" label="Annual revenue" type="number" defaultValue={lead.annualRevenue ?? ""} disabled={!canEdit} />
        </div>

        <h2 className="font-semibold pt-2">Contact</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <Field name="contactFirstName" label="First name" defaultValue={lead.contactFirstName ?? ""} disabled={!canEdit} />
          <Field name="contactLastName" label="Last name" defaultValue={lead.contactLastName ?? ""} disabled={!canEdit} />
          <Field name="contactTitle" label="Title" defaultValue={lead.contactTitle ?? ""} disabled={!canEdit} />
          <Field name="contactEmail" label="Email" defaultValue={lead.contactEmail ?? ""} disabled={!canEdit} />
          <Field name="contactPhone" label="Phone" defaultValue={lead.contactPhone ?? ""} disabled={!canEdit} />
          <Field name="contactLinkedin" label="LinkedIn" defaultValue={lead.contactLinkedin ?? ""} disabled={!canEdit} />
        </div>

        {canEdit && (
          <div className="pt-2 flex items-center gap-3">
            <button className="btn-primary btn-sm" disabled={pending}>
              <Save className="size-4" /> {pending ? "Saving…" : "Save"}
            </button>
            {savedAt && <span className="text-xs text-muted">Saved {savedAt.toLocaleTimeString()}</span>}
          </div>
        )}
      </form>

      <div className="space-y-4">
        <div className="card p-5">
          <h2 className="font-semibold">Score breakdown</h2>
          <p className="text-xs text-muted mb-3">Total: {lead.score} / 100</p>
          <ul className="space-y-1 text-sm">
            {breakdown.length === 0 ? (
              <li className="text-muted text-xs">
                No criteria evaluated yet (edit fields to trigger scoring).
              </li>
            ) : (
              breakdown.map((b, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span
                    className={`size-2 rounded-full ${
                      b.met ? "bg-success" : b.missing ? "bg-warning" : "bg-danger"
                    }`}
                  />
                  <span className="flex-1">{b.label}</span>
                  <span className="text-muted text-xs">
                    {b.met ? `+${b.weight}` : b.missing ? "missing" : "0"}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  type = "text",
  disabled = false,
}: {
  name: string;
  label: string;
  defaultValue: string | number;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="label">{label}</label>
      <input name={name} className="input" type={type} defaultValue={defaultValue ?? ""} disabled={disabled} />
    </div>
  );
}

function ActivityTab({ lead }: { lead: Lead }) {
  return (
    <div className="card divide-y divide-slate-100">
      {lead.activities.length === 0 ? (
        <div className="p-5 text-sm text-muted">No activity yet.</div>
      ) : (
        lead.activities.map((a) => (
          <div key={a.id} className="px-5 py-3 flex items-start gap-3 text-sm">
            <span className="pill-slate">{a.type}</span>
            <div className="flex-1">
              <div>{a.performedBy?.name ?? "system"}</div>
              <div className="text-xs text-muted">{new Date(a.createdAt).toLocaleString()}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function NotesTab({ lead, canEdit }: { lead: Lead; canEdit: boolean }) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!body.trim()) return;
    startTransition(async () => {
      await addNote(lead.id, body);
      setBody("");
    });
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="card p-4 space-y-2">
          <textarea
            className="input min-h-[80px] py-2"
            placeholder="Add a note…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex justify-end">
            <button className="btn-primary btn-sm" onClick={submit} disabled={pending}>
              {pending ? "Saving…" : "Add note"}
            </button>
          </div>
        </div>
      )}

      {lead.notes.length === 0 ? (
        <div className="card p-5 text-sm text-muted">No notes yet.</div>
      ) : (
        lead.notes.map((n) => (
          <div key={n.id} className="card p-4">
            <div className="text-xs text-muted mb-1">
              {n.createdBy.name} · {new Date(n.createdAt).toLocaleString()}
            </div>
            <div className="text-sm whitespace-pre-wrap">{n.body}</div>
          </div>
        ))
      )}
    </div>
  );
}

function CustomTab({ lead }: { lead: Lead }) {
  const cf = (lead.customFields ?? {}) as Record<string, unknown>;
  const keys = Object.keys(cf);
  if (keys.length === 0) {
    return (
      <div className="card p-5 text-sm text-muted">
        No ICP-specific custom fields on this lead. They appear here when this ICP defines criteria
        on <code>custom_fields.*</code> paths.
      </div>
    );
  }
  return (
    <div className="card p-5 grid md:grid-cols-2 gap-3 text-sm">
      {keys.map((k) => (
        <div key={k}>
          <div className="label">{k}</div>
          <div>{String(cf[k])}</div>
        </div>
      ))}
    </div>
  );
}

function OutreachTab({
  lead,
  canEdit,
  currentUserId,
}: {
  lead: Lead;
  canEdit: boolean;
  currentUserId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const coverage = summarizeAttempts(lead.contactAttempts);

  function onLog(formData: FormData) {
    setError(null);
    formData.append("leadId", lead.id);
    startTransition(async () => {
      try {
        await logContactAttempt(formData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to log attempt");
      }
    });
  }

  function onDelete(id: string) {
    if (!confirm("Delete this attempt?")) return;
    startTransition(async () => {
      try {
        await deleteContactAttempt(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        {canEdit && (
          <div className="card p-4">
            <h3 className="font-semibold text-sm mb-3">Log a contact attempt</h3>
            <form
              action={onLog}
              className="grid grid-cols-2 md:grid-cols-6 gap-2"
            >
              <select name="channel" required className="input col-span-2 md:col-span-1" defaultValue="EMAIL">
                {CHANNELS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <select name="direction" className="input" defaultValue="OUTBOUND">
                <option value="OUTBOUND">Outbound</option>
                <option value="INBOUND">Inbound</option>
              </select>
              <select name="status" className="input" defaultValue="ATTEMPTED">
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <input
                name="occurredAt"
                type="datetime-local"
                className="input col-span-2 md:col-span-1"
                defaultValue={localNow()}
              />
              <input
                name="summary"
                className="input col-span-2 md:col-span-2"
                placeholder='e.g. "Sent intro email", "Left voicemail"'
              />
              <button className="btn-primary col-span-2 md:col-span-6" disabled={pending}>
                {pending ? "Logging…" : "Log attempt"}
              </button>
            </form>
          </div>
        )}

        {error && <div className="card p-3 text-sm text-danger">{error}</div>}

        <div className="card divide-y divide-slate-100">
          <div className="p-3 text-xs label">Outreach log ({lead.contactAttempts.length})</div>
          {lead.contactAttempts.length === 0 ? (
            <div className="p-5 text-sm text-muted">
              No attempts logged yet. Use the form above to log your first touch.
            </div>
          ) : (
            lead.contactAttempts.map((a) => (
              <div key={a.id} className="px-4 py-3 flex items-start gap-3 text-sm">
                <span className="pill-slate w-24 justify-center text-center">
                  {channelLabel(a.channel)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={
                      a.status === "RESPONDED" ? "pill-green" :
                      a.status === "BOUNCED" || a.status === "NOT_AVAILABLE" ? "pill-red" :
                      "pill-amber"
                    }>
                      {a.status.toLowerCase().replace("_", " ")}
                    </span>
                    <span className="text-xs text-muted">
                      {a.direction === "INBOUND" ? "← in" : "→ out"}
                    </span>
                    <span className="text-xs text-muted">
                      {new Date(a.occurredAt).toLocaleString()}
                    </span>
                    <span className="text-xs text-muted">· {a.performedBy}</span>
                  </div>
                  {a.summary && <div className="mt-1">{a.summary}</div>}
                </div>
                {(canEdit || a.performedById === currentUserId) && (
                  <button
                    onClick={() => onDelete(a.id)}
                    className="text-muted hover:text-danger"
                    title="Delete"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Channel coverage</h3>
          <div className="space-y-2">
            {coverage.map((c) => {
              const required = REQUIRED_CHANNELS.includes(c.channel as Channel);
              const tried = c.attempts > 0;
              return (
                <div key={c.channel} className="flex items-center gap-2 text-sm">
                  <span
                    className={`size-2 rounded-full shrink-0 ${
                      c.hasResponse
                        ? "bg-success"
                        : tried
                          ? "bg-warning"
                          : required
                            ? "bg-danger"
                            : "bg-slate-300"
                    }`}
                  />
                  <span className="flex-1">{channelLabel(c.channel)}</span>
                  <span className="text-xs text-muted tabular-nums">
                    {c.attempts === 0 ? "—" : `${c.attempts} sent`}
                  </span>
                  {c.hasResponse && <span className="text-xs text-success">replied</span>}
                </div>
              );
            })}
          </div>
          <div className="mt-3 text-xs text-muted">
            <span className="size-2 rounded-full bg-danger inline-block mr-1.5 align-middle" />
            Required channel not yet tried (Email / Call / LinkedIn)
          </div>
        </div>
      </div>
    </div>
  );
}

function localNow(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
