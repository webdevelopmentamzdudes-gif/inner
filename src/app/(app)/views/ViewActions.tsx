"use client";

import { useState, useTransition } from "react";
import { Trash2, Pencil, Check, X } from "lucide-react";
import { updateView, deleteView } from "./actions";

export default function ViewActions({
  id,
  initial,
}: {
  id: string;
  initial: { name: string; isShared: boolean };
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initial.name);
  const [isShared, setIsShared] = useState(initial.isShared);
  const [pending, startTransition] = useTransition();

  function onSave() {
    startTransition(async () => {
      try {
        await updateView({ id, name, isShared });
        setEditing(false);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  function onDelete() {
    if (!confirm(`Delete saved view "${initial.name}"?`)) return;
    startTransition(async () => {
      try {
        await deleteView(id);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 w-full">
        <input
          className="input h-7 text-xs flex-1 min-w-0"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label className="text-[10px] flex items-center gap-1">
          <input
            type="checkbox"
            checked={isShared}
            onChange={(e) => setIsShared(e.target.checked)}
          />
          shared
        </label>
        <button onClick={onSave} disabled={pending} className="text-success hover:text-success/80">
          <Check className="size-4" />
        </button>
        <button onClick={() => setEditing(false)} disabled={pending} className="text-muted">
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setEditing(true)}
        disabled={pending}
        className="text-muted hover:text-brand"
        aria-label="Rename"
      >
        <Pencil className="size-3" />
      </button>
      <button
        onClick={onDelete}
        disabled={pending}
        className="text-muted hover:text-danger"
        aria-label="Delete"
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  );
}
