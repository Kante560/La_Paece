"use client";

import { useState } from "react";
import Check from "./Check";
import { useLongPress } from "@/lib/useLongPress";
import type { Cell, Habit, Streak } from "@/lib/types";

interface Props {
  habit: Habit;
  cell: Cell;
  streak?: Streak;
  onSet: (value: number) => void;
  /** Untick — clears the entry rather than logging a zero. */
  onClear: () => void;
  /** Long-press / right-click on the check opens the row's menu. */
  onMenu?: (x: number, y: number) => void;
  pendingResolve?: boolean;
  /** Weight of a non-negotiable relative to a bonus habit, for the badge. */
  weightMultiplier?: number;
}

export default function HabitRow({
  habit,
  cell,
  streak,
  onSet,
  onClear,
  onMenu,
  pendingResolve,
  weightMultiplier,
}: Props) {
  const [open, setOpen] = useState(false);
  const longPress = useLongPress((x, y) => onMenu?.(x, y));

  if (cell.state === "unscheduled") return null;

  const value = cell.value ?? 0;
  const target = habit.target ?? 1;
  const isQuantity = habit.type === "QUANTITY";
  const isNonNegotiable = habit.category === "NON_NEGOTIABLE";
  const done = cell.ratio >= 1;

  // Unticking means "not done yet", not "failed" — so it clears the entry
  // instead of writing a zero the evening review would read as a miss.
  const toggle = () => (done ? onClear() : onSet(target));
  const bump = (delta: number) => onSet(Math.max(0, Math.round((value + delta) * 100) / 100));
  const step = target >= 1000 ? 500 : target >= 60 ? 15 : target >= 10 ? 5 : 0.5;

  return (
    <li className="border-b border-rule last:border-0">
      <div className="flex items-center gap-3 py-2.5">
        <Check
          state={cell.state}
          onClick={toggle}
          label={habit.name}
          variant={isNonNegotiable ? "primary" : "secondary"}
          handlers={onMenu ? longPress : undefined}
        />

        <button
          type="button"
          onClick={() => isQuantity && setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-baseline gap-2 text-left"
        >
          <span
            className="truncate"
            style={{
              fontSize: isNonNegotiable ? 15 : 14,
              color: done ? "var(--ink-faint)" : isNonNegotiable ? "var(--ink)" : "var(--ink-soft)",
              textDecoration: done ? "line-through" : "none",
            }}
          >
            {habit.name}
          </span>
          {isQuantity && (
            <span className="shrink-0 text-[12px] tabular-nums text-ink-faint">
              {value}/{target}
              {habit.unit ? ` ${habit.unit}` : ""}
            </span>
          )}
        </button>

        {/* What this row is actually worth in the day's number. */}
        {isNonNegotiable && weightMultiplier && weightMultiplier > 1 && (
          <span
            className="shrink-0 rounded px-1 py-0.5 text-[10px] tabular-nums"
            style={{ color: "var(--ink-faint)", border: "1px solid var(--rule)" }}
            title={`Counts ${weightMultiplier}× a bonus habit`}
          >
            {weightMultiplier}×
          </span>
        )}

        {/* A streak is only worth showing once it's worth protecting. */}
        {streak && streak.current >= 3 && (
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[11px] tabular-nums"
            style={{
              color: streak.atRisk ? "var(--accent)" : "var(--ink-faint)",
              background: streak.atRisk ? "var(--accent-soft)" : "transparent",
            }}
            title={streak.atRisk ? "One more miss breaks this" : `Best: ${streak.best}`}
          >
            {streak.current}
            {streak.atRisk ? "!" : ""}
          </span>
        )}

        {pendingResolve && (
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-ink-faint">am</span>
        )}
      </div>

      {isQuantity && open && (
        <div className="fade-up flex items-center gap-2 pb-3 pl-9">
          <button
            type="button"
            onClick={() => bump(-step)}
            className="h-8 w-8 rounded border border-rule text-lg leading-none text-ink-soft"
          >
            −
          </button>
          <input
            type="number"
            inputMode="decimal"
            value={value}
            onChange={(e) => onSet(Math.max(0, Number(e.target.value) || 0))}
            className="h-8 w-20 rounded border border-rule bg-transparent px-2 text-center text-sm tabular-nums text-ink outline-none"
          />
          <button
            type="button"
            onClick={() => bump(step)}
            className="h-8 w-8 rounded border border-rule text-lg leading-none text-ink-soft"
          >
            +
          </button>
          <span className="text-[12px] text-ink-faint">{habit.unit}</span>
        </div>
      )}
    </li>
  );
}
