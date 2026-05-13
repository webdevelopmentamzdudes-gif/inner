"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { saveIcp, type IcpInput } from "./actions";

type StageDraft = IcpInput["stages"][number];
type CriterionDraft = IcpInput["criteria"][number];

const FIELD_OPTIONS = [
  { value: "industry", label: "Industry" },
  { value: "geography", label: "Geography" },
  { value: "headcount", label: "Headcount" },
  { value: "annualRevenue", label: "Annual Revenue" },
  { value: "leadSource", label: "Lead Source" },
  { value: "contactTitle", label: "Contact Title" },
  { value: "custom_fields.tech_stack", label: "Tech Stack (custom)" },
  { value: "custom_fields.decision_maker", label: "Decision Maker (custom)" },
];

const RULE_OPTIONS: { value: CriterionDraft["matchRule"]; label: string }[] = [
  { value: "EQUALS", label: "equals" },
  { value: "CONTAINS", label: "contains" },
  { value: "GREATER_THAN", label: "greater than" },
  { value: "LESS_THAN", label: "less than" },
  { value: "BETWEEN", label: "between" },
  { value: "IN_LIST", label: "in list" },
];

const TYPE_OPTIONS: CriterionDraft["dataType"][] = [
  "STRING",
  "NUMBER",
  "BOOLEAN",
  "ENUM",
  "RANGE",
  "URL",
];

export function defaultStages(): StageDraft[] {
  return [
    { name: "New", isWon: false, isLost: false, stallThresholdDays: 3 },
    { name: "Researching", isWon: false, isLost: false, stallThresholdDays: 5 },
    { name: "Qualified", isWon: false, isLost: false, stallThresholdDays: 3 },
    { name: "Contacted", isWon: false, isLost: false, stallThresholdDays: 5 },
    { name: "Engaged", isWon: false, isLost: false, stallThresholdDays: 7 },
    { name: "Meeting Booked", isWon: false, isLost: false, stallThresholdDays: 14 },
    { name: "Won", isWon: true, isLost: false, stallThresholdDays: null },
    { name: "Lost", isWon: false, isLost: true, stallThresholdDays: null },
  ];
}

