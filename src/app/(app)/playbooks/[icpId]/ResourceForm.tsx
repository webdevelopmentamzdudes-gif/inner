"use client";

import { useState } from "react";
import Link from "next/link";
import { Paperclip, X } from "lucide-react";
import {
  RESOURCE_CATEGORIES,
  getCategory,
  type ResourceType,
} from "@/lib/playbook";
import {
  createResource,
  updateResource,
  archiveResource,
  restoreResource,
  deleteResource,
} from "../actions";

type ResourceData = {
  id?: string;
  type: ResourceType;
  title: string;
  body: string;
  version: string;
  fileName: string | null;
  meta: { subject?: string };
  status?: string;
};

export default function ResourceForm({
  icpId,
  initial,
  mode,
}: {
  icpId: string;
  initial: ResourceData;
  mode: "create" | "edit";
}) {
  const [type, setType] = useState<ResourceType>(initial.type);
  const cat = getCategory(type);
  const [removeFile, setRemoveFile] = useState(false);

  return (
    <form action={mode === "create" ? createResource : updateResource} className="space-y-4">
      {mode === "create" ? (
        <input type="hidden" name="icpId" value={icpId} />
      ) : (
        <input type="hidden" name="id" value={initial.id} />
      )}

      <div className="card p-5 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="label">Category</label>
            {mode === "create" ? (
              <select
                className="input"
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value as ResourceType)}
              >
                {RESOURCE_CATEGORIES.map((c) => (
                  <option key={c.type} value={c.type}>{c.label}</option>
                ))}
              </select>
            ) : (
              <input className="input bg-slate-50" value={cat.label} disabled />
            )}
            <p className="text-xs text-muted">{cat.description}</p>
          </div>
          <div className="space-y-1.5">
            <label className="label">Version</label>
            <input
              className="input"
              name="version"
              defaultValue={initial.version}
              placeholder="1.0"
            />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <label className="label">Title</label>
            <input
              required
              className="input"
              name="title"
              defaultValue={initial.title}
              placeholder={
                type === "EMAIL_TEMPLATE"
                  ? "Cold outreach — VP Marketing"
                  : type === "PITCH_DECK"
                    ? "Mid-Market Buyer Deck v3"
                    : "Resource title"
              }
            />
          </div>

          {type === "EMAIL_TEMPLATE" && (
            <div className="md:col-span-2 space-y-1.5">
              <label className="label">Email subject</label>
              <input
                className="input"
                name="emailSubject"
                defaultValue={initial.meta.subject ?? ""}
                placeholder="Quick idea for {{company}}"
              />
            </div>
          )}
        </div>

        {cat.supportsBody && (
          <div className="space-y-1.5">
            <label className="label">
              Body
              {type === "EMAIL_TEMPLATE" || type === "CALL_SCRIPT" || type === "REPORT_SOP" || type === "PRICING"
                ? " (markdown)"
                : ""}
            </label>
            <textarea
              className="input min-h-[260px] py-2 font-mono text-xs"
              name="body"
              defaultValue={initial.body}
              placeholder={placeholderFor(type)}
            />
            <p className="text-xs text-muted">
              Markdown rendered on the resource detail page. Use placeholders like{" "}
              <code>{`{{company}}`}</code> and <code>{`{{first_name}}`}</code> in templates;
              copy-paste swaps will be added later.
            </p>
          </div>
        )}

        {cat.supportsFile && (
          <div className="space-y-1.5">
            <label className="label">File</label>
            {initial.fileName && !removeFile && (
              <div className="text-sm flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 bg-slate-50">
                <Paperclip className="size-4 text-muted" />
                <span className="flex-1 truncate">{initial.fileName}</span>
                <button
                  type="button"
                  onClick={() => setRemoveFile(true)}
                  className="text-muted hover:text-danger"
                >
                  <X className="size-4" />
                </button>
              </div>
            )}
            {removeFile && <input type="hidden" name="removeFile" value="1" />}
            <input
              type="file"
              name="file"
              className="text-sm file:btn-secondary file:btn-sm file:cursor-pointer"
              accept={
                type === "PITCH_DECK"
                  ? ".pdf,.ppt,.pptx,.key"
                  : type === "CONTRACT"
                    ? ".pdf,.doc,.docx"
                    : type === "REPORT_SOP"
                      ? ".pdf,.doc,.docx,.md,.txt"
                      : "*"
              }
            />
            <p className="text-xs text-muted">
              {initial.fileName && !removeFile
                ? "Selecting a new file replaces the existing upload."
                : "PDF, DOCX, PPTX, etc. — up to 12 MB."}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Link href={`/playbooks/${icpId}`} className="btn-secondary">
          Cancel
        </Link>
        <div className="flex gap-2">
          {mode === "edit" && initial.id && (
            <>
              {initial.status === "ARCHIVED" ? (
                <RowAction
                  label="Restore"
                  action={async () => {
                    "use server";
                    await restoreResource(initial.id!);
                  }}
                />
              ) : (
                <RowAction
                  label="Archive"
                  className="btn-ghost text-warning"
                  action={async () => {
                    "use server";
                    await archiveResource(initial.id!);
                  }}
                />
              )}
              <RowAction
                label="Delete"
                className="btn-ghost text-danger"
                confirmText="Delete this resource permanently? Files will be removed."
                action={async () => {
                  "use server";
                  await deleteResource(initial.id!);
                }}
              />
            </>
          )}
          <button className="btn-primary" type="submit">
            {mode === "create" ? "Create resource" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}

function RowAction({
  label,
  action,
  className = "btn-secondary",
  confirmText,
}: {
  label: string;
  action: () => Promise<void>;
  className?: string;
  confirmText?: string;
}) {
  return (
    <form action={action}>
      <button
        type="submit"
        className={className}
        onClick={(e) => {
          if (confirmText && !confirm(confirmText)) e.preventDefault();
        }}
      >
        {label}
      </button>
    </form>
  );
}

function placeholderFor(type: ResourceType): string {
  switch (type) {
    case "EMAIL_TEMPLATE":
      return "Hi {{first_name}},\n\nNoticed {{company}} is...\n\nBest,\n{{rep_name}}";
    case "CALL_SCRIPT":
      return "## Opener\n- Confirm name and role\n\n## Discovery\n- Current process for X?\n\n## Objection: pricing\n- ...";
    case "REPORT_SOP":
      return "## Step 1 — Gather inputs\n## Step 2 — Run the audit\n## Step 3 — Format the report\n## Step 4 — Internal review\n## Step 5 — Send to lead";
    case "PRICING":
      return "## Standard\n- $X / month / seat\n- Annual: 15% discount\n\n## Enterprise\n- Custom — escalate to manager";
    case "CONTRACT":
      return "Optional notes about this contract template (e.g. when to use which clauses).";
    case "PITCH_DECK":
      return "Optional notes about when to use this deck, key talking points, etc.";
    default:
      return "";
  }
}
