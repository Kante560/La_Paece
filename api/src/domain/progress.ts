import { dayOfWeek, type LocalDate } from "../lib/dates.js";
import type { Cell, DayProgress, DomainEntry, DomainHabit } from "./types.js";

export function weightOf(habit: DomainHabit, nonNegotiableWeight: number): number {
  return habit.category === "NON_NEGOTIABLE" ? nonNegotiableWeight : 1;
}

/**
 * Is this habit scheduled on this date?
 *
 * A habit created on the 15th is NOT scheduled on the 1st — those days render
 * as dashes, never as retroactive misses. Same for archived habits and for
 * weekdays the habit isn't scoped to (a rest day is not a failed workout).
 */
export function isScheduled(habit: DomainHabit, date: LocalDate): boolean {
  if (date < habit.activeFrom) return false;
  if (habit.activeTo && date > habit.activeTo) return false;
  if (habit.archivedAt && date > habit.archivedAt) return false;
  return habit.scheduleDays.includes(dayOfWeek(date));
}

/** Credit toward the day, 0..1. Quantity habits earn proportional partial credit. */
export function completionRatio(habit: DomainHabit, value: number | null): number {
  if (value === null || Number.isNaN(value)) return 0;
  if (habit.type === "BINARY") return value >= 1 ? 1 : 0;
  const target = habit.target ?? 0;
  if (target <= 0) return value > 0 ? 1 : 0;
  return Math.max(0, Math.min(1, value / target));
}

function cellState(ratio: number, hasEntry: boolean, isUnresolved: boolean): Cell["state"] {
  if (!hasEntry) return isUnresolved ? "pending" : "miss";
  if (ratio >= 1) return "complete";
  if (ratio > 0) return "partial";
  return "miss";
}

/**
 * Weighted daily completion.
 *
 * Non-negotiables count `nonNegotiableWeight` times a normal habit, so the
 * headline number reflects what you actually said mattered — not a flat
 * average that lets "stretch" paper over a missed workout.
 */
export function dailyProgress(
  habits: DomainHabit[],
  entriesByKey: Map<string, DomainEntry>,
  date: LocalDate,
  nonNegotiableWeight: number,
  today: LocalDate,
): DayProgress {
  const cells: Cell[] = [];
  let weightedDone = 0;
  let weightedTotal = 0;
  let completedCount = 0;
  let scheduledCount = 0;

  for (const habit of habits) {
    if (!isScheduled(habit, date)) {
      cells.push({
        habitId: habit.id,
        date,
        state: "unscheduled",
        ratio: 0,
        value: null,
        weight: 0,
        isBackfill: false,
        missReason: null,
      });
      continue;
    }

    const weight = weightOf(habit, nonNegotiableWeight);
    const entry = entriesByKey.get(`${habit.id}|${date}`);
    const ratio = completionRatio(habit, entry?.value ?? null);
    // Today isn't over yet, so an empty box today is "pending," not a miss —
    // same rule computeStreak() applies when deciding whether today breaks a streak.
    const isUnresolved = date >= today;

    scheduledCount++;
    weightedTotal += weight;
    weightedDone += ratio * weight;
    if (ratio >= 1) completedCount++;

    cells.push({
      habitId: habit.id,
      date,
      state: cellState(ratio, entry !== undefined, isUnresolved),
      ratio,
      value: entry?.value ?? null,
      weight,
      isBackfill: entry?.isBackfill ?? false,
      missReason: entry?.missReason ?? null,
    });
  }

  return {
    date,
    pct: weightedTotal > 0 ? round2((weightedDone / weightedTotal) * 100) : 0,
    weightedDone: round2(weightedDone),
    weightedTotal: round2(weightedTotal),
    scheduledCount,
    completedCount,
    cells,
  };
}

/**
 * Month-to-date average of daily %.
 *
 * Only counts days that had at least one scheduled habit, and never counts
 * future days — otherwise the number is guaranteed to look terrible on the 2nd.
 */
export function averagePct(days: DayProgress[]): number {
  const counted = days.filter((d) => d.weightedTotal > 0);
  if (counted.length === 0) return 0;
  return round2(counted.reduce((s, d) => s + d.pct, 0) / counted.length);
}

export interface Consistency {
  /** 0..100, or null until there is any completed day to rate. */
  ovr: number | null;
  daysCounted: number;
  /** Change against the window immediately before this one, or null if there isn't one. */
  delta: number | null;
  windowDays: number;
}

/**
 * Overall consistency rating — one number for how you have actually been
 * living, as opposed to how today happens to be going.
 *
 * Today is deliberately excluded. A day in progress is mostly empty boxes, so
 * folding it in would sink the rating every morning and haul it back every
 * night; a headline that swings forty points before breakfast tells you nothing
 * about your consistency. It is the same reason dailyProgress() calls an empty
 * box today "pending" rather than a miss.
 *
 * Days with nothing scheduled are skipped rather than scored zero, so a rest
 * day cannot dilute the rating and a habit added last week cannot invent misses
 * for the weeks before it existed.
 */
export function consistency(history: DayProgress[], windowDays: number): Consistency {
  const recent = history.slice(-windowDays).filter((d) => d.weightedTotal > 0);
  const previous = history.slice(-windowDays * 2, -windowDays).filter((d) => d.weightedTotal > 0);

  if (recent.length === 0) {
    return { ovr: null, daysCounted: 0, delta: null, windowDays };
  }

  const now = averagePct(recent);
  return {
    ovr: Math.round(now),
    daysCounted: recent.length,
    // Needs both windows to mean anything. One week against nothing is not a trend.
    delta: previous.length > 0 ? Math.round(now - averagePct(previous)) : null,
    windowDays,
  };
}

export function buildEntryMap(entries: DomainEntry[]): Map<string, DomainEntry> {
  return new Map(entries.map((e) => [`${e.habitId}|${e.date}`, e]));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
