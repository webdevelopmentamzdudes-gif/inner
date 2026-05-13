"use client";

import { useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { saveView } from "../views/actions";

export default function SaveViewButton({ current }: { current: Record<string, string | undefined> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAs, setSavedAs] = useState<string | null>(null);

  const hasFilters = Object.entries(current).some(
    ([k, v]) => v && v !== "" && k !== "page",
  );

  function onSave() {
    setError(null);
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    startTransition(async () => {
      try {
        await saveView({
          name: name.trim(),
          filter: {
            q: current.q ?? "",
            icp: current.icp ?? "",
            stage: current.stage ?? "",
            bucket: current.bucket ?? "",
            source: current.source ?? "",
            mine: current.mine ?? "",
          },
          isShared,
        });
        setSavedAs(name.trim());
        setName("");
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  if (savedAs) {
    return (
      <div className="text-sm text-success self-center">
        Saved &ldquo;{savedAs}&rdquo;
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={!hasFilters}
        className="btn-secondary"
        title={hasFilters ? "Save the current filters as a reusable view" : "Apply some filters first"}
      >
        <Bookmark className="size-4" /> Save view
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 card p-3 z-10 shadow-lg space-y-2">
          <input
            autoFocus
            placeholder="View name (e.g. Hot Mid-Market)"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSave();
              if (e.key === "Escape") setOpen(false);
            }}
          />
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={isShared}
              onChange={(e) => setIsShared(e.target.checked)}
            />
            Share with team
          </label>
          {error && <div className="text-xs text-danger">{error}</div>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-ghost btn-sm"
              disabled={pending}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              className="btn-primary btn-sm"
              disabled={pending}
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
