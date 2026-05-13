"use client";

import { useState, useTransition } from "react";
import { createLead, checkDuplicate } from "./actions";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

type IcpOpt = {
  id: string;
  name: string;
  color: string;
  customCriteria: { key: string; label: string; dataType: string }[];
};
type UserOpt = { id: string; name: string; email: string };

type DupMatch = Awaited<ReturnType<typeof checkDuplicate>>;

const SOURCES = ["LINKEDIN", "APOLLO", "REFERRAL", "EVENT", "MANUAL", "CSV", "OTHER"];

export default function LeadForm({
  icps,
  users,
  defaultUserId,
}: {
  icps: IcpOpt[];
  users: UserOpt[];
  defaultUserId: string;
}) {
  const [icpId, setIcpId] = useState(icps[0]?.id ?? "");
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [dup, setDup] = useState<DupMatch>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedIcp = icps.find((i) => i.id === icpId);

  async function runDupCheck() {
    if (!icpId) return;
    const r = await checkDuplicate({
      icpId,
      email: contactEmail || null,
      website: companyWebsite || null,
      companyName: companyName || null,
    });
    setDup(r);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const customFields: Record<string, unknown> = {};
    selectedIcp?.customCriteria.forEach((c) => {
      const v = fd.get(`custom.${c.key}`);
      if (v != null && v !== "") customFields[c.key] = v;
    });
    const data: Record<string, unknown> = Object.fromEntries(
      Array.from(fd.entries()).filter(([k]) => !k.startsWith("custom.")),
    );
    data.customFields = customFields;
    startTransition(async () => {
      try {
        await createLead(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create lead");
      }
    });
  }

  if (icps.length === 0) {
    return (
      <div className="card p-6">
        <p className="text-sm">
          You must create at least one ICP before adding leads.{" "}
          <Link href="/icps/new" className="text-brand font-medium">
            Create an ICP →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {dup?.match && (
        <div className="card p-3 flex items-start gap-3 border-warning bg-warning/5">
          <AlertTriangle className="size-5 text-warning shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <div className="font-medium">Possible duplicate (matched on {dup.by})</div>
            <div className="text-muted text-xs mt-0.5">
              {dup.match.companyName} · {dup.match.icp.name} · {dup.match.stage.name} · owned by{" "}
              {dup.match.assignedTo?.name ?? "unassigned"}
            </div>
            <div className="mt-2 flex gap-2">
              <Link href={`/leads/${dup.match.id}`} className="btn-secondary btn-sm">
                Open existing
              </Link>
              <button
                type="button"
                onClick={() => setDup(null)}
                className="btn-ghost btn-sm"
              >
                Create anyway
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card p-5 space-y-4">
        <h2 className="font-semibold">Required</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <label className="label">Company name</label>
            <input
              required
              name="companyName"
              className="input"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              onBlur={runDupCheck}
            />
          </div>
          <div className="space-y-1.5">
            <label className="label">ICP</label>
            <select
              required
              name="icpId"
              className="input"
              value={icpId}
              onChange={(e) => setIcpId(e.target.value)}
            >
              {icps.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="label">Lead source</label>
            <select required name="leadSource" defaultValue="LINKEDIN" className="input">
              {SOURCES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <label className="label">Assigned to</label>
            <select name="assignedToId" defaultValue={defaultUserId} className="input">
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name} — {u.email}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="font-semibold">Company details</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="label">Website</label>
            <input
              name="companyWebsite"
              type="url"
              className="input"
              placeholder="https://acme.com"
              value={companyWebsite}
              onChange={(e) => setCompanyWebsite(e.target.value)}
              onBlur={runDupCheck}
            />
          </div>
          <div className="space-y-1.5">
            <label className="label">Industry</label>
            <input name="industry" className="input" />
          </div>
          <div className="space-y-1.5">
            <label className="label">Geography</label>
            <input name="geography" className="input" placeholder="US, UK, …" />
          </div>
          <div className="space-y-1.5">
            <label className="label">Headcount</label>
            <input name="headcount" type="number" min={0} className="input" />
          </div>
          <div className="space-y-1.5">
            <label className="label">Annual revenue (USD)</label>
            <input name="annualRevenue" type="number" min={0} className="input" />
          </div>
          <div className="space-y-1.5">
            <label className="label">Source detail</label>
            <input name="sourceDetail" className="input" placeholder="event, search, etc." />
          </div>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="font-semibold">Primary contact</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="label">First name</label>
            <input name="contactFirstName" className="input" />
          </div>
          <div className="space-y-1.5">
            <label className="label">Last name</label>
            <input name="contactLastName" className="input" />
          </div>
          <div className="space-y-1.5">
            <label className="label">Title</label>
            <input name="contactTitle" className="input" />
          </div>
          <div className="space-y-1.5">
            <label className="label">Email</label>
            <input
              name="contactEmail"
              type="email"
              className="input"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              onBlur={runDupCheck}
            />
          </div>
          <div className="space-y-1.5">
            <label className="label">Phone</label>
            <input name="contactPhone" className="input" />
          </div>
          <div className="space-y-1.5">
            <label className="label">LinkedIn</label>
            <input name="contactLinkedin" type="url" className="input" />
          </div>
        </div>
      </div>

      {selectedIcp && selectedIcp.customCriteria.length > 0 && (
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold">ICP-specific fields</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {selectedIcp.customCriteria.map((c) => (
              <div key={c.key} className="space-y-1.5">
                <label className="label">{c.label}</label>
                {c.dataType === "BOOLEAN" ? (
                  <select name={`custom.${c.key}`} className="input" defaultValue="">
                    <option value="">—</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : (
                  <input
                    name={`custom.${c.key}`}
                    className="input"
                    type={c.dataType === "NUMBER" ? "number" : "text"}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <div className="card p-3 text-sm text-danger">{error}</div>}

      <div className="flex justify-end gap-2">
        <Link href="/leads" className="btn-secondary">Cancel</Link>
        <button className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Create lead"}
        </button>
      </div>
    </form>
  );
}
