"use client";

import { useEffect, useState } from "react";
import Portal from "./Portal";
import type { Habit, HabitCategory, HabitType, ResolveWindow } from "@/lib/types";

export const DOW = [
  { n: 1, l: "M" },
  { n: 2, l: "T" },
  { n: 3, l: "W" },
  { n: 4, l: "T" },
  { n: 5, l: "F" },
  { n: 6, l: "S" },
  { n: 0, l: "S" },
];

export interface HabitDraft {
  name: string;
  category: HabitCategory;
  type: HabitType;
  target: number;
  unit: string;
  scheduleDays: number[];
  resolveWindow: ResolveWindow;
}

export const EMPTY_DRAFT: HabitDraft = {
  name: "",
  category: "NON_NEGOTIABLE",
  type: "BINARY",
  target: 1,
  unit: "",
  scheduleDays: [0, 1, 2, 3, 4, 5, 6],
  resolveWindow: "SAME_DAY",
};

export function draftFrom(habit: Habit): HabitDraft {
  return {
    name: habit.name,
    category: habit.category,
    type: habit.type,
    target: habit.target ?? 1,
    unit: habit.unit ?? "",
    scheduleDays: [...habit.scheduleDays],
    resolveWindow: habit.resolveWindow,
  };
}

interface Props {
  /** Present when editing, absent when creating. */
  habit?: Habit;
  initialCategory?: HabitCategory;
  onSubmit: (draft: HabitDraft) => Promise<void> | void;
  onCancel: () => void;
  error?: string | null;
}

/** Add / edit a habit. Rendered as a sheet over the page it was opened from. */
export default function HabitForm({ habit, initialCategory, onSubmit, onCancel, error }: Props) {
  const [draft, setDraft] = useState<HabitDraft>(
    habit ? draftFrom(habit) : { ...EMPTY_DRAFT, category: initialCategory ?? "NON_NEGOTIABLE" },
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  async function submit() {
    if (!draft.name.trim() || busy) return;
    setBusy(true);
    try {
      await onSubmit({ ...draft, name: draft.name.trim() });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onCancel}
        className="absolute inset-0 bg-[color:var(--ink)] opacity-25"
      />

      <div className="card fade-up relative z-10 max-h-[88dvh] w-full max-w-lg space-y-3.5 overflow-y-auto rounded-b-none px-4 py-4 sm:rounded-b-lg">
        <div className="flex items-baseline justify-between">
          <h2 className="section-title text-lg">{habit ? "Edit habit" : "New habit"}</h2>
          <button type="button" onClick={onCancel} className="px-1 text-lg leading-none text-ink-faint">
            ×
          </button>
        </div>

        <input
          autoFocus
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Habit name"
          className="w-full rounded border border-rule bg-transparent px-3 py-2.5 text-[15px] outline-none focus:border-ink-faint"
        />

        <Choice
          value={draft.category}
          onChange={(category) => setDraft({ ...draft, category })}
          options={[
            ["NON_NEGOTIABLE", "Non-negotiable"],
            ["OTHER", "Other habit"],
          ]}
        />

        <Choice
          value={draft.type}
          onChange={(type) => setDraft({ ...draft, type })}
          options={[
            ["BINARY", "Did it / didn't"],
            ["QUANTITY", "Count a number"],
          ]}
        />

        {draft.type === "QUANTITY" && (
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={draft.target}
              onChange={(e) => setDraft({ ...draft, target: Number(e.target.value) })}
              className="w-24 rounded border border-rule bg-transparent px-2 py-2 text-[14px] tabular-nums outline-none"
            />
            <input
              value={draft.unit}
              onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
              placeholder="unit (L, pages, min)"
              className="flex-1 rounded border border-rule bg-transparent px-2 py-2 text-[14px] outline-none"
            />
          </div>
        )}

        <div>
          <span className="label-hand text-[13px]">Scheduled on</span>
          <div className="mt-1.5 flex items-center gap-1">
            {DOW.map((d) => {
              const on = draft.scheduleDays.includes(d.n);
              return (
                <button
                  key={d.n}
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      scheduleDays: on
                        ? draft.scheduleDays.filter((x) => x !== d.n)
                        : [...draft.scheduleDays, d.n].sort(),
                    })
                  }
                  className="h-8 flex-1 rounded text-[12px] transition-colors"
                  style={{
                    background: on ? "var(--ink)" : "transparent",
                    color: on ? "var(--paper)" : "var(--ink-faint)",
                    border: `1px solid ${on ? "var(--ink)" : "var(--rule)"}`,
                  }}
                >
                  {d.l}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-ink-faint">
            Unscheduled days show a dash — a rest day is not a failed workout.
          </p>
        </div>

        <Choice
          value={draft.resolveWindow}
          onChange={(resolveWindow) => setDraft({ ...draft, resolveWindow })}
          options={[
            ["SAME_DAY", "Check same day"],
            ["NEXT_MORNING", "Check next morning"],
          ]}
        />

        {error && <p className="text-[13px] text-accent">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={submit}
            disabled={busy || !draft.name.trim()}
            className="flex-1 rounded bg-ink py-2.5 text-[15px] text-paper disabled:opacity-40"
          >
            {busy ? "…" : habit ? "Save changes" : "Add habit"}
          </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded border border-rule px-4 text-[14px] text-ink-soft"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

function Choice<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly (readonly [T, string])[];
}) {
  return (
    <div className="flex gap-2">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className="flex-1 rounded border py-2 text-[13px] transition-colors"
          style={{
            borderColor: value === v ? "var(--ink)" : "var(--rule)",
            color: value === v ? "var(--ink)" : "var(--ink-faint)",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
