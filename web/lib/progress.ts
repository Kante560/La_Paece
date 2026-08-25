import type { Cell, DayProgress, Habit } from "./types";

/**
 * Client-side mirror of the server's weighted daily maths.
 *
 * The server stays the source of truth — this exists so a tap can move the ring
 * on the same frame instead of after a round trip. Every cell already carries
 * the weight the server assigned it (0 when unscheduled), so re-deriving the
 * headline number here can't drift from the server's answer as long as the
 * weights don't change, and a habit's weight only changes when you edit it.
 */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function completionRatio(habit: Habit | undefined, value: number | null): number {
  if (value === null || Number.isNaN(value)) return 0;
  if (!habit) return 0;
  if (habit.type === "BINARY") return value >= 1 ? 1 : 0;
  const target = habit.target ?? 0;
  if (target <= 0) return value > 0 ? 1 : 0;
  return Math.max(0, Math.min(1, value / target));
}

/** Recompute the day's headline number from its cells. */
export function recomputeProgress(progress: DayProgress, cells: Cell[]): DayProgress {
  let weightedDone = 0;
  let weightedTotal = 0;
  let completedCount = 0;
  let scheduledCount = 0;

  for (const c of cells) {
    if (c.state === "unscheduled") continue;
    scheduledCount++;
    weightedTotal += c.weight;
    weightedDone += c.ratio * c.weight;
    if (c.ratio >= 1) completedCount++;
  }

  return {
    ...progress,
    cells,
    pct: weightedTotal > 0 ? round2((weightedDone / weightedTotal) * 100) : 0,
    weightedDone: round2(weightedDone),
    weightedTotal: round2(weightedTotal),
    scheduledCount,
    completedCount,
  };
}

/**
 * Apply a single habit's new value to a day's progress, optimistically.
 *
 * Mirrors the server's cellState(): with an entry present, a zero is a real
 * miss — that's what tapping a miss-reason means. Clearing the box instead
 * goes through clearEntry(), because "not done yet" is not "failed".
 */
export function applyEntry(
  progress: DayProgress,
  habit: Habit,
  value: number,
  missReason: string | null = null,
): DayProgress {
  const ratio = completionRatio(habit, value);
  const cells = progress.cells.map((c) =>
    c.habitId === habit.id
      ? {
          ...c,
          value,
          ratio,
          missReason,
          state:
            ratio >= 1 ? ("complete" as const) : ratio > 0 ? ("partial" as const) : ("miss" as const),
        }
      : c,
  );
  return recomputeProgress(progress, cells);
}

/**
 * Remove a habit's entry for the day — unticking a box.
 *
 * An unresolved day that hasn't ended yet goes back to `pending`, never to
 * `miss`: unticking something means you haven't done it, not that you failed
 * it. Past days have no such excuse and fall back to `miss`.
 */
export function clearEntry(progress: DayProgress, habitId: string, isUnresolved: boolean): DayProgress {
  const cells = progress.cells.map((c) =>
    c.habitId === habitId
      ? {
          ...c,
          value: null,
          ratio: 0,
          missReason: null,
          state: isUnresolved ? ("pending" as const) : ("miss" as const),
        }
      : c,
  );
  return recomputeProgress(progress, cells);
}
