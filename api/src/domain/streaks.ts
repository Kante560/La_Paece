import { addDays, type LocalDate } from "../lib/dates.js";
import { completionRatio, isScheduled } from "./progress.js";
import type { DomainEntry, DomainHabit } from "./types.js";

export interface Streak {
  habitId: string;
  current: number;
  best: number;
  /** True when a single miss is currently outstanding — one more breaks it. */
  atRisk: boolean;
}

const MAX_LOOKBACK_DAYS = 400;

/**
 * "Never miss twice."
 *
 * A single miss does NOT reset the streak — two consecutive scheduled misses
 * do. Hard-reset streaks are the single biggest cause of tracker abandonment:
 * one bad day invalidates months of work and people quit rather than restart
 * from zero. Forgiving the first miss keeps the streak worth protecting.
 *
 * An unresolved today is never counted as a miss.
 */
export function computeStreak(
  habit: DomainHabit,
  entriesByKey: Map<string, DomainEntry>,
  today: LocalDate,
): Streak {
  const earliest = maxDate(habit.activeFrom, addDays(today, -MAX_LOOKBACK_DAYS));
  const end = habit.archivedAt && habit.archivedAt < today ? habit.archivedAt : today;

  const days: { date: LocalDate; done: boolean; hasEntry: boolean }[] = [];
  for (let d = earliest; d <= end; d = addDays(d, 1)) {
    if (!isScheduled(habit, d)) continue;
    const entry = entriesByKey.get(`${habit.id}|${d}`);
    days.push({
      date: d,
      done: completionRatio(habit, entry?.value ?? null) >= 1,
      hasEntry: entry !== undefined,
    });
  }

  // Today isn't over. An empty box now is not yet a miss.
  const last = days[days.length - 1];
  if (last && last.date === today && !last.hasEntry) days.pop();

  let current = 0;
  let best = 0;
  let consecutiveMisses = 0;

  for (const day of days) {
    if (day.done) {
      current++;
      consecutiveMisses = 0;
      if (current > best) best = current;
    } else {
      consecutiveMisses++;
      if (consecutiveMisses >= 2) {
        current = 0;
        consecutiveMisses = 0;
      }
    }
  }

  return { habitId: habit.id, current, best, atRisk: consecutiveMisses === 1 && current > 0 };
}

function maxDate(a: LocalDate, b: LocalDate): LocalDate {
  return a > b ? a : b;
}
