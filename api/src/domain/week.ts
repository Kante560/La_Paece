import type { LocalDate } from "../lib/dates.js";
import { round2 } from "./progress.js";
import type { DayProgress } from "./types.js";

export type PaceStatus =
  | "SECURED" // target already mathematically locked in
  | "AHEAD"
  | "ON_PACE"
  | "BEHIND"
  | "CRITICAL" // must be near-perfect from here
  | "IMPOSSIBLE"; // no longer reachable — say so, don't let the week limp

export interface WeekStats {
  weekStart: LocalDate;
  days: DayProgress[];
  totalWeighted: number;
  doneWeighted: number;
  elapsedWeighted: number;
  remainingWeighted: number;
  totalChecks: number;
  doneChecks: number;
  remainingChecks: number;
  currentPct: number; // how you've performed on days so far
  floorPct: number; // where you land if you do nothing else
  ceilingPct: number; // best still achievable
  target: TargetStatus | null;
}

export interface TargetStatus {
  targetPct: number;
  status: PaceStatus;
  neededWeighted: number;
  /** "You need at least N of the remaining M." Counts beat percentages. */
  neededChecks: number;
  remainingChecks: number;
  requiredRate: number; // 0..1 share of what's left you must convert
  currentRate: number;
  /** Suggested still-achievable target when the original is out of reach. */
  rebaselineSuggestion: number | null;
}

export function weekStats(
  days: DayProgress[],
  today: LocalDate,
  targetPct: number | null,
): WeekStats {
  let totalWeighted = 0;
  let doneWeighted = 0;
  let elapsedWeighted = 0;
  let remainingWeighted = 0;
  let totalChecks = 0;
  let doneChecks = 0;

  // Recoverable slots, heaviest first — the cheapest route to a target is to
  // do the non-negotiables, so that's what "you need N more" should mean.
  const recoverable: number[] = [];

  for (const day of days) {
    totalWeighted += day.weightedTotal;
    doneWeighted += day.weightedDone;
    totalChecks += day.scheduledCount;
    doneChecks += day.completedCount;
    if (day.date <= today) elapsedWeighted += day.weightedTotal;

    if (day.date >= today) {
      for (const cell of day.cells) {
        if (cell.state === "unscheduled" || cell.ratio >= 1) continue;
        const left = cell.weight * (1 - cell.ratio);
        if (left > 0) {
          remainingWeighted += left;
          recoverable.push(left);
        }
      }
    }
  }

  recoverable.sort((a, b) => b - a);

  const currentPct = elapsedWeighted > 0 ? round2((doneWeighted / elapsedWeighted) * 100) : 0;
  const floorPct = totalWeighted > 0 ? round2((doneWeighted / totalWeighted) * 100) : 0;
  const ceilingPct =
    totalWeighted > 0 ? round2(((doneWeighted + remainingWeighted) / totalWeighted) * 100) : 0;

  let target: TargetStatus | null = null;
  if (targetPct !== null && totalWeighted > 0) {
    const neededWeighted = round2((targetPct / 100) * totalWeighted - doneWeighted);
    const currentRate = elapsedWeighted > 0 ? doneWeighted / elapsedWeighted : 0;
    const requiredRate =
      neededWeighted <= 0 ? 0 : remainingWeighted > 0 ? neededWeighted / remainingWeighted : 2;

    let neededChecks = 0;
    let acc = 0;
    for (const w of recoverable) {
      if (acc >= neededWeighted) break;
      acc += w;
      neededChecks++;
    }

    target = {
      targetPct,
      status: paceStatus(neededWeighted, requiredRate, currentRate),
      neededWeighted,
      neededChecks,
      remainingChecks: recoverable.length,
      requiredRate: round2(Math.min(requiredRate, 2)),
      currentRate: round2(currentRate),
      rebaselineSuggestion: requiredRate > 1 ? suggestRebaseline(ceilingPct, floorPct) : null,
    };
  }

  return {
    weekStart: days[0]?.date ?? today,
    days,
    totalWeighted: round2(totalWeighted),
    doneWeighted: round2(doneWeighted),
    elapsedWeighted: round2(elapsedWeighted),
    remainingWeighted: round2(remainingWeighted),
    totalChecks,
    doneChecks,
    remainingChecks: recoverable.length,
    currentPct,
    floorPct,
    ceilingPct,
    target,
  };
}

function paceStatus(needed: number, requiredRate: number, currentRate: number): PaceStatus {
  if (needed <= 0) return "SECURED";
  if (requiredRate > 1) return "IMPOSSIBLE";
  if (requiredRate >= 0.95) return "CRITICAL";
  if (requiredRate > currentRate + 0.05) return "BEHIND";
  if (requiredRate < currentRate - 0.05) return "AHEAD";
  return "ON_PACE";
}

/** Land between the floor and the ceiling — a target you can still actually hit. */
function suggestRebaseline(ceilingPct: number, floorPct: number): number {
  return round2(floorPct + (ceilingPct - floorPct) * 0.75);
}

/**
 * Never show a blank goal field. Blank fields produce either sandbagging or
 * fantasy. Anchor to the trailing average and nudge by a small increment —
 * small ratchets compound, big ones break people in week one.
 */
export function suggestTarget(trailingAvgPct: number): number {
  return round2(Math.min(100, trailingAvgPct + 3.5));
}

export const MAX_SAFE_INCREMENT = 10;

export function targetWarning(targetPct: number, baselinePct: number): string | null {
  const jump = targetPct - baselinePct;
  if (jump > MAX_SAFE_INCREMENT) {
    return `That's +${round2(jump)} points over your ${round2(baselinePct)}% average. Jumps this big are how week one fails. Consider ${suggestTarget(baselinePct)}%.`;
  }
  if (jump < 0) {
    return `Lower than your ${round2(baselinePct)}% average — deliberately deloading is a legitimate move, not a failure.`;
  }
  return null;
}