export default function IcpBuilderForm({
  initial,
}: {
  initial?: IcpInput;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [color, setColor] = useState(initial?.color ?? "#1E7FC4");
  const [status, setStatus] = useState<IcpInput["status"]>(initial?.status ?? "ACTIVE");
  const [criteria, setCriteria] = useState<CriterionDraft[]>(
    initial?.criteria ?? [
      { label: "Industry", fieldPath: "industry", dataType: "STRING", matchRule: "IN_LIST", matchValue: { values: [] }, weight: 25, required: false },
    ],
  );
  const [stages, setStages] = useState<StageDraft[]>(initial?.stages ?? defaultStages());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const totalWeight = useMemo(
    () => criteria.reduce((s, c) => s + (Number(c.weight) || 0), 0),
    [criteria],
  );

  function updateCriterion(i: number, patch: Partial<CriterionDraft>) {
    setCriteria((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function addCriterion() {
    setCriteria((cs) => [
      ...cs,
      {
        label: "",
        fieldPath: "industry",
        dataType: "STRING",
        matchRule: "EQUALS",
        matchValue: { value: "" },
        weight: 0,
        required: false,
      },
    ]);
  }
  function removeCriterion(i: number) {
    setCriteria((cs) => cs.filter((_, idx) => idx !== i));
  }

  function updateStage(i: number, patch: Partial<StageDraft>) {
    setStages((ss) => ss.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function addStage() {
    setStages((ss) => [...ss, { name: "", isWon: false, isLost: false, stallThresholdDays: 5 }]);
  }
  function removeStage(i: number) {
    setStages((ss) => ss.filter((_, idx) => idx !== i));
  }
  function moveStage(i: number, dir: -1 | 1) {
    setStages((ss) => {
      const j = i + dir;
      if (j < 0 || j >= ss.length) return ss;
      const next = [...ss];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function onSubmit() {
    setError(null);
    if (totalWeight !== 100) {
      setError(`Criteria weights must sum to 100 (currently ${totalWeight}).`);
      return;
    }
    if (!stages.some((s) => s.isWon)) {
      setError("At least one stage must be marked Won.");
      return;
    }
    if (!stages.some((s) => s.isLost)) {
      setError("At least one stage must be marked Lost.");
      return;
    }

    startTransition(async () => {
      try {
        await saveIcp({
          id: initial?.id,
          name,
          description: description || null,
          color,
          status,
          criteria,
          stages,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <section className="card p-5 space-y-4">
        <h2 className="font-semibold">Basics</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="label">Name</label>
            <input
              required
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mid-Market SaaS Buyer"
            />
          </div>
          <div className="space-y-1.5">
            <label className="label">Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 rounded border border-slate-200"
              />
              <input
                className="input flex-1 font-mono"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <label className="label">Description</label>
            <textarea
              className="input min-h-[72px] py-2"
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Plain-language summary of who this ICP is."
            />
          </div>
          <div className="space-y-1.5">
            <label className="label">Status</label>
            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value as IcpInput["status"])}
            >
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>
      </section>

      <section className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">
            Criteria & Weights
            <span className={`ml-3 text-sm ${totalWeight === 100 ? "text-success" : "text-danger"}`}>
              total: {totalWeight} / 100
            </span>
          </h2>
          <button type="button" onClick={addCriterion} className="btn-secondary btn-sm">
            <Plus className="size-3" /> Add criterion
          </button>
        </div>

        <div className="space-y-3">
          {criteria.map((c, i) => (
            <CriterionRow
              key={i}
              c={c}
              onChange={(patch) => updateCriterion(i, patch)}
              onRemove={() => removeCriterion(i)}
            />
          ))}
        </div>
      </section>

      <section className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Pipeline Stages</h2>
          <button type="button" onClick={addStage} className="btn-secondary btn-sm">
            <Plus className="size-3" /> Add stage
          </button>
        </div>
        <div className="space-y-2">
          {stages.map((s, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border border-slate-200 p-2">
              <div className="flex flex-col">
                <button
                  type="button"
                  className="text-muted hover:text-brand-navy text-xs"
                  onClick={() => moveStage(i, -1)}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="text-muted hover:text-brand-navy text-xs"
                  onClick={() => moveStage(i, 1)}
                >
                  ▼
                </button>
              </div>
              <GripVertical className="size-4 text-muted" />
              <input
                className="input flex-1"
                value={s.name}
                onChange={(e) => updateStage(i, { name: e.target.value })}
                placeholder="Stage name"
                required
              />
              <label className="text-xs flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={!!s.isWon}
                  onChange={(e) => updateStage(i, { isWon: e.target.checked, isLost: false })}
                />
                Won
              </label>
              <label className="text-xs flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={!!s.isLost}
                  onChange={(e) => updateStage(i, { isLost: e.target.checked, isWon: false })}
                />
                Lost
              </label>
              <input
                type="number"
                min={0}
                placeholder="stall (days)"
                className="input w-28"
                value={s.stallThresholdDays ?? ""}
                onChange={(e) =>
                  updateStage(i, {
                    stallThresholdDays: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
              <button
                type="button"
                className="btn-ghost text-danger btn-sm"
                onClick={() => removeStage(i)}
                aria-label="Remove stage"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted">
          Won and Lost are required terminal stages. Drag thresholds tune stalled-lead detection (PRD §10.4).
        </p>
      </section>

      {error && <div className="card p-3 text-sm text-danger">{error}</div>}

      <div className="flex items-center justify-end gap-2">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : initial?.id ? "Save changes" : "Create ICP"}
        </button>
      </div>
    </form>
  );
}

function CriterionRow({
  c,
  onChange,
  onRemove,
}: {
  c: CriterionDraft;
  onChange: (patch: Partial<CriterionDraft>) => void;
  onRemove: () => void;
}) {
  const mv = (c.matchValue ?? {}) as Record<string, unknown>;

  function setValue(patch: Record<string, unknown>) {
    onChange({ matchValue: { ...mv, ...patch } });
  }

  return (
    <div className="rounded-md border border-slate-200 p-3 space-y-2">
      <div className="grid md:grid-cols-12 gap-2">
        <input
          className="input md:col-span-3"
          placeholder="Label (e.g. Industry)"
          value={c.label}
          onChange={(e) => onChange({ label: e.target.value })}
          required
        />
        <select
          className="input md:col-span-3"
          value={c.fieldPath}
          onChange={(e) => onChange({ fieldPath: e.target.value })}
        >
          {FIELD_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          className="input md:col-span-2"
          value={c.dataType}
          onChange={(e) => onChange({ dataType: e.target.value as CriterionDraft["dataType"] })}
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          className="input md:col-span-2"
          value={c.matchRule}
          onChange={(e) =>
            onChange({
              matchRule: e.target.value as CriterionDraft["matchRule"],
              matchValue: e.target.value === "BETWEEN"
                ? { min: 0, max: 0 }
                : e.target.value === "IN_LIST"
                  ? { values: [] }
                  : { value: "" },
            })
          }
        >
          {RULE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          max={100}
          className="input md:col-span-1"
          value={c.weight}
          onChange={(e) => onChange({ weight: Number(e.target.value) })}
          aria-label="Weight"
        />
        <button
          type="button"
          className="btn-ghost text-danger md:col-span-1"
          onClick={onRemove}
          aria-label="Remove criterion"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {/* Match value editor varies by rule */}
      {c.matchRule === "BETWEEN" ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="label">Min</span>
          <input
            type="number"
            className="input w-32"
            value={(mv.min as number) ?? 0}
            onChange={(e) => setValue({ min: Number(e.target.value) })}
          />
          <span className="label">Max</span>
          <input
            type="number"
            className="input w-32"
            value={(mv.max as number) ?? 0}
            onChange={(e) => setValue({ max: Number(e.target.value) })}
          />
        </div>
      ) : c.matchRule === "IN_LIST" ? (
        <input
          className="input"
          placeholder="Comma-separated values: SaaS, MarTech, FinTech"
          value={Array.isArray(mv.values) ? (mv.values as string[]).join(", ") : ""}
          onChange={(e) =>
            setValue({
              values: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
      ) : (
        <input
          className="input"
          placeholder="Match value"
          value={(mv.value as string | number | undefined) ?? ""}
          onChange={(e) =>
            setValue({
              value: c.dataType === "NUMBER" ? Number(e.target.value) : e.target.value,
            })
          }
        />
      )}
    </div>
  );
}
